import { useState, useEffect, useLayoutEffect, useMemo, useRef, useCallback } from "react";
import { parseMarkdown, type OutlineEntry } from "@/parser";
import { parseMarkdownInWorker } from "@/parser/parse-worker-bridge";
import { getCachedParseResult, evictCachedParseResult } from "@/parser/parse-cache";
import { renderMermaidPlaceholders } from "@/parser/rehype-mermaid";
import { ensureKatexCss } from "@/parser/lazy-katex-css";
import { resolveRelativeImages } from "./resolveAssets";
import { morphMarkdownBody } from "./domMorph";
import { DocumentShell } from "./DocumentShell";
import { findAnchorTarget, scrollContainerToTarget } from "./anchorNavigation";
import { classifyRenderedLink, getFragmentIdFromHref, normalizeExternalHref } from "./linkPolicy";
import { enhanceCodeBlocks, removeCodeBlockEnhancements } from "./codeBlockEnhancements";
import { isTauriRuntime } from "@/utils/platform";
import { useToast } from "@/hooks/useToast";
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
      { docPath: filePath, relativePath: pathPart },
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
  const [activeId, setActiveId] = useState<string | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  // Full-parse HTML waiting to be merged into the already-painted quick parse.
  const [pendingFullHtml, setPendingFullHtml] = useState<string | null>(null);
  // Bumped whenever the rendered DOM changes outside of React (morph).
  const [domVersion, setDomVersion] = useState(0);
  // Bumped when the first HTML for a freshly opened document commits.
  const [documentEpoch, setDocumentEpoch] = useState(0);
  const bodyRef = useRef<HTMLDivElement>(null);
  const prevContentRef = useRef(content);
  const pendingFragmentRef = useRef<string | null>(null);
  const { toast } = useToast();
  const toastRef = useRef(toast);
  toastRef.current = toast;

  useEffect(() => {
    if (prevContentRef.current !== content && prevContentRef.current) {
      evictCachedParseResult(prevContentRef.current);
      prevContentRef.current = content;
    }
  }, [content]);

  useEffect(() => {
    let cancelled = false;
    let fullDone = false;
    let quickShown = false;
    setError(null);
    setPendingFullHtml(null);

    const cached = getCachedParseResult(content);
    if (cached) {
      setHtml(cached.html);
      setOutline(cached.outline);
      setDocumentEpoch((epoch) => epoch + 1);
      if (cached.hasMath) ensureKatexCss();
      return () => {
        cancelled = true;
      };
    }

    parseMarkdown(content, { skipShiki: true, skipMermaid: true })
      .then((quick) => {
        if (cancelled || fullDone) return;
        quickShown = true;
        setHtml(quick.html);
        setOutline(quick.outline);
        setDocumentEpoch((epoch) => epoch + 1);
        if (quick.hasMath) ensureKatexCss();
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : String(err));
        }
      });

    parseMarkdownInWorker(content)
      .then((full) => {
        if (cancelled) return;
        fullDone = true;
        setOutline(full.outline);
        if (full.hasMath) ensureKatexCss();
        if (quickShown) {
          // The quick parse is on screen; patch in the differences (mostly
          // highlighted code blocks) instead of re-rendering everything.
          setPendingFullHtml(full.html);
        } else {
          setHtml(full.html);
          setDocumentEpoch((epoch) => epoch + 1);
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
    if (pendingFullHtml === null) return;

    const body = bodyRef.current;
    if (body && morphMarkdownBody(body, pendingFullHtml)) {
      setDomVersion((version) => version + 1);
    }
    setPendingFullHtml(null);
  }, [pendingFullHtml]);

  // Start each newly opened document at the top, in the same frame its
  // content first paints.
  useLayoutEffect(() => {
    if (documentEpoch === 0) return;
    const scrollContainer = bodyRef.current?.closest<HTMLElement>(".mdr-doc");
    if (scrollContainer) {
      scrollContainer.scrollTop = 0;
    }
  }, [documentEpoch]);

  useEffect(() => {
    if (html && bodyRef.current) {
      renderMermaidPlaceholders(bodyRef.current);
    }
  }, [html, domVersion]);

  useEffect(() => {
    if (!html || !bodyRef.current || !filePath) return;
    void resolveRelativeImages(bodyRef.current, filePath);
  }, [html, filePath, domVersion]);

  useEffect(() => {
    // Keep the current position when an outline refresh (e.g. the full
    // parse landing) still contains the active heading.
    setActiveId((previous) =>
      previous !== undefined && outline.some((entry) => entry.id === previous)
        ? previous
        : outline[0]?.id,
    );
  }, [outline]);

  useEffect(() => {
    const body = bodyRef.current;
    const scrollContainer = body?.closest<HTMLElement>(".mdr-doc");
    if (!body || !scrollContainer || outline.length === 0) return;

    let frame: number | null = null;

    const updateActiveHeading = () => {
      frame = null;
      const containerRect = scrollContainer.getBoundingClientRect();
      const threshold = containerRect.top + 96;
      let current = outline[0]?.id;

      for (const entry of outline) {
        const target = findAnchorTarget(body, entry.id);
        if (!target) continue;

        if (target.getBoundingClientRect().top <= threshold) {
          current = entry.id;
        } else {
          break;
        }
      }

      setActiveId((previous) => (previous === current ? previous : current));
    };

    const scheduleUpdate = () => {
      if (frame !== null) return;
      frame = window.requestAnimationFrame(updateActiveHeading);
    };

    updateActiveHeading();
    scrollContainer.addEventListener("scroll", scheduleUpdate, { passive: true });
    window.addEventListener("resize", scheduleUpdate);

    return () => {
      if (frame !== null) {
        window.cancelAnimationFrame(frame);
      }
      scrollContainer.removeEventListener("scroll", scheduleUpdate);
      window.removeEventListener("resize", scheduleUpdate);
    };
  }, [html, outline]);

  useEffect(() => {
    if (!html || !bodyRef.current) return;

    const timer = window.setTimeout(() => {
      if (bodyRef.current) {
        enhanceCodeBlocks(bodyRef.current, (message) => {
          toastRef.current(message, { type: "success" });
        });
      }
    }, 0);

    return () => {
      window.clearTimeout(timer);
      if (bodyRef.current) {
        removeCodeBlockEnhancements(bodyRef.current);
      }
    };
  }, [html, domVersion]);

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
      window.setTimeout(() => scrollToFragment(fragment), 50);
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
      <DocumentShell outline={outline} activeId={activeId} onAnchorClick={scrollToFragment}>
        <div ref={bodyRef} className="mdr-body">
          <p className="mdr-empty">This file is empty.</p>
        </div>
      </DocumentShell>
    );
  }

  // React 19 rewrites innerHTML whenever the dangerouslySetInnerHTML object
  // identity changes, so an inline `{{ __html }}` would rebuild the whole
  // document DOM on every unrelated re-render (scroll spy, outline updates).
  // Memoize the payload so innerHTML is only written when the HTML changes.
  const htmlPayload = useMemo(() => ({ __html: html }), [html]);

  return (
    <DocumentShell outline={outline} activeId={activeId} onAnchorClick={scrollToFragment}>
      <div
        ref={bodyRef}
        className="mdr-body"
        dangerouslySetInnerHTML={htmlPayload}
      />
    </DocumentShell>
  );
}
