mod commands;

use std::sync::Mutex;
use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .manage(commands::OpenedUrls(Mutex::new(vec![])))
        .setup(|app| {
            let data_dir = app
                .path()
                .app_data_dir()
                .expect("failed to resolve app data directory");
            std::fs::create_dir_all(&data_dir).expect("failed to create app data directory");
            app.manage(commands::AppState::new(data_dir));

            let args: Vec<String> = std::env::args().skip(1).collect();
            if let Some(first_file) = args.first() {
                let path = first_file.clone();
                eprintln!("[kmd:boot] CLI arg file: {:?}", path);
                app.state::<commands::OpenedUrls>()
                    .0
                    .lock()
                    .unwrap()
                    .push(path.clone());
                let _ = app.emit("opened", vec![path]);
            }

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::get_opened_urls,
            commands::open_document,
            commands::resolve_asset,
            commands::list_recent_files,
            commands::add_recent_file,
            commands::export_html,
        ])
        .build(tauri::generate_context!())
        .expect("error while running kmd")
        .run(|app, event| {
            #[cfg(target_os = "macos")]
            if let tauri::RunEvent::Opened { urls } = event {
                let paths: Vec<String> = urls
                    .iter()
                    .filter_map(|u| u.to_file_path().ok())
                    .map(|p| p.to_string_lossy().into_owned())
                    .collect();
                if !paths.is_empty() {
                    eprintln!("[kmd:boot] RunEvent::Opened: {:?}", paths);
                    app.state::<commands::OpenedUrls>()
                        .0
                        .lock()
                        .unwrap()
                        .extend(paths.clone());
                    let _ = app.emit("opened", paths);
                }
            }
        });
}
