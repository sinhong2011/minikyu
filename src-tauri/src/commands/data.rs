//! Local data management commands.
//!
//! Provides destructive and diagnostic actions for local user data.

use std::path::Path;

use serde::Serialize;
use specta::Type;
use tauri::{AppHandle, Manager, State};

use crate::accounts::error::AccountError;
use crate::accounts::keyring::delete_credentials;
use crate::database::connection::{get_db_path, init_database_pool};
use crate::AppState;

/// Size information for a single data file or directory.
#[derive(Debug, Clone, Serialize, Type)]
pub struct DataFileSize {
    /// Display name of the data file
    pub name: String,
    /// Size in bytes
    pub bytes: u64,
    /// Whether the file/directory exists
    pub exists: bool,
}

/// Aggregate local data size information.
#[derive(Debug, Clone, Serialize, Type)]
pub struct LocalDataSize {
    /// Individual file sizes
    pub files: Vec<DataFileSize>,
    /// Total size in bytes
    pub total_bytes: u64,
}

fn get_path_size(path: &Path) -> u64 {
    if !path.exists() {
        return 0;
    }
    if path.is_file() {
        return std::fs::metadata(path).map(|m| m.len()).unwrap_or(0);
    }
    // For directories, sum recursively
    walkdir(path)
}

fn walkdir(dir: &Path) -> u64 {
    let mut total = 0u64;
    if let Ok(entries) = std::fs::read_dir(dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path.is_file() {
                total += std::fs::metadata(&path).map(|m| m.len()).unwrap_or(0);
            } else if path.is_dir() {
                total += walkdir(&path);
            }
        }
    }
    total
}

fn remove_file_if_exists(path: &Path) -> Result<(), String> {
    if path.exists() {
        std::fs::remove_file(path)
            .map_err(|e| format!("Failed to remove file at {path:?}: {e}"))?;
    }
    Ok(())
}

fn remove_dir_if_exists(path: &Path) -> Result<(), String> {
    if path.exists() {
        std::fs::remove_dir_all(path)
            .map_err(|e| format!("Failed to remove directory at {path:?}: {e}"))?;
    }
    Ok(())
}

/// Returns the size of all local data files.
#[tauri::command]
#[specta::specta]
pub async fn get_local_data_size(app_handle: AppHandle) -> Result<LocalDataSize, String> {
    let app_data_dir = app_handle
        .path()
        .app_data_dir()
        .map_err(|e| format!("Failed to get app data directory: {e}"))?;

    let db_path = get_db_path(&app_handle)?;
    let wal_path = db_path.with_extension("db-wal");
    let shm_path = db_path.with_extension("db-shm");
    let preferences_path = app_data_dir.join("preferences.json");
    let reading_state_path = app_data_dir.join("last-reading.json");
    let recovery_dir = app_data_dir.join("recovery");
    let downloads_dir = app_data_dir.join("downloads");

    let items: Vec<(&str, &Path)> = vec![
        ("Database", &db_path),
        ("Database WAL", &wal_path),
        ("Database SHM", &shm_path),
        ("Preferences", &preferences_path),
        ("Reading state", &reading_state_path),
        ("Recovery files", &recovery_dir),
        ("Downloads", &downloads_dir),
    ];

    let mut files = Vec::new();
    let mut total_bytes = 0u64;

    for (name, path) in items {
        let exists = path.exists();
        let bytes = get_path_size(path);
        total_bytes += bytes;
        files.push(DataFileSize {
            name: name.to_string(),
            bytes,
            exists,
        });
    }

    Ok(LocalDataSize { files, total_bytes })
}

/// Clears synced data for the current active account only.
///
/// Removes entries, feeds, categories, enclosures, and sync state for the
/// active user. Other accounts' data, preferences, and downloads are preserved.
#[tauri::command]
#[specta::specta]
pub async fn clear_local_data(
    _app_handle: AppHandle,
    state: State<'_, AppState>,
) -> Result<(), String> {
    log::warn!("Clearing local data for the active account");

    let pool = state
        .db_pool
        .lock()
        .await
        .as_ref()
        .ok_or("Database not initialized")?
        .clone();

    // Find the active account
    let active: Option<(i64, String, String)> = sqlx::query_as(
        "SELECT id, server_url, username FROM miniflux_connections WHERE is_active = 1 LIMIT 1",
    )
    .fetch_optional(&pool)
    .await
    .map_err(|e| format!("Failed to query active account: {e}"))?;

    let Some((account_id, server_url, username)) = active else {
        return Err("No active account found".to_string());
    };

    // Resolve the Miniflux user_id for this account
    let user_id: Option<i64> = {
        let guard = state.miniflux.user_id.lock().await;
        *guard
    };

    // If we don't have a cached user_id, try to find it from existing entries
    let user_id = match user_id {
        Some(id) => id,
        None => {
            let maybe: Option<i64> = sqlx::query_scalar(
                "SELECT DISTINCT user_id FROM entries LIMIT 1",
            )
            .fetch_optional(&pool)
            .await
            .map_err(|e| format!("Failed to determine user_id: {e}"))?;

            maybe.ok_or("Cannot determine user_id for cleanup")?
        }
    };

    log::info!(
        "Clearing data for account {} (user_id={}, username={})",
        account_id,
        user_id,
        username
    );

    // Delete in dependency order: enclosures → entries → feeds → categories → sync_state
    sqlx::query(
        "DELETE FROM enclosures WHERE entry_id IN (SELECT id FROM entries WHERE user_id = ?)",
    )
    .bind(user_id)
    .execute(&pool)
    .await
    .map_err(|e| format!("Failed to delete enclosures: {e}"))?;

    sqlx::query("DELETE FROM entries WHERE user_id = ?")
        .bind(user_id)
        .execute(&pool)
        .await
        .map_err(|e| format!("Failed to delete entries: {e}"))?;

    sqlx::query("DELETE FROM icons WHERE feed_id IN (SELECT id FROM feeds WHERE user_id = ?)")
        .bind(user_id)
        .execute(&pool)
        .await
        .map_err(|e| format!("Failed to delete icons: {e}"))?;

    sqlx::query("DELETE FROM feeds WHERE user_id = ?")
        .bind(user_id)
        .execute(&pool)
        .await
        .map_err(|e| format!("Failed to delete feeds: {e}"))?;

    sqlx::query("DELETE FROM categories WHERE user_id = ?")
        .bind(user_id)
        .execute(&pool)
        .await
        .map_err(|e| format!("Failed to delete categories: {e}"))?;

    sqlx::query("DELETE FROM sync_state WHERE account_id = ?")
        .bind(account_id)
        .execute(&pool)
        .await
        .map_err(|e| format!("Failed to delete sync state: {e}"))?;

    // Clear keyring credentials for this account only
    match delete_credentials(&server_url, &username).await {
        Ok(_) => log::info!("Deleted credentials for {username}"),
        Err(AccountError::NotFound) => log::debug!("No keyring entry for {username}"),
        Err(e) => log::warn!("Failed to delete credentials for {username}: {e}"),
    }

    // Disconnect the Miniflux client
    *state.miniflux.client.lock().await = None;
    *state.miniflux.user_id.lock().await = None;

    log::info!("Local data cleared for account {} ({})", account_id, username);
    Ok(())
}

/// Factory reset: deletes all local data and re-initializes an empty database.
///
/// This is the nuclear option — removes the database, preferences, downloads,
/// recovery files, reading state, and keyring credentials for **all** accounts.
#[tauri::command]
#[specta::specta]
pub async fn factory_reset(
    app_handle: AppHandle,
    state: State<'_, AppState>,
) -> Result<(), String> {
    log::warn!("Factory reset initiated — deleting all local data");

    let app_data_dir = app_handle
        .path()
        .app_data_dir()
        .map_err(|e| format!("Failed to get app data directory: {e}"))?;

    let db_path = get_db_path(&app_handle)?;

    // ── Collect account credentials before closing DB ────────────────
    let accounts: Vec<(String, String)> = {
        let guard = state.db_pool.lock().await;
        if let Some(pool) = guard.as_ref() {
            sqlx::query_as::<_, (String, String)>(
                "SELECT server_url, username FROM miniflux_connections",
            )
            .fetch_all(pool)
            .await
            .unwrap_or_default()
        } else {
            Vec::new()
        }
    };

    // ── Close the DB pool ────────────────────────────────────────────
    {
        let mut guard = state.db_pool.lock().await;
        if let Some(pool) = guard.take() {
            pool.close().await;
        }
    }

    // ── Delete files ─────────────────────────────────────────────────
    let wal_path = db_path.with_extension("db-wal");
    let shm_path = db_path.with_extension("db-shm");
    let preferences_path = app_data_dir.join("preferences.json");
    let reading_state_path = app_data_dir.join("last-reading.json");
    let recovery_dir = app_data_dir.join("recovery");
    let downloads_dir = app_data_dir.join("downloads");

    remove_file_if_exists(&db_path)?;
    remove_file_if_exists(&wal_path)?;
    remove_file_if_exists(&shm_path)?;
    remove_file_if_exists(&preferences_path)?;
    remove_file_if_exists(&reading_state_path)?;
    remove_dir_if_exists(&recovery_dir)?;
    remove_dir_if_exists(&downloads_dir)?;

    // ── Delete keyring credentials for all accounts ──────────────────
    for (server_url, username) in &accounts {
        match delete_credentials(server_url, username).await {
            Ok(()) => log::info!("Deleted credentials for {username}@{server_url}"),
            Err(AccountError::NotFound) => {
                log::debug!("No keyring entry for {username}@{server_url}");
            }
            Err(e) => {
                log::warn!("Failed to delete credentials for {username}@{server_url}: {e}");
            }
        }
    }

    // ── Disconnect Miniflux client ───────────────────────────────────
    *state.miniflux.client.lock().await = None;
    *state.miniflux.user_id.lock().await = None;

    // ── Re-initialize empty database ─────────────────────────────────
    let new_pool = init_database_pool(&app_handle)
        .await
        .map_err(|e| format!("Failed to re-initialize database after factory reset: {e}"))?;
    *state.db_pool.lock().await = Some(new_pool);

    log::info!("Factory reset complete — app re-initialized with empty database");
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::time::{SystemTime, UNIX_EPOCH};

    #[test]
    fn remove_helpers_clean_up_paths() {
        let suffix = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .expect("time ok")
            .as_nanos();
        let root = std::env::temp_dir().join(format!("minikyu-clear-data-{suffix}"));
        let file_path = root.join("test.json");
        let dir_path = root.join("recovery");

        std::fs::create_dir_all(&dir_path).expect("create temp dirs");
        std::fs::write(&file_path, "{}").expect("create temp file");

        remove_file_if_exists(&file_path).expect("remove file");
        remove_dir_if_exists(&dir_path).expect("remove dir");

        assert!(!file_path.exists(), "file should be removed");
        assert!(!dir_path.exists(), "dir should be removed");

        let _ = std::fs::remove_dir_all(&root);
    }
}
