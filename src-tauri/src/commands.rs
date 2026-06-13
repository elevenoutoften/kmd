use std::fs;
use std::path::{Path, PathBuf};
use std::sync::Mutex;
use std::time::{SystemTime, UNIX_EPOCH};

use base64::Engine;
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Manager, State, Url};

const MAX_RECENT_FILES: usize = 50;

// ---------------------------------------------------------------------------
// Return types aligned with the IPC contract in docs/planning/07-cross-platform-technical-architecture.md.
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
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
        let (recent_files, should_persist) = Self::load_recent_files(&data_dir);
        let state = Self {
            recent_files: Mutex::new(recent_files),
            data_dir,
        };

        // If loading dropped dead or duplicate entries, write the cleaned list back.
        if should_persist {
            state.persist_recent_files().ok();
        }

        state
    }

    /// Load the recent-files list, dropping duplicates and entries whose files
    /// no longer exist. The bool reports whether the cleaned list differs from
    /// what was on disk, so the caller can persist the cleanup.
    fn load_recent_files(data_dir: &Path) -> (Vec<RecentFileEntry>, bool) {
        let path = data_dir.join("recent_files.json");
        let files: Vec<RecentFileEntry> = fs::read_to_string(&path)
            .ok()
            .and_then(|s| serde_json::from_str(&s).ok())
            .unwrap_or_default();
        let cleaned = clean_recent_entries(files.clone());
        let should_persist = cleaned != files;

        (cleaned, should_persist)
    }

    fn persist_recent_files(&self) -> Result<(), String> {
        let files = self.recent_files.lock().map_err(|e| e.to_string())?;
        let json = serde_json::to_string_pretty(&*files).map_err(|e| e.to_string())?;
        fs::write(self.data_dir.join("recent_files.json"), json).map_err(|e| e.to_string())
    }

    /// Remove every entry that points at the same file as `path`.
    fn remove_recent(&self, path: &str) -> Result<(), String> {
        let target = RecentFileEntry {
            path: path.to_string(),
            display_name: String::new(),
            last_opened_at: 0,
        };

        {
            let mut files = self.recent_files.lock().map_err(|e| e.to_string())?;
            files.retain(|entry| !same_recent_file_identity(entry, &target));
        }

        self.persist_recent_files()
    }

    /// Upsert a path into the recent-files list (retain/insert/truncate/persist).
    /// Entries that resolve to the same file -- or stale duplicates that share a
    /// display name but whose own file is gone -- are collapsed into the new one.
    fn upsert_recent(&self, path: &str, display_name: &str) -> Result<(), String> {
        let entry = RecentFileEntry {
            path: path.to_string(),
            display_name: display_name.to_string(),
            last_opened_at: system_time_to_secs(SystemTime::now()),
        };
        {
            let mut files = self.recent_files.lock().map_err(|e| e.to_string())?;
            files.retain(|f| {
                !same_recent_file_identity(f, &entry) && !is_obsolete_duplicate(f, &entry)
            });
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

/// True for `C:\...` / `C:/...` style Windows paths, which must not be parsed
/// as URLs (the drive letter would otherwise look like a URL scheme).
fn is_windows_drive_path(target: &str) -> bool {
    let bytes = target.as_bytes();
    bytes.len() >= 3
        && bytes[0].is_ascii_alphabetic()
        && bytes[1] == b':'
        && (bytes[2] == b'\\' || bytes[2] == b'/')
}

/// Accept either a plain filesystem path or a `file://` URL (as delivered by
/// the macOS "Opened" event) and return the filesystem path.
fn normalize_document_target(target: &str) -> Result<PathBuf, String> {
    if !is_windows_drive_path(target) {
        if let Ok(url) = Url::parse(target) {
            if url.scheme() != "file" {
                return Err(format!("unsupported document URL scheme: {}", url.scheme()));
            }

            return url
                .to_file_path()
                .map_err(|_| format!("invalid file URL: {target}"));
        }
    }

    Ok(PathBuf::from(target))
}

fn display_name_for_path(path: &Path) -> String {
    path.file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("unknown")
        .to_string()
}

fn path_label_for_path(path: &Path) -> String {
    path.to_string_lossy().into_owned()
}

/// Canonical key used to tell whether two recent-file entries point at the same
/// file: resolves symlinks, unifies path separators, and folds case on Windows.
fn normalized_path_key(path: &Path) -> String {
    let resolved = path.canonicalize().unwrap_or_else(|_| path.to_path_buf());
    let key = resolved.to_string_lossy().replace('\\', "/");

    if cfg!(windows) {
        key.to_ascii_lowercase()
    } else {
        key
    }
}

fn recent_file_identity(path: &str) -> String {
    normalize_document_target(path)
        .map(|normalized| normalized_path_key(&normalized))
        .unwrap_or_else(|_| {
            let key = path.trim().replace('\\', "/");
            if cfg!(windows) {
                key.to_ascii_lowercase()
            } else {
                key
            }
        })
}

fn same_recent_file_identity(a: &RecentFileEntry, b: &RecentFileEntry) -> bool {
    recent_file_identity(&a.path) == recent_file_identity(&b.path)
}

/// Collapse entries that point at the same file, keeping the most recently
/// opened row, then cap the list length.
fn dedupe_recent_entries(files: Vec<RecentFileEntry>) -> Vec<RecentFileEntry> {
    let mut files = files;
    files.sort_by(|a, b| b.last_opened_at.cmp(&a.last_opened_at));

    let mut deduped: Vec<RecentFileEntry> = Vec::with_capacity(files.len());

    for file in files {
        if !deduped
            .iter()
            .any(|existing| same_recent_file_identity(existing, &file))
        {
            deduped.push(file);
        }
    }

    deduped.truncate(MAX_RECENT_FILES);
    deduped
}

/// Dedupe and then drop entries whose files no longer exist.
fn clean_recent_entries(files: Vec<RecentFileEntry>) -> Vec<RecentFileEntry> {
    dedupe_recent_entries(files)
        .into_iter()
        .filter(|entry| !recent_entry_is_obsolete(entry))
        .collect()
}

fn recent_entry_is_obsolete(entry: &RecentFileEntry) -> bool {
    normalize_document_target(&entry.path)
        .map(|path| !path.exists())
        .unwrap_or(true)
}

/// A previous entry that shares a display name with the replacement but whose
/// own file is gone -- e.g. the file moved and is being re-added from a new
/// location, so the dangling old row should be dropped.
fn is_obsolete_duplicate(existing: &RecentFileEntry, replacement: &RecentFileEntry) -> bool {
    existing.display_name == replacement.display_name && recent_entry_is_obsolete(existing)
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
/// Accepts a plain filesystem path or a `file://` URL. Records the file in the
/// recent-files list, and prunes the recent entry if the file has gone missing.
#[tauri::command]
pub fn open_document(path: String, state: State<'_, AppState>) -> Result<DocumentInfo, String> {
    eprintln!("[kmd:file-open] open_document called with path: {:?}", path);
    let normalized = normalize_document_target(&path)?;
    let file_path = normalized.as_path();

    if !file_path.exists() {
        let _ = state.remove_recent(&path);
        return Err(format!("file not found: {path}"));
    }
    if !file_path.is_file() {
        let _ = state.remove_recent(&path);
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

    let display_name = display_name_for_path(file_path);
    let path_label = path_label_for_path(file_path);
    let base_dir = file_path
        .parent()
        .map(path_label_for_path)
        .unwrap_or_default();

    let id = file_path
        .canonicalize()
        .map(|p| p.to_string_lossy().into_owned())
        .unwrap_or_else(|_| path_label.clone());

    let info = DocumentInfo {
        id,
        display_name: display_name.clone(),
        path_label: path_label.clone(),
        content,
        base_dir,
        modified_at,
        size,
        encoding_warning,
    };

    // Record in recent files using the normalized filesystem path, so the same
    // file opened via a file:// URL or a raw path collapses to one entry.
    state.upsert_recent(&path_label, &display_name)?;

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

/// Return the current recent-files list, most recent first. Drops dead or
/// duplicate entries on the way (and persists the cleanup).
#[tauri::command]
pub fn list_recent_files(state: State<'_, AppState>) -> Result<Vec<RecentFileEntry>, String> {
    let mut should_persist = false;
    let files = {
        let mut files = state.recent_files.lock().map_err(|e| e.to_string())?;
        let cleaned = clean_recent_entries(files.clone());
        if cleaned != *files {
            *files = cleaned.clone();
            should_persist = true;
        }
        cleaned
    };

    if should_persist {
        state.persist_recent_files()?;
    }

    Ok(files)
}

/// Add or update a path in the recent-files list.
#[tauri::command]
pub fn add_recent_file(
    path: String,
    state: State<'_, AppState>,
) -> Result<(), String> {
    let normalized = normalize_document_target(&path).unwrap_or_else(|_| PathBuf::from(&path));
    let display_name = display_name_for_path(&normalized);

    state.upsert_recent(&path_label_for_path(&normalized), &display_name)
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

#[cfg(test)]
mod tests {
    use super::{
        canonicalize_under_base, clean_recent_entries, dedupe_recent_entries,
        is_obsolete_duplicate, normalize_document_target, RecentFileEntry,
    };
    use std::fs;
    use std::time::{SystemTime, UNIX_EPOCH};

    #[test]
    fn normalize_document_target_accepts_plain_paths() {
        let path = "/tmp/readme.md";
        let normalized = normalize_document_target(path).expect("plain path should parse");
        assert_eq!(normalized.to_string_lossy(), path);
    }

    #[cfg(windows)]
    #[test]
    fn normalize_document_target_accepts_windows_drive_paths() {
        let path = r"C:\Users\me\readme.md";
        let normalized = normalize_document_target(path).expect("Windows path should parse");

        assert_eq!(normalized, std::path::PathBuf::from(path));
    }

    #[test]
    fn normalize_document_target_accepts_file_urls() {
        let path = std::env::temp_dir().join("kmd-readme.md");
        let url = tauri::Url::from_file_path(&path).expect("temp path should become a file URL");
        let normalized = normalize_document_target(url.as_str()).expect("file URL should parse");

        assert_eq!(normalized, path);
    }

    #[test]
    fn normalize_document_target_rejects_non_file_urls() {
        let err = normalize_document_target("https://example.com/readme.md")
            .expect_err("non-file URL should be rejected");
        assert!(err.contains("unsupported document URL scheme"));
    }

    #[test]
    fn recent_dedupe_keeps_newest_entry() {
        let path = std::env::temp_dir().join("kmd-recent-readme.md");
        let file_url =
            tauri::Url::from_file_path(&path).expect("temp path should become a file URL");
        let older = RecentFileEntry {
            path: path.to_string_lossy().into_owned(),
            display_name: "readme.md".to_string(),
            last_opened_at: 10,
        };
        let newer = RecentFileEntry {
            path: file_url.to_string(),
            display_name: "readme.md".to_string(),
            last_opened_at: 30,
        };

        assert_eq!(
            dedupe_recent_entries(vec![older, newer.clone()]),
            vec![newer]
        );
    }

    #[test]
    fn obsolete_duplicate_matches_same_display_name_only_when_old_path_is_missing() {
        let stale = RecentFileEntry {
            path: "/tmp/kmd-definitely-missing-readme.md".to_string(),
            display_name: "readme.md".to_string(),
            last_opened_at: 10,
        };
        let replacement = RecentFileEntry {
            path: "/tmp/other/readme.md".to_string(),
            display_name: "readme.md".to_string(),
            last_opened_at: 30,
        };

        assert!(is_obsolete_duplicate(&stale, &replacement));
    }

    #[test]
    fn clean_recent_entries_drops_missing_paths() {
        let unique = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .expect("system time should be after epoch")
            .as_nanos();
        let missing = std::env::temp_dir().join(format!("kmd-missing-{unique}.md"));
        let existing = std::env::temp_dir().join(format!("kmd-existing-{unique}.md"));
        fs::write(&existing, "# Existing").expect("existing recent file should be created");

        let cleaned = clean_recent_entries(vec![
            RecentFileEntry {
                path: missing.to_string_lossy().into_owned(),
                display_name: "missing.md".to_string(),
                last_opened_at: 20,
            },
            RecentFileEntry {
                path: existing.to_string_lossy().into_owned(),
                display_name: "existing.md".to_string(),
                last_opened_at: 10,
            },
        ]);

        assert_eq!(cleaned.len(), 1);
        assert_eq!(cleaned[0].display_name, "existing.md");

        fs::remove_file(&existing).ok();
    }

    #[test]
    fn canonicalize_under_base_rejects_path_traversal() {
        let unique = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .expect("system time should be after epoch")
            .as_nanos();
        let root = std::env::temp_dir().join(format!("kmd-commands-test-{unique}"));
        let base = root.join("docs");
        let outside = root.join("outside");
        fs::create_dir_all(&base).expect("base dir should be created");
        fs::create_dir_all(&outside).expect("outside dir should be created");

        let err = canonicalize_under_base(&base, &outside.join("../outside/secret.png"))
            .expect_err("target outside the base directory should be rejected");
        assert!(err.contains("path traversal rejected"));

        fs::remove_dir_all(&root).ok();
    }
}
