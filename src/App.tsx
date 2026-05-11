import { useState, useCallback, useEffect, lazy, Suspense } from "react";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { Toast } from "@/components/Toast";
import { ToastProvider, useToast } from "@/hooks/useToast";
import { getInitialTheme, applyTheme, toggleTheme, type Theme } from "@/theme";
import { Reader } from "@/reader/Reader";
import { detectDesignDocumentCheap } from "@/parser/design/detectCheap";
import { checkForAppUpdates } from "@/updater";
import { LoadingSkeleton } from "@/components/LoadingSkeleton";
import { WelcomeScreen } from "@/components/WelcomeScreen";
import { useDocumentState } from "@/hooks/useDocumentState";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";
import { isTauriRuntime } from "@/utils/platform";
import "./App.css";
import "./global.css";
import "./tokens.css";

const LazyDesignMode = lazy(() =>
  import("./components/design/DesignMode").then((m) => ({ default: m.DesignMode }))
);

function getDesignDetection(content: string, filename?: string) {
  const detection = detectDesignDocumentCheap(content, filename);
  const hasDesignData = detection.score > 0;
  const preferredTab: "reader" | "design" =
    detection.score >= detection.threshold ? "design" : "reader";
  return { hasDesignData, preferredTab };
}

async function pickFile(): Promise<string | null> {
  if (!isTauriRuntime()) return null;
  const { open } = await import("@tauri-apps/plugin-dialog");
  const result = await open({
    multiple: false,
    filters: [{ name: "Markdown", extensions: ["md", "markdown"] }],
  });
  return result ?? null;
}

function AppInner() {
  const { toasts, toast, dismiss } = useToast();
  const [theme, setTheme] = useState<Theme>(getInitialTheme);
  const { content, filePath, documentName, openDocument } = useDocumentState();
  const [tab, setTab] = useState<"reader" | "design">(() =>
    content ? getDesignDetection(content, documentName ?? undefined).preferredTab : "reader"
  );
  const [showDesignTab, setShowDesignTab] = useState(() =>
    content ? getDesignDetection(content, documentName ?? undefined).hasDesignData : false
  );
  const [updateStatus, setUpdateStatus] = useState<string | null>(null);
  const [errorKey, setErrorKey] = useState(0);
  const [isExportingDesign, setIsExportingDesign] = useState(false);

  const hasDocument = content.length > 0;

  useEffect(() => {
    if (!content) {
      setShowDesignTab(false);
      setTab("reader");
      return;
    }
    const { hasDesignData, preferredTab } = getDesignDetection(content, documentName ?? undefined);
    setShowDesignTab(hasDesignData);
    if (!hasDesignData) {
      setTab("reader");
    } else {
      setTab(preferredTab);
    }
  }, [content, documentName]);

  useEffect(() => {
    let cancelled = false;

    void checkForAppUpdates((status) => {
      if (!cancelled) {
        setUpdateStatus(status);
      }
    });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!isTauriRuntime()) return;
    let unlisten: (() => void) | undefined;

    (async () => {
      try {
        const { getCurrentWebviewWindow } = await import("@tauri-apps/api/webviewWindow");
        const win = getCurrentWebviewWindow();
        unlisten = await win.listen<string[]>("tauri://file-open", (event) => {
          const paths = event.payload;
          if (paths && paths.length > 0) {
            void openDocument(paths[0]!);
          }
        });
      } catch {
        // File-open events not available in this environment
      }
    })();

    return () => {
      unlisten?.();
    };
  }, [openDocument]);

  useEffect(() => {
    const title = documentName ?? "kmd";
    if (!isTauriRuntime()) {
      document.title = title;
      return;
    }
    void (async () => {
      try {
        const { getCurrentWebviewWindow } = await import("@tauri-apps/api/webviewWindow");
        await getCurrentWebviewWindow().setTitle(title);
      } catch {
        // Non-critical
      }
    })();
  }, [documentName]);

  const handleOpenFile = useCallback(
    async (path: string) => {
      await openDocument(path);
    },
    [openDocument]
  );

  const handlePickFile = useCallback(async () => {
    const path = await pickFile();
    if (path) {
      await openDocument(path);
    }
  }, [openDocument]);

  const handlePrint = useCallback(() => {
    window.print();
  }, []);

  useKeyboardShortcuts({
    onOpenFile: handlePickFile,
    onPrint: handlePrint,
  });

  const handleToggle = useCallback(() => {
    const next = toggleTheme(theme);
    applyTheme(next);
    setTheme(next);
  }, [theme]);

  const handleExportDesignHtml = useCallback(async () => {
    if (!content || !showDesignTab) return;

    setIsExportingDesign(true);
    try {
      const exportHtml = await import("./components/design/exportHtml");
      const defaultFilename = exportHtml.suggestDesignExportFilename(documentName);
      let exportPath: string | null = null;

      if (isTauriRuntime()) {
        const { save } = await import("@tauri-apps/plugin-dialog");
        const selectedPath = await save({
          title: "Export Design Mode HTML",
          defaultPath: defaultFilename,
          filters: [{ name: "HTML", extensions: ["html", "htm"] }],
        });
        if (!selectedPath) return;
        exportPath = exportHtml.ensureHtmlPath(selectedPath);
      }

      const { runDesignPipelineCached } = await import("@/parser/design");
      const doc = runDesignPipelineCached(content);

      if (isTauriRuntime() && exportPath) {
        const { invoke } = await import("@tauri-apps/api/core");
        const html = exportHtml.buildDesignCatalogHtml(doc, {
          theme,
          title: documentName ?? undefined,
        });
        await invoke("export_html", { path: exportPath, html });
        toast("Exported Design Mode HTML.", { type: "success" });
      } else {
        exportHtml.downloadDesignCatalogAsHtml(doc, defaultFilename, {
          theme,
          title: documentName ?? undefined,
        });
        toast("Downloaded Design Mode HTML.", { type: "success" });
      }
    } catch (err) {
      console.error("Failed to export Design Mode HTML:", err);
      toast("Could not export Design Mode HTML.", { type: "error" });
    } finally {
      setIsExportingDesign(false);
    }
  }, [content, documentName, showDesignTab, theme, toast]);

  return (
    <div className="app-shell">
      <header className="toolbar">
        <div className="toolbar-left">
          <span className="toolbar-brand">kmd</span>
          {hasDocument && showDesignTab && (
            <nav className="tab-nav">
              <button
                className={`tab-btn ${tab === "reader" ? "active" : ""}`}
                onClick={() => setTab("reader")}
                type="button"
              >
                Reader
              </button>
              <button
                className={`tab-btn ${tab === "design" ? "active" : ""}`}
                onClick={() => setTab("design")}
                type="button"
              >
                Design
              </button>
            </nav>
          )}
        </div>
        <div className="toolbar-right">
          {updateStatus ? (
            <span className="toolbar-status" role="status">
              {updateStatus}
            </span>
          ) : null}
          {hasDocument && showDesignTab && tab === "design" ? (
            <button
              aria-label="Export Design Mode HTML"
              className="export-html-button"
              disabled={isExportingDesign}
              onClick={handleExportDesignHtml}
              title="Export Design Mode HTML"
              type="button"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M8 2v7" />
                <path d="m5.2 6.4 2.8 2.8 2.8-2.8" />
                <path d="M3 12.5h10" />
              </svg>
            </button>
          ) : null}
          <button
            className="theme-toggle"
            onClick={handleToggle}
            title={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
            type="button"
          >
            {theme === "dark" ? (
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="8" cy="8" r="3.5" />
                <path d="M8 1.5v1M8 13.5v1M1.5 8h1M13.5 8h1M3.4 3.4l.7.7M11.9 11.9l.7.7M3.4 12.6l.7-.7M11.9 4.1l.7-.7" />
              </svg>
            ) : (
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 9.3A6.5 6.5 0 0 1 6.7 2 6.5 6.5 0 1 0 14 9.3z" />
              </svg>
            )}
          </button>
        </div>
      </header>
      {toasts.length > 0 && (
        <div className="toast-container">
          {toasts.map((t) => (
            <Toast key={t.id} entry={t} onClose={() => dismiss(t.id)} />
          ))}
        </div>
      )}
      <main className="app-main">
        {hasDocument ? (
          tab === "reader" ? (
            <ErrorBoundary key={errorKey} onReset={() => setErrorKey((k) => k + 1)}>
              <Reader content={content} filePath={filePath} />
            </ErrorBoundary>
          ) : (
            <ErrorBoundary key={errorKey + 1000} onReset={() => setErrorKey((k) => k + 1)}>
              <Suspense fallback={<LoadingSkeleton />}>
                <LazyDesignMode content={content} />
              </Suspense>
            </ErrorBoundary>
          )
        ) : (
          <WelcomeScreen onOpenFile={handleOpenFile} onPickFile={handlePickFile} />
        )}
      </main>
    </div>
  );
}

export function App() {
  return (
    <ToastProvider>
      <AppInner />
    </ToastProvider>
  );
}
