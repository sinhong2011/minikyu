//! Tauri command handlers organized by domain.
//!
//! Each submodule contains related commands and their helper functions.
//! Import specific commands via their submodule (e.g., `commands::preferences::greet`).

pub mod accounts;
pub mod counters;
pub mod data;
pub mod downloads;
pub mod in_app_browser;
pub mod miniflux;
pub mod notifications;
pub mod player_window;
pub mod podcast;
pub mod preferences;
pub mod quick_pane;
pub mod reading_state;
pub mod recovery;
pub mod summarize;
pub mod sync;
pub mod translation;
pub mod translation_cache;
pub mod tray;
