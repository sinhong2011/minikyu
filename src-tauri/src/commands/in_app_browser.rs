//! In-app browser commands.
//!
//! Manages a native child webview (WKWebView on macOS) that renders external
//! article URLs within the main application window. The webview is positioned
//! programmatically at the coordinates of the React browser pane element.

use tauri::{AppHandle, LogicalPosition, LogicalSize, Manager};

/// Label used to identify the browser child webview across all commands.
const BROWSER_LABEL: &str = "in-app-browser";

/// Opens an in-app browser webview at the given logical-pixel bounds.
///
/// If a browser webview is already open, navigates it to the new URL and
/// updates its bounds. Otherwise creates a new child webview attached to
/// the main window.
///
/// `x`, `y`, `width`, `height` are CSS logical pixels from
/// `getBoundingClientRect()` — no devicePixelRatio scaling needed.
#[tauri::command]
#[specta::specta]
pub async fn open_in_app_browser(
    app: AppHandle,
    url: String,
    x: f64,
    y: f64,
    width: f64,
    height: f64,
    is_dark: bool,
) -> Result<(), String> {
    let parsed_url = url
        .parse::<tauri::Url>()
        .map_err(|e| format!("Invalid URL: {e}"))?;

    // SAFETY: color_scheme is always the literal "dark" or "light", no user input.
    let color_scheme = if is_dark { "dark" } else { "light" };

    if let Some(webview) = app.get_webview(BROWSER_LABEL) {
        // Reuse existing webview: update URL and position.
        webview
            .navigate(parsed_url)
            .map_err(|e| format!("Navigate failed: {e}"))?;
        webview
            .set_bounds(tauri::Rect {
                position: LogicalPosition::new(x, y).into(),
                size: LogicalSize::new(width, height).into(),
            })
            .map_err(|e| format!("set_bounds failed: {e}"))?;
        // Sync color scheme on the already-loaded page.
        let script = format!("document.documentElement.style.colorScheme = '{color_scheme}'");
        let _ = webview.eval(&script);
    } else {
        // Create a new child webview attached to the main window.
        // initialization_script runs at the start of every page load, ensuring
        // color-scheme is applied even when the user navigates within the browser.
        let window = app
            .get_window("main")
            .ok_or("Main window not found")?;

        let init_script =
            format!("document.documentElement.style.colorScheme = '{color_scheme}';");

        window
            .add_child(
                tauri::webview::WebviewBuilder::new(
                    BROWSER_LABEL,
                    tauri::WebviewUrl::External(parsed_url),
                )
                .initialization_script(&init_script),
                LogicalPosition::new(x, y),
                LogicalSize::new(width, height),
            )
            .map_err(|e| format!("Failed to create browser webview: {e}"))?;
    }

    log::info!("In-app browser opened: {url}");
    Ok(())
}

/// Closes and destroys the in-app browser webview if it exists.
#[tauri::command]
#[specta::specta]
pub async fn close_in_app_browser(app: AppHandle) -> Result<(), String> {
    if let Some(webview) = app.get_webview(BROWSER_LABEL) {
        webview
            .close()
            .map_err(|e| format!("Failed to close browser webview: {e}"))?;
        log::info!("In-app browser closed");
    }
    Ok(())
}

/// Updates the position and size of the browser webview.
///
/// Called by the React ResizeObserver whenever the browser pane changes size.
#[tauri::command]
#[specta::specta]
pub async fn resize_browser_webview(
    app: AppHandle,
    x: f64,
    y: f64,
    width: f64,
    height: f64,
) -> Result<(), String> {
    if let Some(webview) = app.get_webview(BROWSER_LABEL) {
        webview
            .set_bounds(tauri::Rect {
                position: LogicalPosition::new(x, y).into(),
                size: LogicalSize::new(width, height).into(),
            })
            .map_err(|e| format!("resize_browser_webview set_bounds failed: {e}"))?;
    }
    Ok(())
}

/// Reloads the current page in the in-app browser webview.
#[tauri::command]
#[specta::specta]
pub async fn reload_browser_webview(app: AppHandle) -> Result<(), String> {
    if let Some(webview) = app.get_webview(BROWSER_LABEL) {
        // SAFETY: hardcoded literal, no user input involved.
        webview
            .eval("window.location.reload()")
            .map_err(|e| format!("reload_browser_webview failed: {e}"))?;
    }
    Ok(())
}

/// Synchronises the browser webview's color scheme with the app theme.
///
/// Uses Tauri's Webview::eval() API to set colorScheme on the page root.
/// The injected value is always "dark" or "light" — no user input involved.
#[tauri::command]
#[specta::specta]
pub async fn sync_browser_theme(app: AppHandle, is_dark: bool) -> Result<(), String> {
    if let Some(webview) = app.get_webview(BROWSER_LABEL) {
        let color_scheme = if is_dark { "dark" } else { "light" };
        let script = format!("document.documentElement.style.colorScheme = '{color_scheme}'");
        webview
            .eval(&script)
            .map_err(|e| format!("sync_browser_theme failed: {e}"))?;
    }
    Ok(())
}
