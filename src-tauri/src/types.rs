//! Shared types and validation functions for the Tauri application.

use regex::Regex;
use serde::{Deserialize, Serialize};
use specta::Type;
use std::sync::LazyLock;

/// Default shortcut for the quick pane
pub const DEFAULT_QUICK_PANE_SHORTCUT: &str = "CommandOrControl+Shift+.";

/// Maximum size for recovery data files (10MB)
pub const MAX_RECOVERY_DATA_BYTES: u32 = 10_485_760;

/// Pre-compiled regex pattern for filename validation.
/// Only allows alphanumeric characters, dashes, underscores, and a single extension.
pub static FILENAME_PATTERN: LazyLock<Regex> = LazyLock::new(|| {
    Regex::new(r"^[a-zA-Z0-9_-]+(\.[a-zA-Z0-9]+)?$")
        .expect("Failed to compile filename regex pattern")
});

// ============================================================================
// Preferences
// ============================================================================

/// Application preferences that persist to disk.
/// Only contains settings that should be saved between sessions.
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub struct AppPreferences {
    pub theme: String,
    /// Global shortcut for quick pane (e.g., "CommandOrControl+Shift+.")
    /// If None, uses to default shortcut
    pub quick_pane_shortcut: Option<String>,
    /// User's preferred language (e.g., "en", "es", "de")
    /// If None, uses system locale detection
    pub language: Option<String>,
    /// Behavior when window close button is clicked
    pub close_behavior: CloseBehavior,
    /// Whether to show tray icon
    pub show_tray_icon: bool,
    /// Whether to start minimized to tray
    pub start_minimized: bool,
    /// Reader font size (14-24)
    pub reader_font_size: u32,
    /// Reader line width (45-80)
    pub reader_line_width: u32,
    /// Reader font family (sans-serif, serif, monospace)
    pub reader_font_family: String,
    /// Default download path for images (null = ask every time)
    pub image_download_path: Option<String>,
    /// Default download path for videos (null = ask every time)
    pub video_download_path: Option<String>,
}

impl Default for AppPreferences {
    fn default() -> Self {
        Self {
            theme: "system".to_string(),
            quick_pane_shortcut: None, // None means use default
            language: None,            // None means use system locale
            close_behavior: CloseBehavior::default(),
            show_tray_icon: true,
            start_minimized: false,
            reader_font_size: 16,
            reader_line_width: 65,
            reader_font_family: "sans-serif".to_string(),
            image_download_path: None,
            video_download_path: None,
        }
    }
}

// ============================================================================
// Recovery Errors
// ============================================================================

/// Error types for recovery operations (typed for frontend matching)
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(tag = "type")]
pub enum RecoveryError {
    /// File does not exist (expected case, not a failure)
    FileNotFound,
    /// Filename validation failed
    ValidationError { message: String },
    /// Data exceeds size limit
    DataTooLarge { max_bytes: u32 },
    /// File system read/write error
    IoError { message: String },
    /// JSON serialization/deserialization error
    ParseError { message: String },
}

impl std::fmt::Display for RecoveryError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            RecoveryError::FileNotFound => write!(f, "File not found"),
            RecoveryError::ValidationError { message } => write!(f, "Validation error: {message}"),
            RecoveryError::DataTooLarge { max_bytes } => {
                write!(f, "Data too large (max {max_bytes} bytes)")
            }
            RecoveryError::IoError { message } => write!(f, "IO error: {message}"),
            RecoveryError::ParseError { message } => write!(f, "Parse error: {message}"),
        }
    }
}

// ============================================================================
// Validation Functions
// ============================================================================

/// Validates a filename for safe file system operations.
/// Only allows alphanumeric characters, dashes, underscores, and a single extension.
pub fn validate_filename(filename: &str) -> Result<(), String> {
    if filename.is_empty() {
        return Err("Filename cannot be empty".to_string());
    }

    if filename.chars().count() > 100 {
        return Err("Filename too long (max 100 characters)".to_string());
    }

    if !FILENAME_PATTERN.is_match(filename) {
        return Err(
            "Invalid filename: only alphanumeric characters, dashes, underscores, and dots allowed"
                .to_string(),
        );
    }

    Ok(())
}

/// Validates string input length (by character count, not bytes).
pub fn validate_string_input(input: &str, max_len: usize, field_name: &str) -> Result<(), String> {
    let char_count = input.chars().count();
    if char_count > max_len {
        return Err(format!("{field_name} too long (max {max_len} characters)"));
    }
    Ok(())
}

/// Validates theme value.
pub fn validate_theme(theme: &str) -> Result<(), String> {
    match theme {
        "light" | "dark" | "system" => Ok(()),
        _ => Err("Invalid theme: must be 'light', 'dark', or 'system'".to_string()),
    }
}

/// Validates language value.
/// Supports: en, zh-CN, zh-TW, ja, ko, or null (system default)
pub fn validate_language(language: &Option<String>) -> Result<(), String> {
    match language {
        None => Ok(()), // System default
        Some(lang) => match lang.as_str() {
            "en" | "zh-CN" | "zh-TW" | "ja" | "ko" => Ok(()),
            _ => Err(
                "Invalid language: must be 'en', 'zh-CN', 'zh-TW', 'ja', 'ko', or null".to_string(),
            ),
        },
    }
}

// ============================================================================
// Tray Icon Types
// ============================================================================

/// Tray icon states for visual feedback
#[derive(Debug, Clone, Serialize, Deserialize, Type, Default)]
#[serde(rename_all = "snake_case")]
pub enum TrayIconState {
    /// Normal/default state
    #[default]
    Normal,
    /// Notification badge (red dot)
    Notification,
    /// Urgent/animated alert state
    Alert,
}

/// Window close behavior options
#[derive(Debug, Clone, Serialize, Deserialize, Type, Default)]
#[serde(rename_all = "snake_case")]
pub enum CloseBehavior {
    /// Quit the application completely
    Quit,
    /// Minimize to tray (hide window, keep running)
    #[default]
    MinimizeToTray,
}

/// Validates close behavior value
pub fn validate_close_behavior(behavior: &str) -> Result<(), String> {
    match behavior {
        "quit" | "minimize_to_tray" => Ok(()),
        _ => Err("Invalid close behavior: must be 'quit' or 'minimize_to_tray'".to_string()),
    }
}

/// Validates reader settings.
pub fn validate_reader_settings(
    font_size: u32,
    line_width: u32,
    font_family: &str,
) -> Result<(), String> {
    if !(14..=24).contains(&font_size) {
        return Err("Font size must be between 14 and 24".to_string());
    }
    if !(45..=80).contains(&line_width) {
        return Err("Line width must be between 45 and 80".to_string());
    }
    match font_family {
        "sans-serif" | "serif" | "monospace" => Ok(()),
        _ => Err("Invalid font family: must be 'sans-serif', 'serif', or 'monospace'".to_string()),
    }
}

/// Validates download path.
pub fn validate_download_path(path: &Option<String>) -> Result<(), String> {
    if let Some(p) = path {
        if p.trim().is_empty() {
            return Err("Download path cannot be empty".to_string());
        }
        if p.chars().count() > 500 {
            return Err("Download path too long (max 500 characters)".to_string());
        }
        if p.contains("..") {
            return Err("Download path cannot contain '..'".to_string());
        }
    }
    Ok(())
}
