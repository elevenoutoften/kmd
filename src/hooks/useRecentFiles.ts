import { useState, useEffect, useCallback } from "react";
import { isTauriRuntime } from "@/utils/platform";

export interface RecentFile {
  path: string;
  display_name: string;
  last_opened_at: number;
}

function normalizeRecentPathKey(path: string): string {
  const slashed = path.replace(/\\/g, "/").replace(/\/+$/, "");
  const withoutWindowsFileSlash = /^\/[a-zA-Z]:\//.test(slashed) ? slashed.slice(1) : slashed;

  return withoutWindowsFileSlash.toLowerCase();
}

function recentFileIdentity(file: RecentFile): string {
  const path = file.path.trim();

  try {
    const url = new URL(path);
    if (url.protocol === "file:") {
      return normalizeRecentPathKey(decodeURIComponent(url.pathname));
    }
  } catch {
    // Plain filesystem paths are handled below.
  }

  return normalizeRecentPathKey(path);
}

export function dedupeRecentFiles(files: RecentFile[]): RecentFile[] {
  const sorted = [...files].sort((a, b) => b.last_opened_at - a.last_opened_at);
  const seen = new Set<string>();
  const deduped: RecentFile[] = [];

  for (const file of sorted) {
    const key = recentFileIdentity(file);
    if (seen.has(key)) continue;

    seen.add(key);
    deduped.push(file);
  }

  return deduped;
}

async function fetchRecentFiles(): Promise<RecentFile[]> {
  if (!isTauriRuntime()) return [];
  try {
    const { invoke } = await import("@tauri-apps/api/core");
    const files = await invoke<RecentFile[]>("list_recent_files");
    return dedupeRecentFiles(files);
  } catch {
    return [];
  }
}

// Session cache so returning to the welcome screen paints the last known
// list immediately instead of flashing a loading state, then refreshes
// silently in the background.
let recentFilesCache: RecentFile[] | null = null;

export function useRecentFiles() {
  const [files, setFiles] = useState<RecentFile[]>(() => recentFilesCache ?? []);
  const [loading, setLoading] = useState(recentFilesCache === null);

  const refresh = useCallback(async () => {
    if (recentFilesCache === null) {
      setLoading(true);
    }
    const result = await fetchRecentFiles();
    recentFilesCache = result;
    setFiles(result);
    setLoading(false);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { files, loading, refresh };
}
