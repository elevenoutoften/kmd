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

function contentKey(content: string): string {
  let hash = 0;
  for (let i = 0; i < Math.min(content.length, 256); i++) {
    hash = ((hash << 5) - hash + content.charCodeAt(i)) | 0;
  }
  return `${content.length}-${hash}`;
}

export function useDocumentState() {
  const [content, setContent] = useState<string>("");
  const [filePath, setFilePath] = useState<string | null>(null);
  const [documentName, setDocumentName] = useState<string | null>(null);

  const lastFileKey = useRef(contentKey(""));

  const openDocument = useCallback(
    async (path: string) => {
      try {
        const info = await invokeOpenDocument(path);
        const key = contentKey(info.content);
        if (key === lastFileKey.current) return;
        lastFileKey.current = key;

        setContent(info.content);
        setFilePath(info.path_label);
        setDocumentName(info.display_name);
      } catch (err) {
        console.error("Failed to open document:", err);
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
