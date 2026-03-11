//! Cloud sync commands for S3 and WebDAV storage.

use serde::{Deserialize, Serialize};
use specta::Type;
use tauri::{AppHandle, Manager};

use crate::cloud_sync::{keyring, s3, webdav};
use crate::commands::preferences::{get_preferences_path, load_preferences};
use crate::types::AppPreferences;
use crate::AppState;

/// Payload for the sync file stored remotely.
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

/// Save WebDAV password to keyring.
#[tauri::command]
#[specta::specta]
pub async fn cloud_sync_save_webdav_password(password: String) -> Result<(), String> {
    keyring::save_webdav_password(&password)
}

/// Delete all cloud sync credentials from keyring.
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

/// Check if WebDAV password exists in keyring.
#[tauri::command]
#[specta::specta]
pub async fn cloud_sync_has_webdav_credentials() -> Result<bool, String> {
    Ok(keyring::get_webdav_password().is_ok())
}

/// Test S3 connection. Uses provided credentials, or falls back to keyring if empty.
#[tauri::command]
#[specta::specta]
pub async fn cloud_sync_test_connection(
    endpoint: String,
    bucket: String,
    region: String,
    access_key: String,
    secret_key: String,
) -> Result<(), String> {
    let ak = if access_key.is_empty() {
        keyring::get_access_key()?
    } else {
        access_key
    };
    let sk = if secret_key.is_empty() {
        keyring::get_secret_key()?
    } else {
        secret_key
    };
    s3::test_connection(&endpoint, &bucket, &region, &ak, &sk).await
}

/// Test WebDAV connection. Uses provided password, or falls back to keyring if empty.
#[tauri::command]
#[specta::specta]
pub async fn cloud_sync_test_webdav_connection(
    url: String,
    username: String,
    password: String,
) -> Result<(), String> {
    let pw = if password.is_empty() {
        keyring::get_webdav_password()?
    } else {
        password
    };
    webdav::test_connection(&url, &username, &pw).await
}

/// Push current preferences + server URLs to remote storage.
#[tauri::command]
#[specta::specta]
pub async fn cloud_sync_push(app: AppHandle) -> Result<(), String> {
    let prefs = load_preferences(app.clone()).await?;

    if !prefs.cloud_sync_enabled {
        return Err("Cloud sync is not enabled".to_string());
    }

    let server_urls = get_server_urls(&app).await;

    let sync_prefs = prefs.to_sync_json()?;
    let mut payload = serde_json::Map::new();
    payload.insert("preferences".to_string(), sync_prefs);
    payload.insert(
        "server_urls".to_string(),
        serde_json::to_value(&server_urls)
            .map_err(|e| format!("Failed to serialize server URLs: {e}"))?,
    );
    payload.insert(
        "synced_at".to_string(),
        serde_json::Value::String(chrono::Utc::now().to_rfc3339()),
    );

    let json = serde_json::to_string_pretty(&payload)
        .map_err(|e| format!("Failed to serialize sync data: {e}"))?;

    match prefs.cloud_sync_protocol.as_str() {
        "webdav" => {
            let url = prefs
                .cloud_sync_webdav_url
                .as_deref()
                .ok_or("WebDAV URL not configured")?;
            let username = prefs
                .cloud_sync_webdav_username
                .as_deref()
                .ok_or("WebDAV username not configured")?;
            webdav::push(url, username, &prefs.cloud_sync_webdav_path, &json).await?;
        }
        _ => {
            let endpoint = prefs
                .cloud_sync_endpoint
                .as_deref()
                .ok_or("Cloud sync endpoint not configured")?;
            let bucket = prefs
                .cloud_sync_bucket
                .as_deref()
                .ok_or("Cloud sync bucket not configured")?;
            s3::push(
                endpoint,
                bucket,
                &prefs.cloud_sync_region,
                &prefs.cloud_sync_object_key,
                &json,
            )
            .await?;
        }
    }

    // Save last synced timestamp
    save_last_synced(&app)?;
    Ok(())
}

/// Pull preferences + server URLs from remote storage.
#[tauri::command]
#[specta::specta]
pub async fn cloud_sync_pull(app: AppHandle) -> Result<AppPreferences, String> {
    let prefs = load_preferences(app.clone()).await?;

    let json = match prefs.cloud_sync_protocol.as_str() {
        "webdav" => {
            let url = prefs
                .cloud_sync_webdav_url
                .as_deref()
                .ok_or("WebDAV URL not configured")?;
            let username = prefs
                .cloud_sync_webdav_username
                .as_deref()
                .ok_or("WebDAV username not configured")?;
            webdav::pull(url, username, &prefs.cloud_sync_webdav_path).await?
        }
        _ => {
            let endpoint = prefs
                .cloud_sync_endpoint
                .as_deref()
                .ok_or("Cloud sync endpoint not configured")?;
            let bucket = prefs
                .cloud_sync_bucket
                .as_deref()
                .ok_or("Cloud sync bucket not configured")?;
            s3::pull(
                endpoint,
                bucket,
                &prefs.cloud_sync_region,
                &prefs.cloud_sync_object_key,
            )
            .await?
        }
    };

    let payload: CloudSyncPayload =
        serde_json::from_str(&json).map_err(|e| format!("Failed to parse sync data: {e}"))?;

    // Merge pulled preferences, preserving local-only fields (paths, last_synced)
    let mut merged = prefs;
    merged.merge_from_cloud(&payload.preferences);
    merged.cloud_sync_last_synced = Some(chrono::Utc::now().to_rfc3339());

    // Auto-download background image from synced URL if no local file exists
    if let Some(ref url) = merged.background_image_url {
        let needs_download = match &merged.background_image_path {
            None => true,
            Some(path) => !std::path::Path::new(path).exists(),
        };
        if needs_download {
            match crate::commands::preferences::download_background_image(app.clone(), url.clone())
                .await
            {
                Ok(cached_path) => {
                    log::info!("Auto-downloaded background image from synced URL");
                    merged.background_image_path = Some(cached_path);
                }
                Err(e) => {
                    log::warn!("Failed to auto-download background image: {e}");
                }
            }
        }
    }

    // Apply merged preferences to disk
    let prefs_path = get_preferences_path(&app)?;
    let prefs_json = serde_json::to_string_pretty(&merged)
        .map_err(|e| format!("Failed to serialize preferences: {e}"))?;

    let temp_path = prefs_path.with_extension("tmp");
    std::fs::write(&temp_path, &prefs_json)
        .map_err(|e| format!("Failed to write preferences: {e}"))?;
    std::fs::rename(&temp_path, &prefs_path)
        .map_err(|e| format!("Failed to finalize preferences: {e}"))?;

    log::info!("Cloud sync pull applied successfully");
    Ok(merged)
}

/// Save the current timestamp as the last synced time in preferences.
fn save_last_synced(app: &AppHandle) -> Result<(), String> {
    let prefs_path = get_preferences_path(app)?;
    let json =
        std::fs::read_to_string(&prefs_path).map_err(|e| format!("Failed to read prefs: {e}"))?;
    let mut prefs: AppPreferences =
        serde_json::from_str(&json).map_err(|e| format!("Failed to parse prefs: {e}"))?;
    prefs.cloud_sync_last_synced = Some(chrono::Utc::now().to_rfc3339());
    let updated = serde_json::to_string_pretty(&prefs)
        .map_err(|e| format!("Failed to serialize prefs: {e}"))?;
    let temp_path = prefs_path.with_extension("sync-tmp");
    std::fs::write(&temp_path, &updated)
        .map_err(|e| format!("Failed to write prefs: {e}"))?;
    std::fs::rename(&temp_path, &prefs_path)
        .map_err(|e| format!("Failed to finalize prefs: {e}"))?;
    Ok(())
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
