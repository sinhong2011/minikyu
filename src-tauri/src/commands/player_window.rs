//! Podcast player window management commands.
//!
//! The player window is a floating panel (NSPanel on macOS, always-on-top window elsewhere)
//! that provides podcast playback controls and queue in a dedicated window.
//! The tray popover is a compact mini player that appears near the system tray icon.

use tauri::{AppHandle, Emitter, Manager, WebviewUrl};

// ============================================================================
// Constants
// ============================================================================

/// Window label for the player window
const PLAYER_WINDOW_LABEL: &str = "player-window";

/// Window label for the tray popover
const TRAY_POPOVER_LABEL: &str = "tray-popover";

/// Player window dimensions
const PLAYER_WINDOW_WIDTH: f64 = 420.0;
const PLAYER_WINDOW_HEIGHT: f64 = 470.0;
const PLAYER_WINDOW_MIN_WIDTH: f64 = 360.0;
const PLAYER_WINDOW_MIN_HEIGHT: f64 = 390.0;

/// Tray popover dimensions
const TRAY_POPOVER_WIDTH: f64 = 300.0;
const TRAY_POPOVER_HEIGHT: f64 = 520.0;

// ============================================================================
// macOS-specific: NSPanel support
// ============================================================================

#[cfg(target_os = "macos")]
use tauri_nspanel::{
    tauri_panel, CollectionBehavior, ManagerExt, PanelBuilder, PanelLevel, StyleMask,
};

#[cfg(target_os = "macos")]
tauri_panel! {
    panel!(PlayerWindowPanel {
        config: {
            can_become_key_window: true,
            can_become_main_window: false,
            is_floating_panel: true
        }
    })

    panel_event!(TrayPopoverEventHandler {
        window_did_resign_key(notification: &NSNotification) -> ()
    })
}

// ============================================================================
// Window Initialization
// ============================================================================

/// Creates the player window at app startup (hidden).
/// On non-macOS, creation is deferred to first show to avoid idle CPU overhead
/// from hidden transparent WebView2 windows.
pub fn init_player_window(app: &AppHandle) -> Result<(), String> {
    #[cfg(target_os = "macos")]
    {
        init_player_window_macos(app)
    }

    #[cfg(not(target_os = "macos"))]
    {
        log::info!("Player window creation deferred until first show (non-macOS)");
        let _ = app;
        Ok(())
    }
}

#[cfg(target_os = "macos")]
fn init_player_window_macos(app: &AppHandle) -> Result<(), String> {
    use tauri::{LogicalSize, Size};

    log::debug!("Creating player window as NSPanel (macOS)");

    let panel = PanelBuilder::<_, PlayerWindowPanel>::new(app, PLAYER_WINDOW_LABEL)
        .url(WebviewUrl::App("player-window.html".into()))
        .title("Player")
        .size(Size::Logical(LogicalSize::new(
            PLAYER_WINDOW_WIDTH,
            PLAYER_WINDOW_HEIGHT,
        )))
        .level(PanelLevel::Floating)
        .transparent(true)
        .has_shadow(true)
        .collection_behavior(
            CollectionBehavior::new()
                .full_screen_auxiliary()
                .can_join_all_spaces(),
        )
        .style_mask(StyleMask::empty().nonactivating_panel())
        .hides_on_deactivate(false)
        .works_when_modal(true)
        .with_window(|w| {
            w.decorations(false)
                .transparent(true)
                .skip_taskbar(true)
                .visible(false)
                .resizable(true)
                .min_inner_size(PLAYER_WINDOW_MIN_WIDTH, PLAYER_WINDOW_MIN_HEIGHT)
                .center()
        })
        .build()
        .map_err(|e| format!("Failed to create player window panel: {e}"))?;

    panel.hide();
    log::info!("Player window NSPanel created (hidden)");
    Ok(())
}

#[cfg(not(target_os = "macos"))]
fn create_player_window_standard(
    app: &AppHandle,
) -> Result<tauri::WebviewWindow, String> {
    use tauri::webview::WebviewWindowBuilder;

    log::debug!("Creating player window as standard window");

    let window = WebviewWindowBuilder::new(
        app,
        PLAYER_WINDOW_LABEL,
        WebviewUrl::App("player-window.html".into()),
    )
    .title("Player")
    .inner_size(PLAYER_WINDOW_WIDTH, PLAYER_WINDOW_HEIGHT)
    .min_inner_size(PLAYER_WINDOW_MIN_WIDTH, PLAYER_WINDOW_MIN_HEIGHT)
    .always_on_top(true)
    .skip_taskbar(true)
    .decorations(false)
    .transparent(true)
    .visible(false)
    .resizable(true)
    .center()
    .build()
    .map_err(|e| format!("Failed to create player window: {e}"))?;

    log::info!("Player window created");
    Ok(window)
}

// ============================================================================
// Window Visibility
// ============================================================================

fn is_player_window_visible(app: &AppHandle) -> bool {
    #[cfg(target_os = "macos")]
    {
        app.get_webview_panel(PLAYER_WINDOW_LABEL)
            .map(|panel| panel.is_visible())
            .unwrap_or(false)
    }

    #[cfg(not(target_os = "macos"))]
    {
        app.get_webview_window(PLAYER_WINDOW_LABEL)
            .and_then(|window| window.is_visible().ok())
            .unwrap_or(false)
    }
}

#[tauri::command]
#[specta::specta]
pub fn show_player_window(app: AppHandle) -> Result<(), String> {
    log::info!("Showing player window");

    #[cfg(target_os = "macos")]
    {
        let panel = app
            .get_webview_panel(PLAYER_WINDOW_LABEL)
            .map_err(|e| format!("Player window panel not found: {e:?}"))?;
        panel.show_and_make_key();
        log::debug!("Player window panel shown (macOS)");
    }

    #[cfg(not(target_os = "macos"))]
    {
        // Lazy creation: create the window on first show, reuse if already exists
        let window = match app.get_webview_window(PLAYER_WINDOW_LABEL) {
            Some(w) => w,
            None => {
                log::info!("Creating player window on first show");
                create_player_window_standard(&app)?
            }
        };
        window
            .show()
            .map_err(|e| format!("Failed to show window: {e}"))?;
        window
            .set_focus()
            .map_err(|e| format!("Failed to focus window: {e}"))?;
        log::debug!("Player window shown");
    }

    let _ = app.emit("player-window:visible", true);
    Ok(())
}

#[tauri::command]
#[specta::specta]
pub fn hide_player_window(app: AppHandle) -> Result<(), String> {
    #[cfg(target_os = "macos")]
    {
        if let Ok(panel) = app.get_webview_panel(PLAYER_WINDOW_LABEL) {
            if !panel.is_visible() {
                return Ok(());
            }
            log::info!("Hiding player window");
            panel.resign_key_window();
            panel.hide();
            log::debug!("Player window panel hidden (macOS)");
        }
    }

    #[cfg(not(target_os = "macos"))]
    {
        if let Some(window) = app.get_webview_window(PLAYER_WINDOW_LABEL) {
            let is_visible = window.is_visible().unwrap_or(false);
            if !is_visible {
                return Ok(());
            }
            log::info!("Closing player window to free resources");
            window
                .destroy()
                .map_err(|e| format!("Failed to close player window: {e}"))?;
        }
    }

    let _ = app.emit("player-window:visible", false);
    Ok(())
}

#[tauri::command]
#[specta::specta]
pub fn toggle_player_window(app: AppHandle) -> Result<(), String> {
    log::info!("Toggling player window");

    if is_player_window_visible(&app) {
        hide_player_window(app)
    } else {
        show_player_window(app)
    }
}

// ============================================================================
// Tray Popover Window
// ============================================================================

/// Creates the tray popover window at app startup (hidden).
/// On non-macOS, creation is deferred to first show to avoid idle CPU overhead
/// from hidden transparent WebView2 windows.
pub fn init_tray_popover(app: &AppHandle) -> Result<(), String> {
    #[cfg(target_os = "macos")]
    {
        init_tray_popover_macos(app)
    }

    #[cfg(not(target_os = "macos"))]
    {
        log::info!("Tray popover creation deferred until first show (non-macOS)");
        let _ = app;
        Ok(())
    }
}

#[cfg(target_os = "macos")]
fn init_tray_popover_macos(app: &AppHandle) -> Result<(), String> {
    use tauri::{LogicalSize, Size};

    log::debug!("Creating tray popover as NSPanel (macOS)");

    let panel = PanelBuilder::<_, PlayerWindowPanel>::new(app, TRAY_POPOVER_LABEL)
        .url(WebviewUrl::App("tray-popover.html".into()))
        .title("Now Playing")
        .size(Size::Logical(LogicalSize::new(
            TRAY_POPOVER_WIDTH,
            TRAY_POPOVER_HEIGHT,
        )))
        .level(PanelLevel::PopUpMenu)
        .transparent(true)
        .has_shadow(true)
        .collection_behavior(
            CollectionBehavior::new()
                .full_screen_auxiliary()
                .can_join_all_spaces(),
        )
        .style_mask(StyleMask::empty().nonactivating_panel())
        .hides_on_deactivate(false)
        .works_when_modal(true)
        .with_window(|w| {
            w.decorations(false)
                .transparent(true)
                .skip_taskbar(true)
                .visible(false)
                .resizable(false)
        })
        .build()
        .map_err(|e| format!("Failed to create tray popover panel: {e}"))?;

    // Auto-dismiss: hide when the panel loses key window status (click outside)
    let handler = TrayPopoverEventHandler::new();
    let app_handle = app.clone();
    handler.window_did_resign_key(move |_| {
        log::debug!("Tray popover resigned key — hiding");
        if let Ok(p) = app_handle.get_webview_panel(TRAY_POPOVER_LABEL) {
            if p.is_visible() {
                p.hide();
            }
        }
    });
    panel.set_event_handler(Some(handler.as_ref()));

    panel.hide();
    log::info!("Tray popover NSPanel created (hidden)");
    Ok(())
}

#[cfg(not(target_os = "macos"))]
fn create_tray_popover_standard(
    app: &AppHandle,
) -> Result<tauri::WebviewWindow, String> {
    use tauri::webview::WebviewWindowBuilder;

    log::debug!("Creating tray popover as standard window");

    let window = WebviewWindowBuilder::new(
        app,
        TRAY_POPOVER_LABEL,
        WebviewUrl::App("tray-popover.html".into()),
    )
    .title("Now Playing")
    .inner_size(TRAY_POPOVER_WIDTH, TRAY_POPOVER_HEIGHT)
    .always_on_top(true)
    .skip_taskbar(true)
    .decorations(false)
    .transparent(true)
    .visible(false)
    .resizable(false)
    .build()
    .map_err(|e| format!("Failed to create tray popover: {e}"))?;

    log::info!("Tray popover created");
    Ok(window)
}

fn is_tray_popover_visible(app: &AppHandle) -> bool {
    #[cfg(target_os = "macos")]
    {
        app.get_webview_panel(TRAY_POPOVER_LABEL)
            .map(|panel| panel.is_visible())
            .unwrap_or(false)
    }

    #[cfg(not(target_os = "macos"))]
    {
        app.get_webview_window(TRAY_POPOVER_LABEL)
            .and_then(|window| window.is_visible().ok())
            .unwrap_or(false)
    }
}

/// Calculate popover position centered below the tray icon.
/// Falls back to top-right corner if tray icon rect is unknown.
fn calculate_popover_position(scale: f64, screen_width: f64) -> (f64, f64) {
    if let Some((icon_x, icon_y, icon_w, icon_h)) = crate::commands::tray::get_tray_icon_rect() {
        // Convert physical pixels to logical
        let icon_center_x = icon_x / scale + icon_w / scale / 2.0;
        let icon_bottom_y = icon_y / scale + icon_h / scale;
        let x = (icon_center_x - TRAY_POPOVER_WIDTH / 2.0).max(4.0);
        // Clamp to screen right edge
        let x = x.min(screen_width / scale - TRAY_POPOVER_WIDTH - 4.0);
        let y = icon_bottom_y + 4.0;
        log::debug!("Popover position from tray icon: ({x}, {y})");
        (x, y)
    } else {
        // Fallback: top-right corner
        let x = screen_width / scale - TRAY_POPOVER_WIDTH - 8.0;
        let y = 28.0;
        log::debug!("Popover position fallback: ({x}, {y})");
        (x, y)
    }
}

#[tauri::command]
#[specta::specta]
pub fn show_tray_popover(app: AppHandle) -> Result<(), String> {
    log::info!("Showing tray popover");

    #[cfg(target_os = "macos")]
    {
        let panel = app
            .get_webview_panel(TRAY_POPOVER_LABEL)
            .map_err(|e| format!("Tray popover panel not found: {e:?}"))?;
        // Position centered below tray icon
        if let Some(window) = app.get_webview_window(TRAY_POPOVER_LABEL) {
            if let Some(monitor) = window.current_monitor().ok().flatten() {
                let scale = monitor.scale_factor();
                let screen_width = monitor.size().width as f64;
                let (x, y) = calculate_popover_position(scale, screen_width);
                let _ = window.set_position(tauri::LogicalPosition::new(x, y));
            }
        }
        panel.show_and_make_key();
        log::debug!("Tray popover panel shown (macOS)");
    }

    #[cfg(not(target_os = "macos"))]
    {
        // Lazy creation: create the window on first show, reuse if already exists
        let window = match app.get_webview_window(TRAY_POPOVER_LABEL) {
            Some(w) => w,
            None => {
                log::info!("Creating tray popover on first show");
                create_tray_popover_standard(&app)?
            }
        };
        if let Some(monitor) = app
            .get_webview_window("main")
            .and_then(|w| w.current_monitor().ok().flatten())
        {
            let scale = monitor.scale_factor();
            let screen_width = monitor.size().width as f64;
            let (x, y) = calculate_popover_position(scale, screen_width);
            let _ = window.set_position(tauri::LogicalPosition::new(x, y));
        }
        window
            .show()
            .map_err(|e| format!("Failed to show tray popover: {e}"))?;
        window
            .set_focus()
            .map_err(|e| format!("Failed to focus tray popover: {e}"))?;
        log::debug!("Tray popover shown");
    }

    Ok(())
}

#[tauri::command]
#[specta::specta]
pub fn hide_tray_popover(app: AppHandle) -> Result<(), String> {
    #[cfg(target_os = "macos")]
    {
        if let Ok(panel) = app.get_webview_panel(TRAY_POPOVER_LABEL) {
            if !panel.is_visible() {
                return Ok(());
            }
            log::info!("Hiding tray popover");
            panel.resign_key_window();
            panel.hide();
        }
    }

    #[cfg(not(target_os = "macos"))]
    {
        if let Some(window) = app.get_webview_window(TRAY_POPOVER_LABEL) {
            let is_visible = window.is_visible().unwrap_or(false);
            if !is_visible {
                return Ok(());
            }
            log::info!("Closing tray popover to free resources");
            window
                .destroy()
                .map_err(|e| format!("Failed to close tray popover: {e}"))?;
        }
    }

    Ok(())
}

#[tauri::command]
#[specta::specta]
pub fn toggle_tray_popover(app: AppHandle) -> Result<(), String> {
    if is_tray_popover_visible(&app) {
        hide_tray_popover(app)
    } else {
        show_tray_popover(app)
    }
}
