use std::fs;
use std::path::{Path, PathBuf};
use std::sync::Mutex;
use std::time::{SystemTime, UNIX_EPOCH};

use base64::Engine;
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Manager, State};

const MAX_RECENT_FILES: usize = 50;

// ---------------------------------------------------------------------------
// Return types aligned with the IPC contract in docs/planning/07-cross-platform-technical-architecture.md.
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RecentFileEntry {
    pub path: String,
    pub display_name: String,
    pub last_opened_at: u64,
}

#[derive(Debug, Serialize)]
pub struct DocumentInfo {
    pub id: String,
    pub display_name: String,
    pub path_label: String,
    pub content: String,
    pub base_dir: String,
    pub modified_at: u64,
    pub size: u64,
    pub encoding_warning: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct AssetData {
    pub mime_type: String,
    pub bytes_base64: String,
}

#[derive(Debug, Serialize)]
pub struct ResolvedLocalPath {
    pub absolute_path: String,
    pub is_dir: bool,
}

// ---------------------------------------------------------------------------
// Shared state
// ---------------------------------------------------------------------------

pub struct OpenedUrls(pub Mutex<Vec<String>>);

pub struct AppState {
    recent_files: Mutex<Vec<RecentFileEntry>>,
    data_dir: PathBuf,
}

impl AppState {
    pub fn new(data_dir: PathBuf) -> Self {
        fs::create_dir_all(&data_dir).ok();
        let recent_files = Self::load_recent_files(&data_dir);
        Self {
            recent_files: Mutex::new(recent_files),
            data_dir,
        }
    }

    fn load_recent_files(data_dir: &Path) -> Vec<RecentFileEntry> {
        let path = data_dir.join("recent_files.json");
        fs::read_to_string(&path)
            .ok()
            .and_then(|s| serde_json::from_str(&s).ok())
            .unwrap_or_default()
    }

    fn persist_recent_files(&self) -> Result<(), String> {
        let files = self.recent_files.lock().map_err(|e| e.to_string())?;
        let json = serde_json::to_string_pretty(&*files).map_err(|e| e.to_string())?;
        fs::write(self.data_dir.join("recent_files.json"), json).map_err(|e| e.to_string())
    }

    /// Upsert a path into the recent-files list (retain/insert/truncate/persist).
    fn upsert_recent(&self, path: &str, display_name: &str) -> Result<(), String> {
        let now = system_time_to_secs(SystemTime::now());
        {
            let mut files = self.recent_files.lock().map_err(|e| e.to_string())?;
            let entry = RecentFileEntry {
                path: path.to_string(),
                display_name: display_name.to_string(),
                last_opened_at: now,
            };
            files.retain(|f| f.path != path);
            files.insert(0, entry);
            files.truncate(MAX_RECENT_FILES);
        }
        self.persist_recent_files()
    }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

fn guess_mime_type(path: &Path) -> String {
    match path
        .extension()
        .and_then(|e| e.to_str())
        .map(|e| e.to_lowercase())
        .as_deref()
    {
        Some("png") => "image/png",
        Some("jpg") | Some("jpeg") => "image/jpeg",
        Some("gif") => "image/gif",
        Some("svg") => "image/svg+xml",
        Some("webp") => "image/webp",
        Some("ico") => "image/x-icon",
        Some("bmp") => "image/bmp",
        Some("pdf") => "application/pdf",
        Some("txt") => "text/plain",
        Some("html") | Some("htm") => "text/html",
        Some("css") => "text/css",
        Some("js") => "application/javascript",
        _ => "application/octet-stream",
    }
    .to_string()
}

/// Canonicalize `target` and verify it sits under `base`.
/// Handles symlinks and `..` components.
/// Returns the canonical absolute path on success.
fn canonicalize_under_base(base: &Path, target: &Path) -> Result<PathBuf, String> {
    let canonical_base = base
        .canonicalize()
        .map_err(|e| format!("cannot canonicalize base path: {e}"))?;

    let canonical_target = if target.exists() {
        target
            .canonicalize()
            .map_err(|e| format!("cannot canonicalize asset path: {e}"))?
    } else {
        // Target doesn't exist yet — resolve the parent and append the filename
        // so we can still reject traversal even for missing files.
        let parent = target
            .parent()
            .ok_or_else(|| "asset path has no parent directory".to_string())?;
        let filename = target
            .file_name()
            .ok_or_else(|| "asset path has no filename".to_string())?;
        let canonical_parent = parent
            .canonicalize()
            .map_err(|e| format!("cannot canonicalize asset parent: {e}"))?;
        canonical_parent.join(filename)
    };

    if !canonical_target.starts_with(&canonical_base) {
        return Err(
            "path traversal rejected: asset is outside document base folder".to_string(),
        );
    }

    Ok(canonical_target)
}

fn system_time_to_secs(time: SystemTime) -> u64 {
    time.duration_since(UNIX_EPOCH).unwrap_or_default().as_secs()
}

// ---------------------------------------------------------------------------
// Tauri commands
// ---------------------------------------------------------------------------

/// Show and focus the main window once the React app has mounted.
#[tauri::command]
pub fn show_main_window(app: AppHandle) -> Result<(), String> {
    eprintln!("[kmd:boot] show_main_window called");

    let window = app.get_webview_window("main").ok_or_else(|| {
        let message = "main window not found".to_string();
        eprintln!("[kmd:boot] show_main_window error: {message}");
        message
    })?;

    window.show().map_err(|e| {
        let message = format!("failed to show main window: {e}");
        eprintln!("[kmd:boot] show_main_window error: {message}");
        message
    })?;
    eprintln!("[kmd:boot] main window shown");

    window.set_focus().map_err(|e| {
        let message = format!("failed to focus main window: {e}");
        eprintln!("[kmd:boot] show_main_window error: {message}");
        message
    })?;
    eprintln!("[kmd:boot] main window focused");

    Ok(())
}

#[tauri::command]
pub fn get_opened_urls(app: tauri::AppHandle) -> Vec<String> {
    app.state::<OpenedUrls>().0.lock().unwrap().clone()
}

/// Open a Markdown file, read its contents, and return document metadata.
/// Also records the file in the recent-files list.
#[tauri::command]
pub fn open_document(
    path: String,
    state: State<'_, AppState>,
) -> Result<DocumentInfo, String> {
    eprintln!("[kmd:file-open] open_document called with path: {:?}", path);
    let file_path = Path::new(&path);

    if !file_path.exists() {
        return Err(format!("file not found: {path}"));
    }
    if !file_path.is_file() {
        return Err(format!("not a file: {path}"));
    }

    let metadata =
        fs::metadata(file_path).map_err(|e| format!("cannot read file metadata: {e}"))?;
    let size = metadata.len();
    let modified_at = metadata
        .modified()
        .map(system_time_to_secs)
        .unwrap_or(0);

    let bytes = fs::read(file_path).map_err(|e| format!("cannot read file: {e}"))?;

    let (content, encoding_warning) = match String::from_utf8(bytes) {
        Ok(s) => (s, None),
        Err(err) => {
            let lossy = String::from_utf8_lossy(err.as_bytes()).into_owned();
            (
                lossy,
                Some(
                    "file contains non-UTF-8 bytes; some characters were replaced".to_string(),
                ),
            )
        }
    };

    let display_name = file_path
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("unknown")
        .to_string();

    let base_dir = file_path
        .parent()
        .and_then(|p| p.to_str())
        .unwrap_or("")
        .to_string();

    let id = file_path
        .canonicalize()
        .map(|p| p.to_string_lossy().into_owned())
        .unwrap_or_else(|_| path.clone());

    let info = DocumentInfo {
        id,
        display_name: display_name.clone(),
        path_label: path.clone(),
        content,
        base_dir,
        modified_at,
        size,
        encoding_warning,
    };

    // Record in recent files
    state.upsert_recent(&path, &display_name)?;

    Ok(info)
}

/// Resolve a relative asset path under the document's base folder.
/// Rejects path-traversal attempts (anything outside the base dir).
/// Returns the asset bytes as base64 with an inferred MIME type.
#[tauri::command]
pub fn resolve_asset(
    doc_path: String,
    relative_path: String,
) -> Result<AssetData, String> {
    let doc = Path::new(&doc_path);

    if !doc.is_file() {
        return Err(format!("document does not exist: {doc_path}"));
    }

    let base_dir = doc
        .parent()
        .ok_or_else(|| "document path has no parent directory".to_string())?;

    let resolved = base_dir.join(&relative_path);

    // Security: canonicalize and verify the resolved path is under the base dir.
    let canonical = canonicalize_under_base(base_dir, &resolved)?;

    if !canonical.is_file() {
        return Err(format!("asset not found: {relative_path}"));
    }

    let mime_type = guess_mime_type(&canonical);
    let bytes = fs::read(&canonical).map_err(|e| format!("cannot read asset: {e}"))?;
    let bytes_base64 = base64::engine::general_purpose::STANDARD.encode(&bytes);

    Ok(AssetData {
        mime_type,
        bytes_base64,
    })
}

/// Resolve a relative link path under the document's base folder.
/// Returns the absolute path and whether it's a directory.
/// Rejects path-traversal attempts.
#[tauri::command]
pub fn resolve_local_path(
    doc_path: String,
    relative_path: String,
) -> Result<ResolvedLocalPath, String> {
    let doc = Path::new(&doc_path);

    if !doc.is_file() {
        return Err(format!("document does not exist: {doc_path}"));
    }

    let base_dir = doc
        .parent()
        .ok_or_else(|| "document path has no parent directory".to_string())?;

    let resolved = base_dir.join(&relative_path);

    let canonical = canonicalize_under_base(base_dir, &resolved)?;

    let is_dir = canonical.is_dir();

    if !canonical.is_file() && !is_dir {
        return Err(format!("path not found: {relative_path}"));
    }

    Ok(ResolvedLocalPath {
        absolute_path: canonical.to_string_lossy().into_owned(),
        is_dir,
    })
}

/// Return the current recent-files list, most recent first.
#[tauri::command]
pub fn list_recent_files(state: State<'_, AppState>) -> Result<Vec<RecentFileEntry>, String> {
    let files = state.recent_files.lock().map_err(|e| e.to_string())?;
    Ok(files.clone())
}

/// Add or update a path in the recent-files list.
#[tauri::command]
pub fn add_recent_file(
    path: String,
    state: State<'_, AppState>,
) -> Result<(), String> {
    let display_name = Path::new(&path)
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("unknown")
        .to_string();

    state.upsert_recent(&path, &display_name)
}

/// Write a user-initiated standalone HTML export.
#[tauri::command]
pub fn export_html(path: String, html: String) -> Result<(), String> {
    let export_path = Path::new(&path);
    let extension = export_path
        .extension()
        .and_then(|ext| ext.to_str())
        .unwrap_or("")
        .to_ascii_lowercase();

    if extension != "html" && extension != "htm" {
        return Err("HTML exports must use an .html or .htm extension".to_string());
    }

    if let Some(parent) = export_path.parent() {
        if !parent.as_os_str().is_empty() && !parent.exists() {
            fs::create_dir_all(parent)
                .map_err(|e| format!("cannot create export directory: {e}"))?;
        }
    }

    fs::write(export_path, html).map_err(|e| format!("cannot write HTML export: {e}"))
}
