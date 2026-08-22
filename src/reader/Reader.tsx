import { useState, useEffect, useLayoutEffect, useRef, useCallback } from "react";
import { BrowserReader } from "@axis-love/browser";
import type { HostCapabilities, OutlineEntry } from "@axis-love/kmd-web";
import { DocumentShell } from "@axis-love/kmd-web/react";
import { createKmdWebAdapter } from "@/adapter/kmdWebAdapter";
import { useToast } from "@/hooks/useToast";
import "@axis-love/styles/styles.css";
import "./Reader.css";

interface ReaderProps {
  content: string;
  filePath: string | null;
  onOpenDocument?: (path: string) => void;
}

export function Reader({ content, filePath, onOpenDocument }: ReaderProps) {
  // Keep filePath and onOpenDocument in refs so the adapter (created
  // once) always reads the latest values without recreating on every render.
  const filePathRef = useRef(filePath);
  filePathRef.current = filePath;
  const onOpenDocumentRef = useRef(onOpenDocument);
  onOpenDocumentRef.current = onOpenDocument;
  const pendingFragmentRef = useRef<string | null>(null);
  const [outline, setOutline] = useState<OutlineEntry[]>([]);
  const [activeId, setActiveId] = useState<string | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  // Bumped when the first HTML for a freshly opened document commits.
  const [documentEpoch, setDocumentEpoch] = useState(0);
  const bodyRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLElement | null>(null);
  const readerRef = useRef<BrowserReader | null>(null);
  const { toast } = useToast();
  const toastRef = useRef(toast);
  toastRef.current = toast;

  // Create the HostCapabilities bundle once. It reads filePath and
  // onOpenDocument from refs so it doesn't need to be recreated.
  const capabilitiesRef = useRef<HostCapabilities | null>(null);
  if (!capabilitiesRef.current) {
    capabilitiesRef.current = createKmdWebAdapter({
      getDocPath: () => filePathRef.current,
      onOpenDocument: (path, anchor) => {
        if (anchor) {
          pendingFragmentRef.current = anchor;
        }
        onOpenDocumentRef.current?.(path);
      },
    });
  }

  // Create the BrowserReader once on mount and dispose on unmount.
  useEffect(() => {
    const container = bodyRef.current;
    if (!container) return;

    // Find the scroll container (the .kmd-doc element rendered by DocumentShell).
    const scrollContainer = container.closest<HTMLElement>(".kmd-doc") ?? undefined;
    scrollContainerRef.current = scrollContainer ?? null;

    const reader = new BrowserReader({
      container,
      scrollContainer,
      capabilities: capabilitiesRef.current ?? undefined,
      onOutlineChange: (newOutline) => {
        setOutline([...newOutline]);
      },
      onActiveHeadingChange: (slug) => {
        setActiveId(slug);
      },
      onCopy: (message) => {
        toastRef.current(message, { type: "success" });
      },
      onError: (err) => {
        setError(err.message);
      },
      onRendered: () => {
        setDocumentEpoch((epoch) => epoch + 1);
      },
      // The user-supplied DESIGN.md theme is owned by the app shell
      // (useDesignTheme) and scoped at <html>, so it outlives this reader
      // and the .kmd-reader subtree simply inherits it.
    });

    readerRef.current = reader;

    return () => {
      reader.dispose();
      readerRef.current = null;
    };
  }, []);

  // Update the document when content changes.
  useEffect(() => {
    const reader = readerRef.current;
    if (!reader) return;

    if (content === "") {
      setError(null);
      setOutline([]);
      if (bodyRef.current) {
        bodyRef.current.innerHTML = "";
      }
      return;
    }

    setError(null);

    reader
      .update(content)
      .then(() => {
        // Success — outline and DOM are handled by callbacks.
      })
      .catch((err: unknown) => {
        // BrowserReader's onError callback already handles error state.
        // The catch here is a safety net for any rejection that escapes
        // the reader's own error handling.
        if (err instanceof Error && err.message === "superseded") return;
        const e = err instanceof Error ? err : new Error(String(err));
        setError(e.message);
      });
  }, [content]);

  // Start each newly opened document at the top, in the same frame its
  // content first paints.
  useLayoutEffect(() => {
    if (documentEpoch === 0) return;
    const scrollContainer = scrollContainerRef.current;
    if (scrollContainer) {
      scrollContainer.scrollTop = 0;
    }
  }, [documentEpoch]);

  // Scroll to a pending fragment after the document renders.
  useEffect(() => {
    if (documentEpoch === 0) return;
    const fragment = pendingFragmentRef.current;
    if (fragment) {
      pendingFragmentRef.current = null;
      window.setTimeout(() => {
        const reader = readerRef.current;
        if (reader) {
          reader.scrollToFragment(fragment);
        }
      }, 50);
    }
  }, [documentEpoch]);

  const scrollToFragment = useCallback((fragmentId: string | null) => {
    if (!fragmentId) return;
    const reader = readerRef.current;
    if (reader) {
      reader.scrollToFragment(fragmentId);
    }
  }, []);

  if (error) {
    return (
      <div className="mdr-error kmd-reader">
        <h2>Parse Error</h2>
        <p>{error}</p>
        <pre><code>{content}</code></pre>
      </div>
    );
  }

  if (content === "" && filePath !== null) {
    return (
      <DocumentShell outline={outline} activeId={activeId} onAnchorClick={scrollToFragment}>
        <div ref={bodyRef} className="mdr-body kmd-reader">
          <p className="mdr-empty">This file is empty.</p>
        </div>
      </DocumentShell>
    );
  }

  return (
    <DocumentShell outline={outline} activeId={activeId} onAnchorClick={scrollToFragment}>
      <div ref={bodyRef} className="mdr-body kmd-reader" />
    </DocumentShell>
  );
}