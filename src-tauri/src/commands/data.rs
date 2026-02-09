//! Local data management commands.
//!
//! Provides destructive actions for clearing local user data.

use std::path::Path;

use sqlx::Row;
use tauri::{AppHandle, Manager, State};

use crate::accounts::error::AccountError;
use crate::accounts::keyring::delete_credentials;
use crate::database::connection::get_db_path;
use crate::AppState;

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

async fn clear_keyring_credentials(state: State<'_, AppState>) -> Result<(), String> {
    let pool = {
        let guard = state.db_pool.lock().await;
        guard.as_ref().cloned()
    };

    let Some(pool) = pool else {
        return Ok(());
    };

    let rows = sqlx::query("SELECT server_url, username FROM miniflux_connections")
        .fetch_all(&pool)
        .await
        .map_err(|e| format!("Failed to read accounts from database: {e}"))?;

    for row in rows {
        let server_url: String = row.get("server_url");
        let username: String = row.get("username");

        match delete_credentials(&server_url, &username).await {
            Ok(_) => {
                log::info!("Deleted credentials for {username} at {server_url}");
            }
            Err(AccountError::NotFound) => {
                log::debug!("No keyring entry for {username} at {server_url}");
            }
            Err(err) => {
                return Err(format!(
                    "Failed to delete credentials for {username} at {server_url}: {err}"
                ));
            }
        }
    }

    Ok(())
}

/// Clears all local app data (database, preferences, reading state, recovery files).
#[tauri::command]
#[specta::specta]
pub async fn clear_local_data(
    app_handle: AppHandle,
    state: State<'_, AppState>,
) -> Result<(), String> {
    log::warn!("Clearing local data on user request");

    clear_keyring_credentials(state.clone()).await?;
    *state.miniflux.client.lock().await = None;

    let pool = {
        let mut guard = state.db_pool.lock().await;
        guard.take()
    };
    if let Some(pool) = pool {
        pool.close().await;
    }

    let app_data_dir = app_handle
        .path()
        .app_data_dir()
        .map_err(|e| format!("Failed to get app data directory: {e}"))?;

    let preferences_path = app_data_dir.join("preferences.json");
    let reading_state_path = app_data_dir.join("last-reading.json");
    let recovery_dir = app_data_dir.join("recovery");

    remove_file_if_exists(&preferences_path)?;
    remove_file_if_exists(&reading_state_path)?;
    remove_dir_if_exists(&recovery_dir)?;

    let db_path = get_db_path(&app_handle)?;
    let wal_path = db_path.with_extension("db-wal");
    let shm_path = db_path.with_extension("db-shm");

    remove_file_if_exists(&db_path)?;
    remove_file_if_exists(&wal_path)?;
    remove_file_if_exists(&shm_path)?;

    let pool = crate::database::init_database_pool(&app_handle)
        .await
        .map_err(|e| format!("Failed to reinitialize database: {e}"))?;
    *state.db_pool.lock().await = Some(pool);

    log::info!("Local data cleared successfully");
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
