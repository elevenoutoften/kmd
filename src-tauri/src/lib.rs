mod commands;

use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .setup(|app| {
            let data_dir = app
                .path()
                .app_data_dir()
                .expect("failed to resolve app data directory");
            std::fs::create_dir_all(&data_dir).expect("failed to create app data directory");
            app.manage(commands::AppState::new(data_dir));

            // Handle files opened via CLI / double-click
            let args: Vec<String> = std::env::args().skip(1).collect();
            if let Some(first_file) = args.first() {
                let path = first_file.clone();
                let handle = app.handle().clone();
                tauri::async_runtime::spawn(async move {
                    if let Ok(content) = std::fs::read_to_string(&path) {
                        let window = handle.get_webview_window("main");
                        if let Some(w) = window {
                            let _ = w.eval(&format!(
                                "window.__TAURI_OPEN_FILE = {{ path: {}, content: {} }};",
                                serde_json::Value::String(path.clone()),
                                serde_json::Value::String(content)
                            ));
                        }
                    }
                });
            }

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::show_main_window,
            commands::open_document,
            commands::resolve_asset,
            commands::list_recent_files,
            commands::add_recent_file,
            commands::export_html,
        ])
        .run(tauri::generate_context!())
        .expect("error while running kmd");
}
