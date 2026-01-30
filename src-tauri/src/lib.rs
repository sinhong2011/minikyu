//! Tauri application library entry point.
//!
//! This module serves as the main entry point for the Tauri application.
//! Command implementations are organized in the `commands` module,
//! and shared types are in the `types` module.

mod bindings;
mod commands;
mod database;
mod miniflux;
mod types;
mod utils;

use tauri::Manager;

// Re-export only what's needed externally
pub use types::DEFAULT_QUICK_PANE_SHORTCUT;

// Miniflux state
use commands::miniflux::MinifluxState;

/// Application entry point. Sets up all plugins and initializes the app.
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // Load environment variables from .env file in development
    // This is done early to ensure all environment-dependent configuration
    // can use values from the .env file
    if cfg!(debug_assertions) {
        match dotenvy::dotenv() {
            Ok(path) => {
                eprintln!("Loaded environment from: {}", path.display());
            }
            Err(e) if e.not_found() => {
                // .env file not found - this is fine, we'll use system env vars or defaults
                eprintln!("No .env file found, using system environment variables");
            }
            Err(e) => {
                // Other error (permissions, malformed file, etc.) - log but don't panic
                eprintln!("Warning: Failed to load .env file: {}", e);
            }
        }
    }

    let builder = bindings::generate_bindings();

    // Export TypeScript bindings in debug builds
    #[cfg(debug_assertions)]
    bindings::export_ts_bindings();

    // Build with common plugins
    let mut app_builder = tauri::Builder::default();

    // Single instance plugin must be registered FIRST
    // When user tries to open a second instance, toggle window visibility
    #[cfg(desktop)]
    {
        app_builder = app_builder.plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            use commands::tray::{hide_main_window, show_main_window};

            if let Some(window) = app.get_webview_window("main") {
                // Toggle window visibility: show if hidden, hide if visible
                match window.is_visible() {
                    Ok(true) => {
                        let _ = hide_main_window(app);
                    }
                    Ok(false) => {
                        let _ = show_main_window(app);
                    }
                    Err(e) => {
                        log::error!("Failed to check window visibility: {e}");
                        // Fallback: try to show the window
                        let _ = window.set_focus();
                        let _ = window.unminimize();
                    }
                }
            }
        }));
    }

    // Window state plugin - saves/restores window position and size
    // Note: Only applies to windows listed in capabilities (main window only, not quick-pane)
    #[cfg(desktop)]
    {
        app_builder = app_builder.plugin(
            tauri_plugin_window_state::Builder::new()
                .with_state_flags(tauri_plugin_window_state::StateFlags::all())
                .build(),
        );
    }

    // Updater plugin for in-app updates
    #[cfg(desktop)]
    {
        app_builder = app_builder.plugin(tauri_plugin_updater::Builder::new().build());
    }

    // Determine log level from environment variable or use defaults
    let log_level = utils::logger::get_log_level_from_env();

    app_builder = app_builder
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(
            tauri_plugin_log::Builder::new()
                // Use level from TAURI_LOG_LEVEL env var, or default based on build type
                .level(log_level)
                // Use custom formatter with syntax highlighting for terminal output
                .format(utils::logger::format_log)
                .targets([
                    // Always log to stdout for development with colorized output
                    tauri_plugin_log::Target::new(tauri_plugin_log::TargetKind::Stdout),
                    // Log to webview console for development
                    tauri_plugin_log::Target::new(tauri_plugin_log::TargetKind::Webview),
                    // Log to system logs on macOS (appears in Console.app)
                    #[cfg(target_os = "macos")]
                    tauri_plugin_log::Target::new(tauri_plugin_log::TargetKind::LogDir {
                        file_name: None,
                    }),
                ])
                .build(),
        );

    // macOS: Add NSPanel plugin for native panel behavior
    #[cfg(target_os = "macos")]
    {
        app_builder = app_builder.plugin(tauri_nspanel::init());
    }

    // MCP Bridge plugin for debugging/driver connection (debug builds only with feature flag)
    #[cfg(all(debug_assertions, feature = "mcp-bridge"))]
    {
        app_builder = app_builder.plugin(tauri_plugin_mcp_bridge::init());
    }

    app_builder
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_persisted_scope::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_os::init())
        .manage(MinifluxState {
            client: std::sync::Arc::new(tokio::sync::Mutex::new(None)),
        })
        .setup(|app| {
            log::info!("Application starting up");
            log::debug!(
                "App handle initialized for package: {}",
                app.package_info().name
            );

            // Set up global shortcut plugin (without any shortcuts - we register them separately)
            #[cfg(desktop)]
            {
                use tauri_plugin_global_shortcut::Builder;

                app.handle().plugin(Builder::new().build())?;
            }

            // Load saved preferences and register the quick pane shortcut
            #[cfg(desktop)]
            {
                let saved_shortcut = commands::preferences::load_quick_pane_shortcut(app.handle());
                let shortcut_to_register = saved_shortcut
                    .as_deref()
                    .unwrap_or(DEFAULT_QUICK_PANE_SHORTCUT);

                log::info!("Registering quick pane shortcut: {shortcut_to_register}");
                commands::quick_pane::register_quick_pane_shortcut(
                    app.handle(),
                    shortcut_to_register,
                )?;
            }

            // Create the quick pane window (hidden) - must be done on main thread
            if let Err(e) = commands::quick_pane::init_quick_pane(app.handle()) {
                log::error!("Failed to create quick pane: {e}");
                // Non-fatal: app can still run without quick pane
            }

            // Initialize system tray icon (desktop only)
            #[cfg(desktop)]
            {
                // Load preferences to check if tray should be shown
                let prefs = commands::preferences::load_preferences_sync(app.handle());
                let show_tray = prefs.as_ref().map(|p| p.show_tray_icon).unwrap_or(true);

                if show_tray {
                    if let Err(e) = commands::tray::init_tray(app.handle()) {
                        log::error!("Failed to initialize tray: {e}");
                        // Non-fatal: app can still run without tray
                    }
                }

                // Handle start minimized preference
                if prefs.map(|p| p.start_minimized).unwrap_or(false) {
                    if let Some(window) = app.get_webview_window("main") {
                        let _ = window.hide();
                        log::info!("Starting minimized to tray");
                    }
                }
            }

            // NOTE: Application menu is built from JavaScript for i18n support
            // See src/lib/menu.ts for the menu implementation

            Ok(())
        })
        .invoke_handler(builder.invoke_handler())
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
