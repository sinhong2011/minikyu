//! Reading state persistence commands.
//!
//! Handles saving and loading the last reading entry to restore user's position on app restart.

use crate::utils::serde_helpers::{deserialize_i64_from_string_or_number, serialize_i64_as_string};
use serde::{Deserialize, Serialize};
use specta::Type;
use std::path::PathBuf;
use tauri::{AppHandle, Manager};

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub struct LastReadingEntry {
    #[serde(
        serialize_with = "serialize_i64_as_string",
        deserialize_with = "deserialize_i64_from_string_or_number"
    )]
    #[specta(type = String)]
    pub entry_id: i64,
    #[serde(
        serialize_with = "serialize_i64_as_string",
        deserialize_with = "deserialize_i64_from_string_or_number"
    )]
    #[specta(type = String)]
    pub timestamp: i64,
}

/// Gets the path to the last reading entry file.
fn get_reading_state_path(app: &AppHandle) -> Result<PathBuf, String> {
    let app_data_dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("Failed to get app data directory: {e}"))?;

    // Ensure the directory exists
    std::fs::create_dir_all(&app_data_dir)
        .map_err(|e| format!("Failed to create app data directory: {e}"))?;

    Ok(app_data_dir.join("last-reading.json"))
}

/// Loads the last reading entry from disk.
/// Returns None (as null in TypeScript) if the file doesn't exist.
#[tauri::command]
#[specta::specta]
pub async fn load_last_reading(app: AppHandle) -> Result<Option<LastReadingEntry>, String> {
    log::debug!("Loading last reading entry from disk");
    let reading_path = get_reading_state_path(&app)?;

    if !reading_path.exists() {
        log::info!("Last reading file not found");
        return Ok(None);
    }

    let contents = std::fs::read_to_string(&reading_path).map_err(|e| {
        log::error!("Failed to read last reading file: {e}");
        format!("Failed to read last reading file: {e}")
    })?;

    let entry: LastReadingEntry = serde_json::from_str(&contents).map_err(|e| {
        log::error!("Failed to parse last reading JSON: {e}");
        format!("Failed to parse last reading: {e}")
    })?;

    log::info!("Successfully loaded last reading entry: {}", entry.entry_id);
    Ok(Some(entry))
}

/// Saves the last reading entry to disk.
/// Uses atomic write (temp file + rename) to prevent corruption.
#[tauri::command]
#[specta::specta]
pub async fn save_last_reading(app: AppHandle, entry: LastReadingEntry) -> Result<(), String> {
    log::debug!("Saving last reading entry to disk: {}", entry.entry_id);
    let reading_path = get_reading_state_path(&app)?;

    let json_content = serde_json::to_string_pretty(&entry).map_err(|e| {
        log::error!("Failed to serialize last reading entry: {e}");
        format!("Failed to serialize last reading entry: {e}")
    })?;

    let parent_dir = reading_path
        .parent()
        .ok_or_else(|| "Invalid reading state path".to_string())?;

    let temp_path = parent_dir.join(format!(".{}.tmp", uuid::Uuid::new_v4()));

    log::debug!("Writing to temp path: {temp_path:?}");
    std::fs::write(&temp_path, &json_content).map_err(|e| {
        log::error!("Failed to write last reading file to {temp_path:?}: {e}");
        format!("Failed to write last reading file: {e}")
    })?;

    log::debug!("Renaming {temp_path:?} to {reading_path:?}");
    std::fs::rename(&temp_path, &reading_path).map_err(|e| {
        log::error!("Failed to rename {temp_path:?} to {reading_path:?}: {e}");
        let _ = std::fs::remove_file(&temp_path);
        format!("Failed to finalize last reading file: {e}")
    })?;

    log::info!("Successfully saved last reading entry to {reading_path:?}");
    Ok(())
}
