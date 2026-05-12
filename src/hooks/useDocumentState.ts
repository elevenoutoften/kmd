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

  const openDocument = useCallback(
    async (path: string) => {
      try {
        if (path === lastOpenedPath.current) return;

        const info = await invokeOpenDocument(path);
        lastOpenedPath.current = info.path_label;

        setContent(info.content);
        setFilePath(info.path_label);
        setDocumentName(info.display_name);
      } catch (err) {
        console.error("Failed to open document:", err);
        throw err; // Re-throw so callers (e.g. file-open handlers) can show user-facing errors
      }
    },
    []
  );

  return {
    content,
    filePath,
    documentName,
    openDocument,
  };
}
