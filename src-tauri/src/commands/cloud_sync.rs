//! Cloud sync commands for S3-compatible storage.

use serde::{Deserialize, Serialize};
use specta::Type;
use tauri::{AppHandle, Manager};

use crate::cloud_sync::{keyring, s3};
use crate::commands::preferences::{get_preferences_path, load_preferences};
use crate::types::AppPreferences;
use crate::AppState;

/// Payload for the sync file stored in S3.
#[derive(Debug, Serialize, Deserialize, Type)]
pub struct CloudSyncPayload {
    pub preferences: AppPreferences,
    pub server_urls: Vec<String>,
    pub synced_at: String,
}

/// Save S3 credentials to keyring.
#[tauri::command]
#[specta::specta]
pub async fn cloud_sync_save_credentials(
    access_key: String,
    secret_key: String,
) -> Result<(), String> {
    keyring::save_access_key(&access_key)?;
    keyring::save_secret_key(&secret_key)?;
    Ok(())
}

/// Delete S3 credentials from keyring.
#[tauri::command]
#[specta::specta]
pub async fn cloud_sync_delete_credentials() -> Result<(), String> {
    keyring::delete_credentials()
}

/// Check if S3 credentials exist in keyring.
#[tauri::command]
#[specta::specta]
pub async fn cloud_sync_has_credentials() -> Result<bool, String> {
    Ok(keyring::get_access_key().is_ok() && keyring::get_secret_key().is_ok())
}

/// Test S3 connection with provided credentials (before saving to keyring).
#[tauri::command]
#[specta::specta]
pub async fn cloud_sync_test_connection(
    endpoint: String,
    bucket: String,
    region: String,
    access_key: String,
    secret_key: String,
) -> Result<(), String> {
    s3::test_connection(&endpoint, &bucket, &region, &access_key, &secret_key).await
}

/// Push current preferences + server URLs to S3.
#[tauri::command]
#[specta::specta]
pub async fn cloud_sync_push(app: AppHandle) -> Result<(), String> {
    let prefs = load_preferences(app.clone()).await?;

    if !prefs.cloud_sync_enabled {
        return Err("Cloud sync is not enabled".to_string());
    }

    let endpoint = prefs
        .cloud_sync_endpoint
        .as_deref()
        .ok_or("Cloud sync endpoint not configured")?;
    let bucket = prefs
        .cloud_sync_bucket
        .as_deref()
        .ok_or("Cloud sync bucket not configured")?;

    let server_urls = get_server_urls(&app).await;

    let payload = CloudSyncPayload {
        preferences: prefs.clone(),
        server_urls,
        synced_at: chrono::Utc::now().to_rfc3339(),
    };

    let json = serde_json::to_string_pretty(&payload)
        .map_err(|e| format!("Failed to serialize sync data: {e}"))?;

    s3::push(
        endpoint,
        bucket,
        &prefs.cloud_sync_region,
        &prefs.cloud_sync_object_key,
        &json,
    )
    .await
}

/// Pull preferences + server URLs from S3.
#[tauri::command]
#[specta::specta]
pub async fn cloud_sync_pull(app: AppHandle) -> Result<CloudSyncPayload, String> {
    let prefs = load_preferences(app.clone()).await?;

    let endpoint = prefs
        .cloud_sync_endpoint
        .as_deref()
        .ok_or("Cloud sync endpoint not configured")?;
    let bucket = prefs
        .cloud_sync_bucket
        .as_deref()
        .ok_or("Cloud sync bucket not configured")?;

    let json = s3::pull(
        endpoint,
        bucket,
        &prefs.cloud_sync_region,
        &prefs.cloud_sync_object_key,
    )
    .await?;

    let payload: CloudSyncPayload = serde_json::from_str(&json)
        .map_err(|e| format!("Failed to parse sync data: {e}"))?;

    // Apply preferences to disk
    let prefs_path = get_preferences_path(&app)?;
    let prefs_json = serde_json::to_string_pretty(&payload.preferences)
        .map_err(|e| format!("Failed to serialize preferences: {e}"))?;

    let temp_path = prefs_path.with_extension("tmp");
    std::fs::write(&temp_path, &prefs_json)
        .map_err(|e| format!("Failed to write preferences: {e}"))?;
    std::fs::rename(&temp_path, &prefs_path)
        .map_err(|e| format!("Failed to finalize preferences: {e}"))?;

    log::info!("Cloud sync pull applied successfully");
    Ok(payload)
}

/// Get server URLs from the accounts database.
async fn get_server_urls(app: &AppHandle) -> Vec<String> {
    let state: tauri::State<'_, AppState> = app.state();
    match crate::commands::accounts::get_miniflux_accounts(app.clone(), state).await {
        Ok(accounts) => accounts.into_iter().map(|a| a.server_url).collect(),
        Err(e) => {
            log::warn!("Failed to get server URLs for cloud sync: {e}");
            vec![]
        }
    }
}
