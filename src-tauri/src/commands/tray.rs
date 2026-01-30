//! System tray icon management commands.
//!
//! Handles tray icon creation, menu management, and window visibility control.
//! Supports dynamic icon states, theme adaptation, and cross-platform compatibility.

use std::sync::Mutex;
use tauri::{
    menu::{Menu, MenuItem, PredefinedMenuItem},
    tray::{MouseButton, MouseButtonState, TrayIcon, TrayIconBuilder, TrayIconEvent},
    AppHandle, Emitter, Manager, WebviewWindow,
};

use crate::types::{CloseBehavior, TrayIconState};

// ============================================================================
// Constants
// ============================================================================

/// Tray icon ID
const TRAY_ICON_ID: &str = "main-tray";

/// Menu item IDs
const MENU_SHOW_ID: &str = "tray-show";
const MENU_HIDE_ID: &str = "tray-hide";
const MENU_PREFERENCES_ID: &str = "tray-preferences";
const MENU_QUICK_ACTION_1_ID: &str = "tray-quick-action-1";
const MENU_QUICK_ACTION_2_ID: &str = "tray-quick-action-2";
const MENU_QUIT_ID: &str = "tray-quit";

// ============================================================================
// Global State
// ============================================================================

/// Global tray icon instance (managed by Tauri)
static TRAY_ICON_INSTANCE: Mutex<Option<TrayIcon>> = Mutex::new(None);

/// Current tray icon state
static CURRENT_TRAY_STATE: Mutex<TrayIconState> = Mutex::new(TrayIconState::Normal);

/// Current tooltip text
static CURRENT_TOOLTIP: Mutex<String> = Mutex::new(String::new());

// ============================================================================
// Tray Initialization
// ============================================================================

/// Initialize the system tray icon and menu.
/// Must be called from the main thread during app setup.
pub fn init_tray(app: &AppHandle) -> Result<(), String> {
    log::info!("========================================");
    log::info!("Initializing system tray icon");
    log::info!("========================================");

    // Create the tray menu
    log::info!("Creating tray menu...");
    let menu = create_tray_menu(app)?;
    log::info!("✓ Tray menu created successfully");

    // Load the icon first to ensure it exists before building the tray
    log::info!("Loading tray icon...");
    let icon = get_icon(app, &TrayIconState::Normal)?;
    log::info!("✓ Tray icon loaded successfully");

    // Build the tray icon with the icon set during construction
    log::info!("Building tray icon...");
    let mut tray_builder = TrayIconBuilder::with_id(TRAY_ICON_ID)
        .menu(&menu)
        .icon(icon)
        .show_menu_on_left_click(false); // Right-click for menu, left-click toggles window

    // Set icon as template on macOS for proper theme adaptation
    // Note: Template icons must be monochrome with good contrast
    #[cfg(target_os = "macos")]
    {
        // Try template mode first, but if icon is not visible, comment this out
        tray_builder = tray_builder.icon_as_template(true);
        log::info!("✓ Set tray icon as template for macOS (adapts to dark/light mode)");
        log::info!("  If icon is not visible, try using colored icon instead");
    }

    let tray = tray_builder
        .on_tray_icon_event(handle_tray_icon_event)
        .on_menu_event(handle_menu_event)
        .build(app)
        .map_err(|e| format!("Failed to create tray icon: {e}"))?;

    // Store the tray instance
    *TRAY_ICON_INSTANCE.lock().unwrap() = Some(tray);

    log::info!("✓ System tray initialized successfully");
    log::info!("========================================");

    // Verify tray icon is visible (macOS only)
    #[cfg(target_os = "macos")]
    {
        log::info!("Tray icon should now be visible in the macOS menu bar");
        log::info!("If you don't see it, check:");
        log::info!("  1. The icon file exists and is valid");
        log::info!("  2. The icon is a monochrome template icon (not colored)");
        log::info!("  3. macOS hasn't hidden it due to space constraints");
        log::info!("  4. Check Console.app for any error messages");
    }

    Ok(())
}

/// Create the tray context menu
fn create_tray_menu(app: &AppHandle) -> Result<Menu<tauri::Wry>, String> {
    let menu = Menu::new(app).map_err(|e| format!("Failed to create tray menu: {e}"))?;

    // Show/Hide item (dynamic based on window state)
    let show_item = MenuItem::with_id(
        app,
        MENU_SHOW_ID,
        "Show Window",
        true,
        None::<&str>,
    )
    .map_err(|e| format!("Failed to create show menu item: {e}"))?;

    let hide_item = MenuItem::with_id(
        app,
        MENU_HIDE_ID,
        "Hide Window",
        true,
        None::<&str>,
    )
    .map_err(|e| format!("Failed to create hide menu item: {e}"))?;

    // Separator
    let separator1 = PredefinedMenuItem::separator(app)
        .map_err(|e| format!("Failed to create separator: {e}"))?;

    // Quick actions
    let quick_action_1 = MenuItem::with_id(
        app,
        MENU_QUICK_ACTION_1_ID,
        "Quick Action 1",
        true,
        None::<&str>,
    )
    .map_err(|e| format!("Failed to create quick action 1: {e}"))?;

    let quick_action_2 = MenuItem::with_id(
        app,
        MENU_QUICK_ACTION_2_ID,
        "Quick Action 2",
        true,
        None::<&str>,
    )
    .map_err(|e| format!("Failed to create quick action 2: {e}"))?;

    // Separator
    let separator2 = PredefinedMenuItem::separator(app)
        .map_err(|e| format!("Failed to create separator: {e}"))?;

    // Preferences
    let preferences = MenuItem::with_id(
        app,
        MENU_PREFERENCES_ID,
        "Preferences...",
        true,
        None::<&str>,
    )
    .map_err(|e| format!("Failed to create preferences item: {e}"))?;

    // Separator
    let separator3 = PredefinedMenuItem::separator(app)
        .map_err(|e| format!("Failed to create separator: {e}"))?;

    // Quit
    let quit = MenuItem::with_id(
        app,
        MENU_QUIT_ID,
        "Quit",
        true,
        None::<&str>,
    )
    .map_err(|e| format!("Failed to create quit item: {e}"))?;

    // Add items to menu
    menu.append(&show_item)
        .and_then(|_| menu.append(&hide_item))
        .and_then(|_| menu.append(&separator1))
        .and_then(|_| menu.append(&quick_action_1))
        .and_then(|_| menu.append(&quick_action_2))
        .and_then(|_| menu.append(&separator2))
        .and_then(|_| menu.append(&preferences))
        .and_then(|_| menu.append(&separator3))
        .and_then(|_| menu.append(&quit))
        .map_err(|e| format!("Failed to append menu items: {e}"))?;

    Ok(menu)
}

// ============================================================================
// Event Handlers
// ============================================================================

/// Handle tray icon click events
fn handle_tray_icon_event(tray: &TrayIcon, event: TrayIconEvent) {
    match event {
        TrayIconEvent::Click {
            button: MouseButton::Left,
            button_state: MouseButtonState::Up,
            ..
        } => {
            // Left click: toggle window visibility
            log::debug!("Tray left-click: toggling window visibility");
            if let Err(e) = toggle_main_window(tray.app_handle()) {
                log::error!("Failed to toggle window: {e}");
            }
        }
        TrayIconEvent::Click {
            button: MouseButton::Right,
            button_state: MouseButtonState::Up,
            ..
        } => {
            // Right click: show menu (handled automatically by Tauri)
            log::debug!("Tray right-click: showing menu");
            update_menu_visibility(tray.app_handle());
        }
        _ => {}
    }
}

/// Handle menu item clicks
fn handle_menu_event(app: &AppHandle, event: tauri::menu::MenuEvent) {
    match event.id.as_ref() {
        MENU_SHOW_ID => {
            log::debug!("Tray menu: Show Window");
            if let Err(e) = show_main_window(app) {
                log::error!("Failed to show window: {e}");
            }
        }
        MENU_HIDE_ID => {
            log::debug!("Tray menu: Hide Window");
            if let Err(e) = hide_main_window(app) {
                log::error!("Failed to hide window: {e}");
            }
        }
        MENU_PREFERENCES_ID => {
            log::debug!("Tray menu: Preferences");
            // Emit event to frontend to open preferences
            app.emit("open-preferences", ())
                .unwrap_or_else(|e| log::error!("Failed to emit open-preferences: {e}"));
            // Also show the window
            if let Err(e) = show_main_window(app) {
                log::error!("Failed to show window: {e}");
            }
        }
        MENU_QUICK_ACTION_1_ID => {
            log::debug!("Tray menu: Quick Action 1");
            app.emit("tray-quick-action", "action-1")
                .unwrap_or_else(|e| log::error!("Failed to emit quick action: {e}"));
        }
        MENU_QUICK_ACTION_2_ID => {
            log::debug!("Tray menu: Quick Action 2");
            app.emit("tray-quick-action", "action-2")
                .unwrap_or_else(|e| log::error!("Failed to emit quick action: {e}"));
        }
        MENU_QUIT_ID => {
            log::info!("Tray menu: Quit");
            app.exit(0);
        }
        _ => {
            log::warn!("Unknown tray menu item: {:?}", event.id);
        }
    }
}

// ============================================================================
// Window Management
// ============================================================================

/// Get the main window
fn get_main_window(app: &AppHandle) -> Result<WebviewWindow, String> {
    app.get_webview_window("main")
        .ok_or_else(|| "Main window not found".to_string())
}

/// Show the main window (public for single instance handler)
pub fn show_main_window(app: &AppHandle) -> Result<(), String> {
    let window = get_main_window(app)?;
    window
        .show()
        .map_err(|e| format!("Failed to show window: {e}"))?;
    window
        .set_focus()
        .map_err(|e| format!("Failed to focus window: {e}"))?;
    window
        .unminimize()
        .map_err(|e| format!("Failed to unminimize window: {e}"))?;
    Ok(())
}

/// Hide the main window (public for single instance handler)
pub fn hide_main_window(app: &AppHandle) -> Result<(), String> {
    let window = get_main_window(app)?;
    window
        .hide()
        .map_err(|e| format!("Failed to hide window: {e}"))?;
    Ok(())
}

/// Toggle main window visibility
fn toggle_main_window(app: &AppHandle) -> Result<(), String> {
    let window = get_main_window(app)?;
    match window.is_visible() {
        Ok(true) => hide_main_window(app),
        Ok(false) => show_main_window(app),
        Err(e) => Err(format!("Failed to check window visibility: {e}")),
    }
}

/// Update menu items based on window state
fn update_menu_visibility(app: &AppHandle) {
    if let Ok(window) = get_main_window(app) {
        if let Ok(visible) = window.is_visible() {
            // Update menu item visibility based on window state
            // Note: In Tauri v2, we need to rebuild the menu to change visibility
            // This is a simplified version - full implementation would rebuild menu
            log::debug!("Window visible: {visible}, updating menu");
        }
    }
}

// ============================================================================
// Icon Management
// ============================================================================

/// Update the tray icon based on state and theme
fn update_tray_icon(
    app: &AppHandle,
    state: &TrayIconState,
) -> Result<(), String> {
    // Get the appropriate icon based on state and platform
    let icon = get_icon(app, state)?;

    if let Some(tray) = TRAY_ICON_INSTANCE.lock().unwrap().as_ref() {
        tray.set_icon(Some(icon))
            .map_err(|e| format!("Failed to set tray icon: {e}"))?;
    }

    *CURRENT_TRAY_STATE.lock().unwrap() = state.clone();
    Ok(())
}

/// Get the icon based on current state and platform
fn get_icon(
    app: &AppHandle,
    _state: &TrayIconState,
) -> Result<tauri::image::Image<'static>, String> {
    log::info!("Loading tray icon...");

    // Try multiple icon paths in order of preference
    let mut icon_paths = Vec::new();

    // 1. Check CARGO_MANIFEST_DIR first (most reliable in dev)
    if let Ok(manifest_dir) = std::env::var("CARGO_MANIFEST_DIR") {
        let manifest_path = std::path::PathBuf::from(manifest_dir.clone());

        // On macOS, prefer template icon for proper theme adaptation
        #[cfg(target_os = "macos")]
        {
            icon_paths.push(manifest_path.join("icons/32x32-template.png"));
        }

        icon_paths.push(manifest_path.join("icons/32x32.png"));
        icon_paths.push(manifest_path.join("icons/icon.png"));
        log::debug!("CARGO_MANIFEST_DIR: {:?}", manifest_dir);
    }

    // 2. Try resource directory (production builds)
    if let Ok(resource_path) = app.path().resource_dir() {
        // On macOS, prefer template icon for proper theme adaptation
        #[cfg(target_os = "macos")]
        {
            icon_paths.push(resource_path.join("icons/32x32-template.png"));
        }

        icon_paths.push(resource_path.join("icons/32x32.png"));
        icon_paths.push(resource_path.join("icons/icon.png"));
        log::debug!("Resource dir: {:?}", resource_path);
    }

    // 3. Try workspace root (fallback for dev)
    if let Ok(exe_path) = std::env::current_exe() {
        // Navigate from executable to workspace root
        // In dev: target/debug/tauri-app -> target/ -> src-tauri/ -> workspace root
        let workspace_root = exe_path
            .ancestors()
            .nth(3)
            .map(|p| p.to_path_buf())
            .unwrap_or_else(|| std::path::PathBuf::from("."));

        // On macOS, prefer template icon for proper theme adaptation
        #[cfg(target_os = "macos")]
        {
            icon_paths.push(workspace_root.join("src-tauri/icons/32x32-template.png"));
        }

        icon_paths.push(workspace_root.join("src-tauri/icons/32x32.png"));
        icon_paths.push(workspace_root.join("src-tauri/icons/icon.png"));
        log::debug!("Workspace root: {:?}", workspace_root);
    }

    // 4. Try relative paths (last resort)
    #[cfg(target_os = "macos")]
    {
        icon_paths.push(std::path::PathBuf::from("src-tauri/icons/32x32-template.png"));
    }

    icon_paths.push(std::path::PathBuf::from("src-tauri/icons/32x32.png"));
    icon_paths.push(std::path::PathBuf::from("src-tauri/icons/icon.png"));

    let mut icon_bytes = None;
    let mut found_path = None;

    for path in &icon_paths {
        log::debug!("Trying icon path: {:?}", path);
        if let Ok(bytes) = std::fs::read(path) {
            icon_bytes = Some(bytes);
            found_path = Some(path.clone());
            log::info!("✓ Found icon at: {:?}", path);
            break;
        }
    }

    let icon_bytes = icon_bytes.ok_or_else(|| {
        let paths_str: Vec<String> = icon_paths.iter().map(|p| p.display().to_string()).collect();
        format!(
            "Could not find tray icon at any of these paths:\n  {}",
            paths_str.join("\n  ")
        )
    })?;

    log::info!("✓ Successfully loaded tray icon from: {:?}", found_path);

    // Parse the PNG to get dimensions
    let (width, height) = parse_png_dimensions(&icon_bytes).unwrap_or((32, 32));
    log::debug!("Icon dimensions: {}x{}", width, height);

    let icon = tauri::image::Image::new_owned(icon_bytes, width, height);

    Ok(icon)
}

/// Parse PNG dimensions from bytes
fn parse_png_dimensions(data: &[u8]) -> Option<(u32, u32)> {
    // PNG signature is 8 bytes, IHDR starts at byte 16
    // Width is at bytes 16-19, height at 20-23 (big-endian)
    if data.len() < 24 || data[0..8] != [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A] {
        return None;
    }

    let width = u32::from_be_bytes([data[16], data[17], data[18], data[19]]);
    let height = u32::from_be_bytes([data[20], data[21], data[22], data[23]]);

    Some((width, height))
}

// ============================================================================
// Commands
// ============================================================================

/// Show the main window (command exposed to frontend)
#[tauri::command]
#[specta::specta]
pub async fn tray_show_window(app: AppHandle) -> Result<(), String> {
    show_main_window(&app)
}

/// Hide the main window (command exposed to frontend)
#[tauri::command]
#[specta::specta]
pub async fn tray_hide_window(app: AppHandle) -> Result<(), String> {
    hide_main_window(&app)
}

/// Toggle main window visibility (command exposed to frontend)
#[tauri::command]
#[specta::specta]
pub async fn tray_toggle_window(app: AppHandle) -> Result<(), String> {
    toggle_main_window(&app)
}

/// Update the tray icon state
#[tauri::command]
#[specta::specta]
pub async fn tray_set_icon_state(
    app: AppHandle,
    state: TrayIconState,
) -> Result<(), String> {
    update_tray_icon(&app, &state)
}

/// Update the tray tooltip
#[tauri::command]
#[specta::specta]
pub async fn tray_set_tooltip(_app: AppHandle, tooltip: String) -> Result<(), String> {
    if let Some(tray) = TRAY_ICON_INSTANCE.lock().unwrap().as_ref() {
        tray.set_tooltip(Some(tooltip.as_str()))
            .map_err(|e| format!("Failed to set tooltip: {e}"))?;
    }
    *CURRENT_TOOLTIP.lock().unwrap() = tooltip;
    Ok(())
}

/// Get the current tray icon state
#[tauri::command]
#[specta::specta]
pub async fn tray_get_state() -> TrayIconState {
    CURRENT_TRAY_STATE.lock().unwrap().clone()
}

/// Check if the main window is visible
#[tauri::command]
#[specta::specta]
pub async fn tray_is_window_visible(app: AppHandle) -> Result<bool, String> {
    let window = get_main_window(&app)?;
    window
        .is_visible()
        .map_err(|e| format!("Failed to check visibility: {e}"))
}

// ============================================================================
// Cleanup
// ============================================================================

/// Cleanup tray resources before app exit
#[allow(dead_code)]
pub fn cleanup_tray() {
    log::info!("Cleaning up tray icon");
    *TRAY_ICON_INSTANCE.lock().unwrap() = None;
    *CURRENT_TRAY_STATE.lock().unwrap() = TrayIconState::Normal;
    *CURRENT_TOOLTIP.lock().unwrap() = String::new();
}

// ============================================================================
// Window Close Handler
// ============================================================================

/// Handle window close request based on user preferences
#[allow(dead_code)]
pub fn handle_window_close_request(
    app: &AppHandle,
    close_behavior: &CloseBehavior,
) -> Result<bool, String> {
    match close_behavior {
        CloseBehavior::Quit => {
            log::info!("Close behavior: Quit - allowing window close");
            cleanup_tray();
            Ok(true) // Allow close
        }
        CloseBehavior::MinimizeToTray => {
            log::info!("Close behavior: Minimize to tray - hiding window");
            hide_main_window(app)?;
            Ok(false) // Prevent close, just hide
        }
    }
}
