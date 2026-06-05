import { useState, useEffect, useRef, useCallback } from "react";
import { parseMarkdown, type OutlineEntry } from "@/parser";
import { parseMarkdownInWorker } from "@/parser/parse-worker-bridge";
import { getCachedParseResult, evictCachedParseResult } from "@/parser/parse-cache";
import { renderMermaidPlaceholders } from "@/parser/rehype-mermaid";
import { ensureKatexCss } from "@/parser/lazy-katex-css";
import { resolveRelativeImages } from "./resolveAssets";
import { DocumentShell } from "./DocumentShell";
import { findAnchorTarget, scrollContainerToTarget } from "./anchorNavigation";
import { classifyRenderedLink, getFragmentIdFromHref, normalizeExternalHref } from "./linkPolicy";
import { isTauriRuntime } from "@/utils/platform";
import "./Reader.css";

interface ReaderProps {
  content: string;
  filePath: string | null;
  onOpenDocument?: (path: string) => void;
}

async function openExternalLink(href: string): Promise<void> {
  const externalHref = normalizeExternalHref(href);
  const tauriRuntime = isTauriRuntime();

  try {
    if (tauriRuntime) {
      const { openUrl } = await import("@tauri-apps/plugin-opener");
      await openUrl(externalHref);
      return;
    }
  } catch {
    if (tauriRuntime) {
      return;
    }
  }

  window.open(externalHref, "_blank", "noopener,noreferrer");
}

async function handleInternalLink(
  href: string,
  filePath: string | null,
  onOpenDocument?: (path: string) => void
): Promise<{ openPath: string | null; fragment: string | null }> {
  if (!filePath || !isTauriRuntime()) {
    return { openPath: null, fragment: null };
  }

  const [pathPart, fragmentPart] = href.split("#", 2);
  const fragment = fragmentPart ? decodeURIComponent(fragmentPart) : null;

  if (!pathPart) {
    return { openPath: null, fragment };
  }

  try {
    const { invoke } = await import("@tauri-apps/api/core");
    const resolved = await invoke<{ absolute_path: string; is_dir: boolean }>(
      "resolve_local_path",
      { docPath: filePath, relativePath: pathPart }
    );

    if (resolved.is_dir) {
      const { openPath } = await import("@tauri-apps/plugin-opener");
      await openPath(resolved.absolute_path);
      return { openPath: null, fragment: null };
    }

    const ext = resolved.absolute_path.toLowerCase();
    const isMarkdown = ext.endsWith(".md") || ext.endsWith(".markdown");

    if (isMarkdown && onOpenDocument) {
      return { openPath: resolved.absolute_path, fragment };
    }

    if (!isMarkdown) {
      const { openPath } = await import("@tauri-apps/plugin-opener");
      await openPath(resolved.absolute_path);
    }

    return { openPath: null, fragment: null };
  } catch (err) {
    console.error("Failed to resolve internal link:", err);
    return { openPath: null, fragment: null };
  }
}

export function Reader({ content, filePath, onOpenDocument }: ReaderProps) {
  const [html, setHtml] = useState("");
  const [outline, setOutline] = useState<OutlineEntry[]>([]);
  const [error, setError] = useState<string | null>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const prevContentRef = useRef(content);
  const pendingFragmentRef = useRef<string | null>(null);

  useEffect(() => {
    if (prevContentRef.current !== content && prevContentRef.current) {
      evictCachedParseResult(prevContentRef.current);
      prevContentRef.current = content;
    }
  }, [content]);

  useEffect(() => {
    let cancelled = false;
    setError(null);

    const cached = getCachedParseResult(content);
    if (cached) {
      if (!cancelled) {
        setHtml(cached.html);
        setOutline(cached.outline);
        if (cached.hasMath) ensureKatexCss();
      }
      return () => {
        cancelled = true;
      };
    }

    parseMarkdown(content, { skipShiki: true, skipMermaid: true })
      .then((quick) => {
        if (!cancelled) {
          setHtml(quick.html);
          setOutline(quick.outline);
          if (quick.hasMath) ensureKatexCss();
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : String(err));
        }
      });

    parseMarkdownInWorker(content)
      .then((full) => {
        if (!cancelled) {
          setHtml(full.html);
          setOutline(full.outline);
          if (full.hasMath) ensureKatexCss();
        }
      })
      .catch(() => {
        // Full parse failure is non-fatal; quick parse result is already shown.
      });

    return () => {
      cancelled = true;
    };
  }, [content]);

  useEffect(() => {
    return () => {
      setHtml("");
      setOutline([]);
    };
  }, []);

  useEffect(() => {
    if (html && bodyRef.current) {
      renderMermaidPlaceholders(bodyRef.current);
    }
  }, [html]);

  useEffect(() => {
    if (!html || !bodyRef.current || !filePath) return;
    void resolveRelativeImages(bodyRef.current, filePath);
  }, [html, filePath]);

  const scrollToFragment = useCallback((fragmentId: string | null) => {
    if (!fragmentId || !bodyRef.current) {
      return;
    }

    const target = findAnchorTarget(bodyRef.current, fragmentId);
    const scrollContainer = bodyRef.current.closest<HTMLElement>(".mdr-doc");
    if (target && scrollContainer) {
      scrollContainerToTarget(scrollContainer, target);
    }
  }, []);

  useEffect(() => {
    if (!html || !bodyRef.current) return;
    const fragment = pendingFragmentRef.current;
    if (fragment) {
      pendingFragmentRef.current = null;
      setTimeout(() => scrollToFragment(fragment), 50);
    }
  }, [html, scrollToFragment]);

  const handleLinkClick = useCallback((e: MouseEvent) => {
    const anchor = (e.target as HTMLElement).closest("a");
    if (!anchor) return;
    const href = anchor.getAttribute("href");
    if (!href) return;
    const action = classifyRenderedLink(href);

    if (action === "internal") {
      e.preventDefault();
      e.stopPropagation();
      void (async () => {
        const result = await handleInternalLink(href, filePath, onOpenDocument);
        if (result.openPath && onOpenDocument) {
          if (result.fragment) {
            pendingFragmentRef.current = result.fragment;
          }
          onOpenDocument(result.openPath);
        }
      })();
      return;
    }

    e.preventDefault();
    e.stopPropagation();

    if (action === "fragment") {
      scrollToFragment(getFragmentIdFromHref(href));
    } else if (action === "external") {
      void openExternalLink(href);
    }
  }, [scrollToFragment, filePath, onOpenDocument]);

  useEffect(() => {
    const el = bodyRef.current;
    if (!el) return;
    el.addEventListener("click", handleLinkClick, true);
    return () => el.removeEventListener("click", handleLinkClick, true);
  }, [handleLinkClick]);

  if (error) {
    return (
      <div className="mdr-error">
        <h2>Parse Error</h2>
        <p>{error}</p>
        <pre><code>{content}</code></pre>
      </div>
    );
  }

  if (content === "" && filePath !== null) {
    return (
      <DocumentShell outline={outline} onAnchorClick={scrollToFragment}>
        <div ref={bodyRef} className="mdr-body">
          <p className="mdr-empty">This file is empty.</p>
        </div>
      </DocumentShell>
    );
  }

  return (
    <DocumentShell outline={outline} onAnchorClick={scrollToFragment}>
      <div
        ref={bodyRef}
        className="mdr-body"
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </DocumentShell>
  );
}
