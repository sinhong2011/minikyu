//! Shared types and validation functions for the Tauri application.

use regex::Regex;
use serde::{Deserialize, Serialize};
use specta::Type;
use std::collections::HashMap;
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

/// Chinese conversion mode for the reading panel.
#[derive(Debug, Clone, Copy, Serialize, Deserialize, Type, Default, PartialEq, Eq, Hash)]
pub enum ChineseConversionMode {
    /// Keep source content unchanged.
    #[serde(rename = "off")]
    #[specta(rename = "off")]
    Off,
    /// Convert Simplified Chinese to Traditional Chinese (Taiwan).
    #[default]
    #[serde(rename = "s2tw")]
    #[specta(rename = "s2tw")]
    S2tw,
    /// Convert Simplified Chinese to Traditional Chinese (Hong Kong).
    #[serde(rename = "s2hk")]
    #[specta(rename = "s2hk")]
    S2hk,
    /// Convert Traditional Chinese to Simplified Chinese.
    #[serde(rename = "t2s")]
    #[specta(rename = "t2s")]
    T2s,
}

/// Custom rule for Chinese term conversion.
#[derive(Debug, Clone, Serialize, Deserialize, Type, Default, PartialEq, Eq, Hash)]
pub struct ChineseConversionRule {
    /// Source term to match.
    pub from: String,
    /// Replacement term to apply.
    pub to: String,
}

/// Reader translation rendering mode.
#[derive(Debug, Clone, Copy, Serialize, Deserialize, Type, Default, PartialEq, Eq, Hash)]
#[serde(rename_all = "snake_case")]
pub enum ReaderTranslationDisplayMode {
    #[default]
    Bilingual,
    TranslatedOnly,
}

/// Reader translation trigger mode.
#[derive(Debug, Clone, Copy, Serialize, Deserialize, Type, Default, PartialEq, Eq, Hash)]
#[serde(rename_all = "snake_case")]
pub enum ReaderTranslationTriggerMode {
    #[default]
    Manual,
    PerArticleAuto,
}

/// Reader translation routing strategy mode.
#[derive(Debug, Clone, Copy, Serialize, Deserialize, Type, Default, PartialEq, Eq, Hash)]
#[serde(rename_all = "snake_case")]
pub enum ReaderTranslationRouteMode {
    #[default]
    EngineFirst,
    HybridAuto,
}

/// Runtime settings for one translation provider.
#[derive(Debug, Clone, Serialize, Deserialize, Type, Default, PartialEq, Eq, Hash)]
pub struct ReaderTranslationProviderSettings {
    /// Whether this provider is allowed to be used.
    pub enabled: bool,
    /// Optional provider base URL override.
    pub base_url: Option<String>,
    /// Optional model override. Required for LLM providers.
    pub model: Option<String>,
    /// Optional timeout in milliseconds.
    pub timeout_ms: Option<u32>,
    /// Optional system prompt override for LLM providers.
    /// Supports {source_lang} and {target_lang} placeholders.
    pub system_prompt: Option<String>,
}

/// Player display mode when clicking the tray icon.
#[derive(Debug, Clone, Copy, Serialize, Deserialize, Type, Default, PartialEq, Eq, Hash)]
pub enum PlayerDisplayMode {
    /// Show the floating player window
    #[default]
    FloatingWindow,
    /// Show the compact tray popover
    TrayPopover,
}

const fn default_ai_summary_max_text_length() -> u32 {
    100_000
}

fn default_time_format() -> String {
    "24h".to_string()
}

/// Application preferences that persist to disk.
/// Only contains settings that should be saved between sessions.
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(default)]
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
    /// Reader line height (1.4-2.2)
    pub reader_line_height: f32,
    /// Reader font family
    /// (sans-serif, system-ui, humanist, serif, georgia, book-serif, monospace)
    pub reader_font_family: String,
    /// Reader surface theme
    /// (default, paper, sepia, slate, oled)
    pub reader_theme: String,
    /// Reader code block syntax highlight theme.
    pub reader_code_theme: String,
    /// Chinese conversion mode for reading content.
    pub reader_chinese_conversion: ChineseConversionMode,
    /// Enable bionic reading emphasis for English text.
    pub reader_bionic_reading: bool,
    /// Whether to show the compact reading status bar.
    pub reader_status_bar: bool,
    /// Whether to enable focus mode (paragraph dimming) in the reader.
    #[serde(default)]
    pub reader_focus_mode: bool,
    /// Whether to automatically mark entries as read when scrolled past 20%.
    #[serde(default)]
    pub reader_auto_mark_read: bool,
    /// User-defined term conversion rules applied after Chinese conversion.
    #[serde(default)]
    pub reader_custom_conversions: Vec<ChineseConversionRule>,
    /// Reader translation display mode.
    pub reader_translation_display_mode: ReaderTranslationDisplayMode,
    /// Reader translation trigger mode.
    pub reader_translation_trigger_mode: ReaderTranslationTriggerMode,
    /// Reader translation routing mode.
    pub reader_translation_route_mode: ReaderTranslationRouteMode,
    /// Reader translation target language.
    pub reader_translation_target_language: Option<String>,
    /// Reader translation primary engine identifier.
    pub reader_translation_primary_engine: Option<String>,
    /// Reader translation engine fallback identifiers.
    #[serde(default)]
    pub reader_translation_engine_fallbacks: Vec<String>,
    /// Reader translation LLM fallback identifiers.
    #[serde(default)]
    pub reader_translation_llm_fallbacks: Vec<String>,
    /// Whether Apple built-in fallback is enabled.
    pub reader_translation_apple_fallback_enabled: bool,
    /// Translation provider runtime settings keyed by provider id.
    #[serde(default)]
    pub reader_translation_provider_settings: HashMap<String, ReaderTranslationProviderSettings>,
    /// Whether translation is automatically enabled for all entries.
    #[serde(default)]
    pub reader_translation_auto_enabled: bool,
    /// Feed IDs excluded from immersive translation.
    #[serde(default)]
    pub reader_translation_excluded_feed_ids: Vec<String>,
    /// Category IDs excluded from immersive translation.
    #[serde(default)]
    pub reader_translation_excluded_category_ids: Vec<String>,
    /// Default download path for images (null = ask every time)
    pub image_download_path: Option<String>,
    /// Default download path for videos (null = ask every time)
    pub video_download_path: Option<String>,
    /// Whether AI summary is automatically generated when opening an article.
    #[serde(default)]
    pub ai_summary_auto_enabled: bool,
    /// Custom system prompt for AI summary. If None or empty, uses built-in default.
    #[serde(default)]
    pub ai_summary_custom_prompt: Option<String>,
    /// Preferred LLM provider for AI summary (e.g. "ollama", "openai"). If None, uses translation LLM fallback chain.
    #[serde(default)]
    pub ai_summary_provider: Option<String>,
    /// Preferred model for AI summary (e.g. "llama3", "gpt-4o"). If None, uses the model from provider settings.
    #[serde(default)]
    pub ai_summary_model: Option<String>,
    /// Maximum article text length (in characters) sent to the LLM for summarization.
    #[serde(default = "default_ai_summary_max_text_length")]
    pub ai_summary_max_text_length: u32,
    /// Player display mode: floating window or tray popover
    pub player_display_mode: PlayerDisplayMode,
    /// Custom keyboard shortcut overrides. Keys are action IDs, values are shortcut strings.
    #[serde(default)]
    pub keyboard_shortcuts: HashMap<String, String>,
    /// Frontend log level. One of: "trace", "debug", "info", "warn", "error".
    #[serde(default = "default_log_level")]
    pub log_level: String,
    /// Time display format: "12h" or "24h". Defaults to "24h".
    #[serde(default = "default_time_format")]
    pub time_format: String,
    /// Sync interval in minutes. None or 0 means manual sync only.
    #[serde(default)]
    pub sync_interval: Option<u32>,
    /// Whether to automatically check for app updates.
    #[serde(default = "default_auto_check_updates")]
    pub auto_check_updates: bool,
    /// Action for swipe-left gesture in reader (e.g. "open_in_app_browser", "toggle_read", "none").
    #[serde(default = "default_gesture_swipe_left_action")]
    pub gesture_swipe_left_action: String,
    /// Action for swipe-right gesture in reader (e.g. "close_browser", "toggle_star", "none").
    #[serde(default = "default_gesture_swipe_right_action")]
    pub gesture_swipe_right_action: String,
    /// Action for pull-from-top gesture in reader (e.g. "prev_article", "none").
    #[serde(default = "default_gesture_pull_top_action")]
    pub gesture_pull_top_action: String,
    /// Action for pull-from-bottom gesture in reader (e.g. "next_article", "none").
    #[serde(default = "default_gesture_pull_bottom_action")]
    pub gesture_pull_bottom_action: String,
    /// Swipe distance threshold in pixels (100-400).
    #[serde(default = "default_gesture_swipe_threshold")]
    pub gesture_swipe_threshold: u32,
}

fn default_auto_check_updates() -> bool {
    true
}

fn default_gesture_swipe_left_action() -> String {
    "open_in_app_browser".to_string()
}

fn default_gesture_swipe_right_action() -> String {
    "toggle_read".to_string()
}

fn default_gesture_pull_top_action() -> String {
    "prev_article".to_string()
}

fn default_gesture_pull_bottom_action() -> String {
    "next_article".to_string()
}

const fn default_gesture_swipe_threshold() -> u32 {
    250
}

fn default_log_level() -> String {
    "info".to_string()
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
            reader_line_height: 1.75,
            reader_font_family: "sans-serif".to_string(),
            reader_theme: "default".to_string(),
            reader_code_theme: "auto".to_string(),
            reader_chinese_conversion: ChineseConversionMode::S2tw,
            reader_bionic_reading: false,
            reader_status_bar: false,
            reader_focus_mode: false,
            reader_auto_mark_read: false,
            reader_custom_conversions: vec![],
            reader_translation_display_mode: ReaderTranslationDisplayMode::Bilingual,
            reader_translation_trigger_mode: ReaderTranslationTriggerMode::Manual,
            reader_translation_route_mode: ReaderTranslationRouteMode::EngineFirst,
            reader_translation_target_language: None,
            reader_translation_primary_engine: Some("deepl".to_string()),
            reader_translation_engine_fallbacks: vec!["google_translate".to_string()],
            reader_translation_llm_fallbacks: vec![],
            reader_translation_apple_fallback_enabled: false,
            reader_translation_provider_settings: HashMap::new(),
            reader_translation_auto_enabled: false,
            reader_translation_excluded_feed_ids: vec![],
            reader_translation_excluded_category_ids: vec![],
            ai_summary_auto_enabled: false,
            ai_summary_custom_prompt: None,
            ai_summary_provider: None,
            ai_summary_model: None,
            ai_summary_max_text_length: default_ai_summary_max_text_length(),
            image_download_path: None,
            video_download_path: None,
            player_display_mode: PlayerDisplayMode::FloatingWindow,
            keyboard_shortcuts: HashMap::new(),
            log_level: default_log_level(),
            time_format: default_time_format(),
            sync_interval: Some(15),
            auto_check_updates: true,
            gesture_swipe_left_action: default_gesture_swipe_left_action(),
            gesture_swipe_right_action: default_gesture_swipe_right_action(),
            gesture_pull_top_action: default_gesture_pull_top_action(),
            gesture_pull_bottom_action: default_gesture_pull_bottom_action(),
            gesture_swipe_threshold: default_gesture_swipe_threshold(),
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
    line_height: f32,
    font_family: &str,
) -> Result<(), String> {
    if !(14..=24).contains(&font_size) {
        return Err("Font size must be between 14 and 24".to_string());
    }
    if !(45..=80).contains(&line_width) {
        return Err("Line width must be between 45 and 80".to_string());
    }
    if !line_height.is_finite() || !(1.4..=2.2).contains(&line_height) {
        return Err("Line height must be between 1.4 and 2.2".to_string());
    }
    match font_family {
        "sans-serif" | "system-ui" | "humanist" | "serif" | "georgia" | "book-serif"
        | "monospace" => Ok(()),
        _ => Err("Invalid font family: must be one of 'sans-serif', 'system-ui', 'humanist', 'serif', 'georgia', 'book-serif', or 'monospace'".to_string()),
    }
}

/// Validates reader theme value.
pub fn validate_reader_theme(theme: &str) -> Result<(), String> {
    match theme {
        "default" | "paper" | "sepia" | "slate" | "oled" => Ok(()),
        _ => Err(
            "Invalid reader theme: must be one of 'default', 'paper', 'sepia', 'slate', or 'oled'"
                .to_string(),
        ),
    }
}

/// Validates chinese conversion mode value.
pub fn validate_chinese_conversion_mode(mode: ChineseConversionMode) -> Result<(), String> {
    match mode {
        ChineseConversionMode::Off
        | ChineseConversionMode::S2tw
        | ChineseConversionMode::S2hk
        | ChineseConversionMode::T2s => Ok(()),
    }
}

/// Validates custom Chinese conversion rules.
pub fn validate_custom_chinese_conversions(rules: &[ChineseConversionRule]) -> Result<(), String> {
    const MAX_RULES: usize = 200;
    const MAX_TERM_LENGTH: usize = 100;

    if rules.len() > MAX_RULES {
        return Err(format!(
            "Too many custom conversion rules (max {MAX_RULES})"
        ));
    }

    for rule in rules {
        let from = rule.from.trim();
        let to = rule.to.trim();

        if from.is_empty() {
            return Err("Custom conversion 'from' term cannot be empty".to_string());
        }
        if from.chars().count() > MAX_TERM_LENGTH {
            return Err(format!(
                "Custom conversion 'from' term too long (max {MAX_TERM_LENGTH} characters)"
            ));
        }
        if to.chars().count() > MAX_TERM_LENGTH {
            return Err(format!(
                "Custom conversion 'to' term too long (max {MAX_TERM_LENGTH} characters)"
            ));
        }
    }

    Ok(())
}

/// Validates reader translation fallback lists and fallback item lengths.
pub fn validate_reader_translation_fallbacks(
    fallbacks: &[String],
    field_name: &str,
) -> Result<(), String> {
    const MAX_READER_TRANSLATION_FALLBACK_ITEMS: usize = 8;
    const MAX_READER_TRANSLATION_FALLBACK_ITEM_LENGTH: usize = 64;

    if fallbacks.len() > MAX_READER_TRANSLATION_FALLBACK_ITEMS {
        return Err(format!(
            "{field_name} has too many items (max {MAX_READER_TRANSLATION_FALLBACK_ITEMS})"
        ));
    }

    for fallback in fallbacks {
        if fallback.trim().is_empty() {
            return Err(format!("{field_name} cannot contain empty items"));
        }

        let fallback_len = fallback.chars().count();
        if fallback_len > MAX_READER_TRANSLATION_FALLBACK_ITEM_LENGTH {
            return Err(format!(
                "{field_name} item too long (max {MAX_READER_TRANSLATION_FALLBACK_ITEM_LENGTH} characters)"
            ));
        }
    }

    Ok(())
}

/// Validates translation provider runtime settings.
pub fn validate_reader_translation_provider_settings(
    provider_settings: &HashMap<String, ReaderTranslationProviderSettings>,
) -> Result<(), String> {
    const MAX_PROVIDER_SETTINGS_ITEMS: usize = 32;
    const MAX_PROVIDER_ID_LENGTH: usize = 64;
    const MAX_PROVIDER_BASE_URL_LENGTH: usize = 2_048;
    const MAX_PROVIDER_MODEL_LENGTH: usize = 128;
    const MIN_PROVIDER_TIMEOUT_MS: u32 = 500;
    const MAX_PROVIDER_TIMEOUT_MS: u32 = 120_000;
    const MAX_PROVIDER_SYSTEM_PROMPT_LENGTH: usize = 2_048;

    if provider_settings.len() > MAX_PROVIDER_SETTINGS_ITEMS {
        return Err(format!(
            "reader_translation_provider_settings has too many items (max {MAX_PROVIDER_SETTINGS_ITEMS})"
        ));
    }

    for (provider_id, settings) in provider_settings {
        let provider_id_trimmed = provider_id.trim();
        if provider_id_trimmed.is_empty() {
            return Err(
                "reader_translation_provider_settings contains an empty provider id".to_string(),
            );
        }

        if provider_id_trimmed.chars().count() > MAX_PROVIDER_ID_LENGTH {
            return Err(format!(
                "reader_translation_provider_settings provider id too long (max {MAX_PROVIDER_ID_LENGTH} characters)"
            ));
        }

        if let Some(base_url) = &settings.base_url {
            let base_url_trimmed = base_url.trim();
            if base_url_trimmed.is_empty() {
                return Err(format!(
                    "reader_translation_provider_settings[{provider_id_trimmed}].base_url cannot be empty when set"
                ));
            }
            if base_url_trimmed.chars().count() > MAX_PROVIDER_BASE_URL_LENGTH {
                return Err(format!(
                    "reader_translation_provider_settings[{provider_id_trimmed}].base_url too long (max {MAX_PROVIDER_BASE_URL_LENGTH} characters)"
                ));
            }
        }

        if let Some(model) = &settings.model {
            let model_trimmed = model.trim();
            if model_trimmed.is_empty() {
                return Err(format!(
                    "reader_translation_provider_settings[{provider_id_trimmed}].model cannot be empty when set"
                ));
            }
            if model_trimmed.chars().count() > MAX_PROVIDER_MODEL_LENGTH {
                return Err(format!(
                    "reader_translation_provider_settings[{provider_id_trimmed}].model too long (max {MAX_PROVIDER_MODEL_LENGTH} characters)"
                ));
            }
        }

        if let Some(timeout_ms) = settings.timeout_ms {
            if !(MIN_PROVIDER_TIMEOUT_MS..=MAX_PROVIDER_TIMEOUT_MS).contains(&timeout_ms) {
                return Err(format!(
                    "reader_translation_provider_settings[{provider_id_trimmed}].timeout_ms out of range ({MIN_PROVIDER_TIMEOUT_MS}-{MAX_PROVIDER_TIMEOUT_MS})"
                ));
            }
        }

        if let Some(system_prompt) = &settings.system_prompt {
            let prompt_trimmed = system_prompt.trim();
            if prompt_trimmed.is_empty() {
                return Err(format!(
                    "reader_translation_provider_settings[{provider_id_trimmed}].system_prompt cannot be empty when set"
                ));
            }
            if prompt_trimmed.chars().count() > MAX_PROVIDER_SYSTEM_PROMPT_LENGTH {
                return Err(format!(
                    "reader_translation_provider_settings[{provider_id_trimmed}].system_prompt too long (max {MAX_PROVIDER_SYSTEM_PROMPT_LENGTH} characters)"
                ));
            }
        }
    }

    Ok(())
}

/// Validates reader code theme identifier.
pub fn validate_reader_code_theme(theme: &str) -> Result<(), String> {
    let trimmed = theme.trim();
    if trimmed.is_empty() {
        return Err("Invalid reader code theme: cannot be empty".to_string());
    }

    if trimmed.chars().count() > 64 {
        return Err("Invalid reader code theme: maximum length is 64 characters".to_string());
    }

    Ok(())
}

/// Cached translation entry stored on disk.
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub struct TranslationCacheEntry {
    pub translated_text: String,
    pub provider_used: String,
    #[serde(
        serialize_with = "crate::utils::serde_helpers::serialize_i64_as_string",
        deserialize_with = "crate::utils::serde_helpers::deserialize_i64_from_string_or_number"
    )]
    #[specta(type = String)]
    pub cached_at: i64,
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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn app_preferences_defaults_include_reader_translation_preferences() {
        let preferences = AppPreferences::default();

        assert!(matches!(
            preferences.reader_translation_display_mode,
            ReaderTranslationDisplayMode::Bilingual
        ));
        assert!(matches!(
            preferences.reader_translation_trigger_mode,
            ReaderTranslationTriggerMode::Manual
        ));
        assert!(matches!(
            preferences.reader_translation_route_mode,
            ReaderTranslationRouteMode::EngineFirst
        ));
        assert_eq!(preferences.reader_translation_target_language, None);
        assert_eq!(
            preferences.reader_translation_primary_engine,
            Some("deepl".to_string())
        );
        assert_eq!(
            preferences.reader_translation_engine_fallbacks,
            vec!["google_translate".to_string()]
        );
        assert!(preferences.reader_translation_llm_fallbacks.is_empty());
        assert!(!preferences.reader_translation_apple_fallback_enabled);
        assert!(preferences.reader_translation_provider_settings.is_empty());
    }

    #[test]
    fn validate_reader_translation_provider_settings_rejects_invalid_timeout() {
        let mut provider_settings = HashMap::new();
        provider_settings.insert(
            "openai".to_string(),
            ReaderTranslationProviderSettings {
                enabled: true,
                base_url: Some("https://api.openai.com/v1".to_string()),
                model: Some("gpt-4o-mini".to_string()),
                timeout_ms: Some(200),
                system_prompt: None,
            },
        );

        let result = validate_reader_translation_provider_settings(&provider_settings);
        assert!(result.is_err());
    }

    #[test]
    fn validate_provider_settings_rejects_whitespace_only_system_prompt() {
        let mut provider_settings = HashMap::new();
        provider_settings.insert(
            "openai".to_string(),
            ReaderTranslationProviderSettings {
                enabled: true,
                base_url: None,
                model: Some("gpt-4o".to_string()),
                timeout_ms: None,
                system_prompt: Some("   ".to_string()),
            },
        );
        let result = validate_reader_translation_provider_settings(&provider_settings);
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("system_prompt"));
    }

    #[test]
    fn validate_provider_settings_rejects_empty_system_prompt() {
        let mut provider_settings = HashMap::new();
        provider_settings.insert(
            "openai".to_string(),
            ReaderTranslationProviderSettings {
                enabled: true,
                base_url: None,
                model: Some("gpt-4o".to_string()),
                timeout_ms: None,
                system_prompt: Some("".to_string()),
            },
        );
        let result = validate_reader_translation_provider_settings(&provider_settings);
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("system_prompt"));
    }

    #[test]
    fn validate_provider_settings_rejects_system_prompt_too_long() {
        let mut provider_settings = HashMap::new();
        provider_settings.insert(
            "openai".to_string(),
            ReaderTranslationProviderSettings {
                enabled: true,
                base_url: None,
                model: Some("gpt-4o".to_string()),
                timeout_ms: None,
                system_prompt: Some("x".repeat(2049)),
            },
        );
        let result = validate_reader_translation_provider_settings(&provider_settings);
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("system_prompt"));
    }

    #[test]
    fn validate_provider_settings_accepts_valid_system_prompt() {
        let mut provider_settings = HashMap::new();
        provider_settings.insert(
            "openai".to_string(),
            ReaderTranslationProviderSettings {
                enabled: true,
                base_url: None,
                model: Some("gpt-4o".to_string()),
                timeout_ms: None,
                system_prompt: Some("You are a translator.".to_string()),
            },
        );
        let result = validate_reader_translation_provider_settings(&provider_settings);
        assert!(result.is_ok());
    }

    #[test]
    fn validate_provider_settings_accepts_none_system_prompt() {
        let mut provider_settings = HashMap::new();
        provider_settings.insert(
            "openai".to_string(),
            ReaderTranslationProviderSettings {
                enabled: true,
                base_url: None,
                model: Some("gpt-4o".to_string()),
                timeout_ms: None,
                system_prompt: None,
            },
        );
        let result = validate_reader_translation_provider_settings(&provider_settings);
        assert!(result.is_ok());
    }

    #[test]
    fn app_preferences_translation_auto_enabled_defaults_to_false() {
        let prefs = AppPreferences::default();
        assert!(!prefs.reader_translation_auto_enabled);
    }

    #[test]
    fn app_preferences_translation_auto_enabled_deserializes_missing_field_as_false() {
        let json = "{}";
        let prefs: AppPreferences = serde_json::from_str(json).unwrap();
        assert!(!prefs.reader_translation_auto_enabled);
    }
}
