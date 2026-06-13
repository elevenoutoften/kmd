import { useState, useCallback, useRef } from "react";

interface DocumentInfo {
  id: string;
  display_name: string;
  path_label: string;
  content: string;
  base_dir: string;
  modified_at: number;
  size: number;
  encoding_warning: string | null;
}

async function invokeOpenDocument(path: string): Promise<DocumentInfo> {
  const { invoke } = await import("@tauri-apps/api/core");
  return invoke<DocumentInfo>("open_document", { path });
}

export function useDocumentState() {
  const [content, setContent] = useState<string>("");
  const [filePath, setFilePath] = useState<string | null>(null);
  const [documentName, setDocumentName] = useState<string | null>(null);

  const lastOpenedPath = useRef<string | null>(null);
  // Paths with an open_document call in flight, so a duplicate request (e.g. the
  // "opened" event and the get_opened_urls poll firing for the same file) does
  // not open the document twice.
  const openingPaths = useRef(new Set<string>());

  const openDocument = useCallback(
    async (path: string) => {
      if (path === lastOpenedPath.current || openingPaths.current.has(path)) return;

      openingPaths.current.add(path);
      try {
        const info = await invokeOpenDocument(path);
        lastOpenedPath.current = info.path_label;

        setContent(info.content);
        setFilePath(info.path_label);
        setDocumentName(info.display_name);
      } catch (err) {
        console.error("Failed to open document:", err);
        throw err; // Re-throw so callers (e.g. file-open handlers) can show user-facing errors
      } finally {
        openingPaths.current.delete(path);
      }
    },
    []
  );

  const closeDocument = useCallback(() => {
    lastOpenedPath.current = null;
    openingPaths.current.clear();
    setContent("");
    setFilePath(null);
    setDocumentName(null);
  }, []);

  return {
    content,
    filePath,
    documentName,
    openDocument,
    closeDocument,
  };
}
