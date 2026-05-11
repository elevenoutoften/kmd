import { useState, useEffect, useCallback } from "react";
import { isTauriRuntime } from "@/utils/platform";

export interface RecentFile {
  path: string;
  display_name: string;
  last_opened_at: number;
}

async function fetchRecentFiles(): Promise<RecentFile[]> {
  if (!isTauriRuntime()) return [];
  try {
    const { invoke } = await import("@tauri-apps/api/core");
    return await invoke<RecentFile[]>("list_recent_files");
  } catch {
    return [];
  }
}

export function useRecentFiles() {
  const [files, setFiles] = useState<RecentFile[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    const result = await fetchRecentFiles();
    setFiles(result);
    setLoading(false);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { files, loading, refresh };
}
