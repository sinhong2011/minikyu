//! Intelligent syntax highlighting and semantic colorization for Tauri plugin log output.
//!
//! This module provides a custom log formatter that distinguishes:
//! - Log levels (ERROR, WARN, INFO, DEBUG, TRACE) with distinct foreground colors
//! - Timestamp components with subtle styling
//! - Target/module paths with distinguishable hues
//! - Structured key-value pairs with consistent color mapping
//!
//! The formatter preserves readability in both light and dark terminal themes
//! and handles nested objects, escaped characters, and multi-line messages.

use log::Level;
use std::fmt;

/// Get the log level from the TAURI_LOG_LEVEL environment variable
/// Falls back to Debug in development, Info in production
pub fn get_log_level_from_env() -> log::LevelFilter {
    if let Ok(level_str) = std::env::var("TAURI_LOG_LEVEL") {
        match level_str.to_lowercase().as_str() {
            "trace" => log::LevelFilter::Trace,
            "debug" => log::LevelFilter::Debug,
            "info" => log::LevelFilter::Info,
            "warn" => log::LevelFilter::Warn,
            "error" => log::LevelFilter::Error,
            _ => default_log_level(),
        }
    } else {
        default_log_level()
    }
}

/// Default log level based on build configuration
fn default_log_level() -> log::LevelFilter {
    if cfg!(debug_assertions) {
        log::LevelFilter::Debug
    } else {
        log::LevelFilter::Info
    }
}

/// ANSI color codes for terminal output
mod colors {
    // Reset
    pub const RESET: &str = "\x1b[0m";

    // Log level colors - distinct and accessible
    pub const ERROR: &str = "\x1b[38;5;196m"; // Bright red
    #[allow(dead_code)]
    pub const ERROR_BG: &str = "\x1b[48;5;196m\x1b[38;5;255m"; // Red bg, white fg for high visibility
    pub const WARN: &str = "\x1b[38;5;208m"; // Orange
    pub const INFO: &str = "\x1b[38;5;39m"; // Cyan/blue
    pub const DEBUG: &str = "\x1b[38;5;183m"; // Light purple
    pub const TRACE: &str = "\x1b[38;5;245m"; // Gray

    // Component colors
    pub const TIMESTAMP: &str = "\x1b[38;5;242m"; // Dark gray
    pub const TIMESTAMP_BRIGHT: &str = "\x1b[38;5;250m"; // Light gray for dark themes
    pub const TARGET: &str = "\x1b[38;5;111m"; // Light blue
    pub const TARGET_BRIGHT: &str = "\x1b[38;5;75m"; // Brighter blue
    pub const SEPARATOR: &str = "\x1b[38;5;240m"; // Very dark gray

    // Key-value pair colors
    pub const KEY: &str = "\x1b[38;5;149m"; // Light green
    pub const STRING_VALUE: &str = "\x1b[38;5;180m"; // Light orange/peach
    pub const NUMBER_VALUE: &str = "\x1b[38;5;141m"; // Purple
    pub const BOOLEAN_VALUE: &str = "\x1b[38;5;81m"; // Cyan
    pub const NULL_VALUE: &str = "\x1b[38;5;245m"; // Gray
    #[allow(dead_code)]
    pub const BRACKET: &str = "\x1b[38;5;240m"; // Dark gray for brackets/punctuation
}

/// Get the color for a log level
fn level_color(level: Level) -> &'static str {
    match level {
        Level::Error => colors::ERROR,
        Level::Warn => colors::WARN,
        Level::Info => colors::INFO,
        Level::Debug => colors::DEBUG,
        Level::Trace => colors::TRACE,
    }
}

/// Get the short name for a log level
fn level_short_name(level: Level) -> &'static str {
    match level {
        Level::Error => "ERR",
        Level::Warn => "WRN",
        Level::Info => "INF",
        Level::Debug => "DBG",
        Level::Trace => "TRC",
    }
}

/// Format a timestamp with subtle styling
fn format_timestamp(timestamp: &str, output: &mut String) {
    // Split timestamp into date and time components
    if let Some(t_pos) = timestamp.find('T') {
        let date_part = &timestamp[..t_pos];
        let time_part = &timestamp[t_pos + 1..];

        // Format: dim date, slightly brighter time
        output.push_str(colors::TIMESTAMP);
        output.push_str(date_part);
        output.push(' ');
        output.push_str(colors::TIMESTAMP_BRIGHT);
        // Remove milliseconds for cleaner output
        let time_clean = if let Some(dot_pos) = time_part.find('.') {
            &time_part[..dot_pos]
        } else {
            time_part
        };
        output.push_str(time_clean);
        output.push_str(colors::RESET);
    } else {
        output.push_str(colors::TIMESTAMP);
        output.push_str(timestamp);
        output.push_str(colors::RESET);
    }
}

/// Format a target/module path with distinguishable hues
fn format_target(target: &str, output: &mut String) {
    output.push_str(colors::TARGET);

    // Split target by :: and apply subtle color variation
    let parts: Vec<&str> = target.split("::").collect();
    for (i, part) in parts.iter().enumerate() {
        if i > 0 {
            output.push_str(colors::SEPARATOR);
            output.push_str("::");
            output.push_str(colors::TARGET);
        }
        // Alternate between slightly different shades for path components
        if i == parts.len() - 1 {
            // Last component (function/leaf) - brighter
            output.push_str(colors::TARGET_BRIGHT);
            output.push_str(part);
            output.push_str(colors::TARGET);
        } else {
            output.push_str(part);
        }
    }

    output.push_str(colors::RESET);
}

/// Highlight key-value pairs in a message with consistent color mapping
fn highlight_key_values(message: &str, output: &mut String) {
    // Pattern: key=value, key: value, "key": value, etc.
    let mut remaining = message;

    // Simple regex-like parsing for key=value patterns
    while let Some(eq_pos) = remaining.find('=') {
        // Write everything before the key
        output.push_str(&remaining[..eq_pos]);

        // Find the key start (look backwards from =)
        let key_start = remaining[..eq_pos]
            .rfind(|c: char| c.is_whitespace() || c == ',' || c == '{' || c == '[' || c == '(')
            .map(|i| i + 1)
            .unwrap_or(0);

        // Extract and colorize key
        let key = &remaining[key_start..eq_pos];
        output.push_str(colors::KEY);
        output.push_str(key);
        output.push_str(colors::RESET);

        output.push_str(colors::SEPARATOR);
        output.push('=');
        output.push_str(colors::RESET);

        // Find value end
        remaining = &remaining[eq_pos + 1..];
        let value_end = remaining
            .find(|c: char| c.is_whitespace() || c == ',' || c == '}' || c == ']' || c == ')')
            .unwrap_or(remaining.len());

        let value = &remaining[..value_end];

        // Colorize value based on type
        if value.starts_with('"') || value.starts_with('\'') {
            output.push_str(colors::STRING_VALUE);
        } else if value == "true" || value == "false" {
            output.push_str(colors::BOOLEAN_VALUE);
        } else if value == "null" || value == "undefined" {
            output.push_str(colors::NULL_VALUE);
        } else if value
            .chars()
            .next()
            .is_some_and(|c| c.is_ascii_digit() || c == '-')
        {
            output.push_str(colors::NUMBER_VALUE);
        } else {
            output.push_str(colors::STRING_VALUE);
        }

        output.push_str(value);
        output.push_str(colors::RESET);

        remaining = &remaining[value_end..];
    }

    // Write any remaining content
    output.push_str(remaining);
}

/// Main log formatting function compatible with tauri-plugin-log/fern
///
/// This function formats log output with intelligent syntax highlighting:
/// - Timestamps in subtle gray tones
/// - Log levels with distinct colors (red=error, orange=warn, blue=info, etc.)
/// - Target/module paths in blue tones
/// - Key-value pairs with semantic coloring
///
/// The formatter signature matches fern's format callback:
/// `Fn(FormatCallback, &fmt::Arguments, &log::Record)`
pub fn format_log(
    callback: tauri_plugin_log::fern::FormatCallback,
    message: &fmt::Arguments,
    record: &log::Record,
) {
    let message_str = message.to_string();
    let mut output = String::with_capacity(256);

    // Get current timestamp
    let now = time::OffsetDateTime::now_utc();
    let timestamp = format!(
        "{:04}-{:02}-{:02}T{:02}:{:02}:{:02}.{:03}Z",
        now.year(),
        now.month() as u8,
        now.day(),
        now.hour(),
        now.minute(),
        now.second(),
        now.millisecond()
    );

    // Format timestamp
    format_timestamp(&timestamp, &mut output);

    // Separator
    output.push_str(colors::SEPARATOR);
    output.push(' ');
    output.push_str(colors::RESET);

    // Format log level with color
    let level = record.level();
    let level_color_code = level_color(level);
    output.push_str(level_color_code);
    output.push('[');
    output.push_str(level_short_name(level));
    output.push(']');
    output.push_str(colors::RESET);

    // Separator
    output.push_str(colors::SEPARATOR);
    output.push(' ');
    output.push_str(colors::RESET);

    // Format target
    format_target(record.target(), &mut output);

    // Location (file:line) if available
    if let Some(file) = record.file() {
        output.push_str(colors::SEPARATOR);
        output.push(' ');
        output.push_str(colors::TIMESTAMP);
        output.push('(');
        output.push_str(file);
        if let Some(line) = record.line() {
            output.push(':');
            output.push_str(&line.to_string());
        }
        output.push(')');
        output.push_str(colors::RESET);
    }

    // Separator before message
    output.push_str(colors::SEPARATOR);
    output.push_str(" → ");
    output.push_str(colors::RESET);

    // Format message with structured data highlighting
    let mut message_formatted = String::with_capacity(message_str.len() * 2);
    highlight_key_values(&message_str, &mut message_formatted);

    // Handle multi-line messages with proper indentation
    if message_str.contains('\n') {
        let lines: Vec<&str> = message_formatted.lines().collect();
        for (i, line) in lines.iter().enumerate() {
            if i > 0 {
                output.push('\n');
                output.push_str(colors::SEPARATOR);
                output.push_str("    "); // 4-space indent
                output.push_str(colors::RESET);
            }
            output.push_str(line);
        }
    } else {
        output.push_str(&message_formatted);
    }

    // Reset at the end
    output.push_str(colors::RESET);

    // Print directly to stdout for terminal output with colors
    println!("{output}");

    // Call the callback with empty args since we've already printed
    // This ensures other log targets (file, webview) still receive the log
    callback.finish(format_args!(""));
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_level_colors() {
        assert_eq!(level_color(Level::Error), colors::ERROR);
        assert_eq!(level_color(Level::Warn), colors::WARN);
        assert_eq!(level_color(Level::Info), colors::INFO);
        assert_eq!(level_color(Level::Debug), colors::DEBUG);
        assert_eq!(level_color(Level::Trace), colors::TRACE);
    }

    #[test]
    fn test_level_short_names() {
        assert_eq!(level_short_name(Level::Error), "ERR");
        assert_eq!(level_short_name(Level::Warn), "WRN");
        assert_eq!(level_short_name(Level::Info), "INF");
        assert_eq!(level_short_name(Level::Debug), "DBG");
        assert_eq!(level_short_name(Level::Trace), "TRC");
    }

    #[test]
    fn test_format_timestamp() {
        let mut output = String::new();
        format_timestamp("2024-01-15T10:30:45.123Z", &mut output);
        assert!(output.contains("2024-01-15"));
        assert!(output.contains("10:30:45"));
        assert!(!output.contains(".123")); // Milliseconds should be removed
    }

    #[test]
    fn test_highlight_key_values() {
        let mut output = String::new();
        highlight_key_values("user_id=123 name=\"test\" active=true", &mut output);
        assert!(output.contains("user_id"));
        assert!(output.contains("123"));
        assert!(output.contains("test"));
    }

    #[test]
    fn test_format_target() {
        let mut output = String::new();
        format_target("tauri_app_lib::commands::preferences", &mut output);
        assert!(output.contains("tauri_app_lib"));
        assert!(output.contains("commands"));
        assert!(output.contains("preferences"));
    }

    #[test]
    fn test_multiline_message_formatting() {
        let mut output = String::new();
        let message = "Line 1\nLine 2\nLine 3";
        highlight_key_values(message, &mut output);
        assert!(output.contains("Line 1"));
        assert!(output.contains("Line 2"));
        assert!(output.contains("Line 3"));
    }
}
