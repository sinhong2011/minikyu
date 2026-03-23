//! Preferences management commands.
//!
//! Handles loading and saving user preferences to disk.

use std::path::PathBuf;
use tauri::{AppHandle, Manager};
use tokio::io::AsyncWriteExt;

use crate::types::{
    validate_chinese_conversion_mode, validate_custom_chinese_conversions, validate_download_path,
    validate_language, validate_reader_code_theme, validate_reader_settings, validate_reader_theme,
    validate_reader_translation_fallbacks, validate_reader_translation_provider_settings,
    validate_string_input, validate_theme, AppPreferences,
};

/// Gets the path to the preferences file.
pub(crate) fn get_preferences_path(app: &AppHandle) -> Result<PathBuf, String> {
    let app_data_dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("Failed to get app data directory: {e}"))?;

    // Ensure the directory exists
    std::fs::create_dir_all(&app_data_dir)
        .map_err(|e| format!("Failed to create app data directory: {e}"))?;

    Ok(app_data_dir.join("preferences.json"))
}

/// Load the saved quick pane shortcut from preferences, returning None on any failure.
/// Used at startup before the full preferences system is available.
pub fn load_quick_pane_shortcut(app: &AppHandle) -> Option<String> {
    let prefs = load_preferences_sync(app)?;
    prefs.quick_pane_shortcut
}

/// Load preferences synchronously for use during app initialization.
/// Returns None on any failure.
pub fn load_preferences_sync(app: &AppHandle) -> Option<AppPreferences> {
    let path = get_preferences_path(app).ok()?;
    if !path.exists() {
        return None;
    }
    let contents = std::fs::read_to_string(&path)
        .inspect_err(|e| log::warn!("Failed to read preferences: {e}"))
        .ok()?;
    let prefs: AppPreferences = serde_json::from_str(&contents)
        .inspect_err(|e| log::warn!("Failed to parse preferences: {e}"))
        .ok()?;
    Some(prefs)
}

/// Grant asset protocol scope for user-configured file paths in preferences.
/// Called on both load and save to ensure paths from any location are accessible.
fn grant_asset_scope_for_preferences(app: &AppHandle, preferences: &AppPreferences) {
    let scope = app.asset_protocol_scope();

    // Background image file
    if let Some(ref path) = preferences.background_image_path {
        let p = std::path::PathBuf::from(path);
        if p.exists() {
            if let Err(e) = scope.allow_file(&p) {
                log::warn!("Failed to grant asset scope for background image: {e}");
            }
        }
    }

    // Download directories (for audio/video playback of downloaded files)
    for dir_path in [
        &preferences.image_download_path,
        &preferences.video_download_path,
    ]
    .into_iter()
    .flatten()
    {
        let p = std::path::PathBuf::from(dir_path);
        if p.is_dir() {
            if let Err(e) = scope.allow_directory(&p, true) {
                log::warn!("Failed to grant asset scope for download directory: {e}");
            }
        }
    }
}

/// Simple greeting command for demonstration purposes.
#[tauri::command]
#[specta::specta]
pub fn greet(name: &str) -> Result<String, String> {
    // Input validation
    validate_string_input(name, 100, "Name").map_err(|e| {
        log::warn!("Invalid greet input: {e}");
        e
    })?;

    log::info!("Greeting user: {name}");
    Ok(format!("Hello, {name}! You've been greeted from Rust!"))
}

/// Loads user preferences from disk.
/// Returns default preferences if the file doesn't exist.
#[tauri::command]
#[specta::specta]
pub async fn load_preferences(app: AppHandle) -> Result<AppPreferences, String> {
    log::debug!("Loading preferences from disk");
    let prefs_path = get_preferences_path(&app)?;

    if !prefs_path.exists() {
        log::info!("Preferences file not found, using defaults");
        return Ok(AppPreferences::default());
    }

    let contents = std::fs::read_to_string(&prefs_path).map_err(|e| {
        log::error!("Failed to read preferences file: {e}");
        format!("Failed to read preferences file: {e}")
    })?;

    let preferences: AppPreferences = serde_json::from_str(&contents).map_err(|e| {
        log::error!("Failed to parse preferences JSON: {e}");
        format!("Failed to parse preferences: {e}")
    })?;

    // Grant asset protocol access for user-configured paths
    grant_asset_scope_for_preferences(&app, &preferences);

    log::info!("Successfully loaded preferences");
    Ok(preferences)
}

/// Saves user preferences to disk.
/// Uses atomic write (temp file + rename) to prevent corruption.
#[tauri::command]
#[specta::specta]
pub async fn save_preferences(app: AppHandle, preferences: AppPreferences) -> Result<(), String> {
    use crate::types::{validate_close_behavior, CloseBehavior};

    // Validate theme value
    validate_theme(&preferences.theme)?;

    // Validate language value
    validate_language(&preferences.language)?;

    // Validate close behavior
    let behavior_str = match &preferences.close_behavior {
        CloseBehavior::Quit => "quit",
        CloseBehavior::MinimizeToTray => "minimize_to_tray",
    };
    validate_close_behavior(behavior_str)?;

    // Validate reader settings
    validate_reader_settings(
        preferences.reader_font_size,
        preferences.reader_line_width,
        preferences.reader_line_height,
        &preferences.reader_font_family,
    )?;
    validate_reader_theme(&preferences.reader_theme)?;
    validate_reader_code_theme(&preferences.reader_code_theme)?;
    validate_chinese_conversion_mode(preferences.reader_chinese_conversion)?;
    validate_custom_chinese_conversions(&preferences.reader_custom_conversions)?;
    validate_reader_translation_fallbacks(
        &preferences.reader_translation_engine_fallbacks,
        "reader_translation_engine_fallbacks",
    )?;
    validate_reader_translation_fallbacks(
        &preferences.reader_translation_llm_fallbacks,
        "reader_translation_llm_fallbacks",
    )?;
    validate_reader_translation_provider_settings(
        &preferences.reader_translation_provider_settings,
    )?;

    // Validate download paths
    validate_download_path(&preferences.image_download_path)?;
    validate_download_path(&preferences.video_download_path)?;

    // Validate log level
    match preferences.log_level.as_str() {
        "trace" | "debug" | "info" | "warn" | "error" => {}
        _ => return Err(format!("Invalid log level: {}", preferences.log_level)),
    }

    log::debug!("Saving preferences to disk: {preferences:?}");
    let prefs_path = get_preferences_path(&app)?;

    let json_content = serde_json::to_string_pretty(&preferences).map_err(|e| {
        log::error!("Failed to serialize preferences: {e}");
        format!("Failed to serialize preferences: {e}")
    })?;

    // Write to a temporary file first, then rename (atomic operation)
    let temp_path = prefs_path.with_extension("tmp");

    std::fs::write(&temp_path, json_content).map_err(|e| {
        log::error!("Failed to write preferences file: {e}");
        format!("Failed to write preferences file: {e}")
    })?;

    if let Err(rename_err) = std::fs::rename(&temp_path, &prefs_path) {
        log::error!("Failed to finalize preferences file: {rename_err}");
        // Clean up the temp file to avoid leaving orphaned files on disk
        if let Err(remove_err) = std::fs::remove_file(&temp_path) {
            log::warn!("Failed to remove temp file after rename failure: {remove_err}");
        }
        return Err(format!("Failed to finalize preferences file: {rename_err}"));
    }

    log::info!("Successfully saved preferences to {prefs_path:?}");

    // Grant asset protocol access for user-configured paths
    grant_asset_scope_for_preferences(&app, &preferences);

    // Notify the debounce worker to push after 5s of inactivity
    let cloud_sync_configured = match preferences.cloud_sync_protocol.as_str() {
        "webdav" => preferences.cloud_sync_webdav_url.is_some(),
        _ => preferences.cloud_sync_endpoint.is_some() && preferences.cloud_sync_bucket.is_some(),
    };
    if preferences.cloud_sync_enabled && cloud_sync_configured {
        let state: tauri::State<'_, crate::AppState> = app.state();
        state.cloud_sync_notify.notify_one();
    }

    Ok(())
}

/// Downloads an image from a URL and caches it locally in the app data directory.
/// Returns the local file path of the cached image.
#[tauri::command]
#[specta::specta]
pub async fn download_background_image(app: AppHandle, url: String) -> Result<String, String> {
    // Validate URL
    let parsed_url = reqwest::Url::parse(&url).map_err(|e| format!("Invalid URL: {e}"))?;

    // Only allow http/https
    match parsed_url.scheme() {
        "http" | "https" => {}
        scheme => return Err(format!("Unsupported URL scheme: {scheme}")),
    }

    log::info!("Downloading background image from: {url}");

    // Create cache directory
    let app_data_dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("Failed to get app data directory: {e}"))?;
    let cache_dir = app_data_dir.join("background_images");
    std::fs::create_dir_all(&cache_dir)
        .map_err(|e| format!("Failed to create cache directory: {e}"))?;

    // Download the image
    let response = reqwest::get(&url)
        .await
        .map_err(|e| format!("Failed to download image: {e}"))?;

    if !response.status().is_success() {
        return Err(format!(
            "Download failed with status: {}",
            response.status()
        ));
    }

    // Check content type
    let content_type = response
        .headers()
        .get(reqwest::header::CONTENT_TYPE)
        .and_then(|v| v.to_str().ok())
        .unwrap_or("application/octet-stream");

    let extension = match content_type {
        ct if ct.contains("png") => "png",
        ct if ct.contains("gif") => "gif",
        ct if ct.contains("webp") => "webp",
        ct if ct.contains("avif") => "avif",
        ct if ct.contains("bmp") => "bmp",
        ct if ct.contains("svg") => return Err("SVG images are not supported".to_string()),
        // Default to jpg for jpeg and unknown image types
        _ => "jpg",
    };

    // Generate a filename from URL hash to avoid duplicates
    use std::hash::{DefaultHasher, Hash, Hasher};
    let mut hasher = DefaultHasher::new();
    url.hash(&mut hasher);
    let hash = format!("{:016x}", hasher.finish());
    let filename = format!("{hash}.{extension}");
    let file_path = cache_dir.join(&filename);

    // If already cached, return existing path
    if file_path.exists() {
        log::info!("Background image already cached: {}", file_path.display());
        return Ok(file_path.to_string_lossy().to_string());
    }

    // Check file size (limit to 50MB)
    let content_length = response.content_length().unwrap_or(0);
    if content_length > 50 * 1024 * 1024 {
        return Err("Image too large (max 50MB)".to_string());
    }

    // Stream to temp file then rename
    let temp_path = file_path.with_extension("tmp");
    let bytes = response
        .bytes()
        .await
        .map_err(|e| format!("Failed to read image data: {e}"))?;

    // Verify it's actually image data (check magic bytes)
    if bytes.len() < 4 {
        return Err("Downloaded file is too small to be an image".to_string());
    }

    let mut file = tokio::fs::File::create(&temp_path)
        .await
        .map_err(|e| format!("Failed to create cache file: {e}"))?;
    file.write_all(&bytes)
        .await
        .map_err(|e| format!("Failed to write cache file: {e}"))?;
    file.flush()
        .await
        .map_err(|e| format!("Failed to flush cache file: {e}"))?;

    // Atomic rename
    tokio::fs::rename(&temp_path, &file_path)
        .await
        .map_err(|e| format!("Failed to finalize cache file: {e}"))?;

    let path_str = file_path.to_string_lossy().to_string();
    log::info!("Background image cached to: {path_str}");
    Ok(path_str)
}

/// Reads a local image file and returns it as a base64 data URL.
/// This bypasses the asset protocol which has issues on Windows production builds.
#[tauri::command]
#[specta::specta]
pub async fn read_image_as_data_url(path: String) -> Result<String, String> {
    let file_path = std::path::Path::new(&path);
    if !file_path.exists() {
        return Err("File not found".to_string());
    }

    let mime = match file_path
        .extension()
        .and_then(|e| e.to_str())
        .map(|e| e.to_lowercase())
        .as_deref()
    {
        Some("png") => "image/png",
        Some("jpg" | "jpeg") => "image/jpeg",
        Some("webp") => "image/webp",
        Some("gif") => "image/gif",
        Some("bmp") => "image/bmp",
        Some("avif") => "image/avif",
        _ => "image/png",
    };

    let bytes = tokio::fs::read(file_path)
        .await
        .map_err(|e| format!("Failed to read image: {e}"))?;

    use base64::Engine;
    let b64 = base64::engine::general_purpose::STANDARD.encode(&bytes);
    Ok(format!("data:{mime};base64,{b64}"))
}

/// List available system font families.
///
/// Runs on a blocking thread because font_kit calls CoreText APIs
/// via synchronous XPC, which must not block the tokio runtime.
/// Wrapped in catch_unwind because font_kit's CoreText FFI can
/// panic internally on certain system configurations.
#[tauri::command]
#[specta::specta]
pub async fn list_system_fonts() -> Result<Vec<String>, String> {
    tokio::task::spawn_blocking(|| {
        use font_kit::source::SystemSource;
        use std::collections::BTreeSet;

        let result = std::panic::catch_unwind(|| {
            let source = SystemSource::new();
            source.all_families()
        });

        match result {
            Ok(Ok(families)) => {
                let unique: BTreeSet<String> = families.into_iter().collect();
                Ok(unique.into_iter().collect())
            }
            Ok(Err(e)) => Err(format!("Failed to enumerate system fonts: {e}")),
            Err(_) => {
                log::error!("font_kit panicked while enumerating system fonts");
                Err("System font enumeration failed unexpectedly".to_string())
            }
        }
    })
    .await
    .map_err(|e| format!("Font enumeration task failed: {e}"))?
}
