interface TauriOpenFile {
  path: string;
  content: string;
}

interface Window {
  __TAURI_OPEN_FILE?: TauriOpenFile;
}
