use crate::accounts::error::AccountError;
use crate::accounts::keyring::{
    delete_credentials, get_password, get_token, save_password, save_token,
};
use crate::miniflux::AuthConfig;
use crate::AppState;
use chrono::Utc;
use serde::{Deserialize, Serialize};
use sqlx::SqlitePool;
use tauri::{AppHandle, Emitter, State};

#[derive(Debug, Clone, Serialize, Deserialize, specta::Type, sqlx::FromRow)]
pub struct MinifluxAccount {
    pub id: i64,
    pub username: String,
    pub server_url: String,
    pub auth_method: String,
    pub is_active: bool,
    pub created_at: String,
    pub updated_at: String,
}

#[tauri::command]
#[specta::specta]
pub async fn save_miniflux_account(
    _app_handle: AppHandle,
    state: State<'_, AppState>,
    config: AuthConfig,
) -> Result<i64, AccountError> {
    log::info!("Saving Miniflux account for: {:?}", config.username);

    let pool = state
        .db_pool
        .lock()
        .await
        .as_ref()
        .ok_or(AccountError::NotFound)?
        .clone();

    let username = config
        .username
        .as_ref()
        .ok_or(AccountError::InvalidCredentials)?
        .trim();

    if username.is_empty() {
        log::error!("Username is empty");
        return Err(AccountError::InvalidCredentials);
    }

    let has_token = config
        .auth_token
        .as_ref()
        .is_some_and(|t| !t.trim().is_empty());
    let has_password = config
        .password
        .as_ref()
        .is_some_and(|p| !p.trim().is_empty());

    if !has_token && !has_password {
        log::error!("Neither token nor password provided");
        return Err(AccountError::InvalidCredentials);
    }

    let auth_method = if has_token { "token" } else { "password" };
    let now = Utc::now().to_rfc3339();

    let existing_account: Option<(i64,)> =
        sqlx::query_as("SELECT id FROM miniflux_accounts WHERE username = ?")
            .bind(username)
            .fetch_optional(&pool)
            .await?;

    let account_id = if let Some((id,)) = existing_account {
        log::info!("Updating existing account with ID: {}", id);

        sqlx::query(
            r#"
            UPDATE miniflux_accounts 
            SET server_url = ?, auth_method = ?, updated_at = ?
            WHERE id = ?
            "#,
        )
        .bind(&config.server_url)
        .bind(auth_method)
        .bind(&now)
        .bind(id)
        .execute(&pool)
        .await?;

        id
    } else {
        log::info!("Creating new account");

        let result = sqlx::query(
            r#"
            INSERT INTO miniflux_accounts (username, server_url, auth_method, is_active, created_at, updated_at)
            VALUES (?, ?, ?, 0, ?, ?)
            "#,
        )
        .bind(username)
        .bind(&config.server_url)
        .bind(auth_method)
        .bind(&now)
        .bind(&now)
        .execute(&pool)
        .await?;

        result.last_insert_rowid()
    };

    sqlx::query("UPDATE miniflux_accounts SET is_active = 0 WHERE username != ?")
        .bind(username)
        .execute(&pool)
        .await?;

    sqlx::query("UPDATE miniflux_accounts SET is_active = 1 WHERE username = ?")
        .bind(username)
        .execute(&pool)
        .await?;

    if let Some(token) = &config.auth_token {
        if !token.trim().is_empty() {
            save_token(&config.server_url, username, token).await?;
            log::debug!("Token saved to keyring");
        }
    }

    if let Some(password) = &config.password {
        if !password.trim().is_empty() {
            save_password(&config.server_url, username, password).await?;
            log::debug!("Password saved to keyring");
        }
    }

    log::info!("Account saved successfully with ID: {}", account_id);

    Ok(account_id)
}

#[tauri::command]
#[specta::specta]
pub async fn get_miniflux_accounts(
    _app_handle: AppHandle,
    state: State<'_, AppState>,
) -> Result<Vec<MinifluxAccount>, AccountError> {
    log::info!("[get_miniflux_accounts] Command invoked");

    let pool = state
        .db_pool
        .lock()
        .await
        .as_ref()
        .ok_or_else(|| {
            log::error!("[get_miniflux_accounts] Database pool not initialized");
            AccountError::NotFound
        })?
        .clone();

    log::info!("[get_miniflux_accounts] Database pool acquired, querying accounts");

    let accounts: Vec<MinifluxAccount> = sqlx::query_as(
        "SELECT id, username, server_url, auth_method, is_active, created_at, updated_at
         FROM miniflux_accounts
         ORDER BY created_at DESC",
    )
    .fetch_all(&pool)
    .await
    .map_err(|e| {
        log::error!("[get_miniflux_accounts] Database query failed: {:#?}", e);
        AccountError::DatabaseError(e.to_string())
    })?;

    log::info!(
        "[get_miniflux_accounts] Query successful, found {} account(s)",
        accounts.len()
    );
    for account in &accounts {
        log::info!(
            "[get_miniflux_accounts] Account: id={}, username={}, server_url={}, is_active={}",
            account.id,
            account.username,
            account.server_url,
            account.is_active
        );
    }

    Ok(accounts)
}

#[tauri::command]
#[specta::specta]
pub async fn get_active_miniflux_account(
    _app_handle: AppHandle,
    state: State<'_, AppState>,
) -> Result<Option<MinifluxAccount>, AccountError> {
    log::info!("Fetching active account");

    let pool = state
        .db_pool
        .lock()
        .await
        .as_ref()
        .ok_or(AccountError::NotFound)?
        .clone();

    let account: Option<MinifluxAccount> = sqlx::query_as(
        "SELECT id, username, server_url, auth_method, is_active, created_at, updated_at
         FROM miniflux_accounts
         WHERE is_active = 1
         LIMIT 1",
    )
    .fetch_optional(&pool)
    .await
    .map_err(|e| {
        log::error!("Failed to fetch active account: {:#?}", e);
        AccountError::DatabaseError(e.to_string())
    })?;

    if let Some(ref acc) = account {
        log::debug!("Found active account: {}", acc.username);
    } else {
        log::debug!("No active account found");
    }

    Ok(account)
}

#[tauri::command]
#[specta::specta]
pub async fn delete_miniflux_account(
    _app_handle: AppHandle,
    state: State<'_, AppState>,
    id: i64,
) -> Result<(), AccountError> {
    log::info!("Deleting account with ID: {}", id);

    let pool = state
        .db_pool
        .lock()
        .await
        .as_ref()
        .ok_or(AccountError::NotFound)?
        .clone();

    delete_miniflux_account_impl(&pool, id).await
}

async fn delete_miniflux_account_impl(pool: &SqlitePool, id: i64) -> Result<(), AccountError> {
    let account: Option<(String, String)> =
        sqlx::query_as("SELECT server_url, username FROM miniflux_accounts WHERE id = ?")
            .bind(id)
            .fetch_optional(pool)
            .await?;

    let (server_url, username) = account.ok_or(AccountError::NotFound)?;

    log::debug!("Deleting account for username: {}", username);

    sqlx::query("DELETE FROM miniflux_accounts WHERE id = ?")
        .bind(id)
        .execute(pool)
        .await?;

    match delete_credentials(&server_url, &username).await {
        Ok(_) => {
            log::debug!("Deleted credentials from keyring");
        }
        Err(AccountError::NotFound) => {
            log::debug!("No credentials found in keyring to delete");
        }
        Err(e) => {
            log::error!("Failed to delete credentials from keyring: {:?}", e);
            return Err(e);
        }
    }

    sqlx::query("DELETE FROM users WHERE server_url = ? AND username = ?")
        .bind(&server_url)
        .bind(&username)
        .execute(pool)
        .await?;

    log::info!("Successfully deleted account with ID: {}", id);

    Ok(())
}

#[tauri::command]
#[specta::specta]
pub async fn auto_reconnect_miniflux(
    app_handle: AppHandle,
    state: State<'_, crate::AppState>,
) -> Result<(), AccountError> {
    log::info!("Auto-reconnect: Attempting to reconnect to Miniflux");

    let pool = state
        .db_pool
        .lock()
        .await
        .as_ref()
        .ok_or(AccountError::NotFound)
        .cloned()?;

    // Query for active account
    let active_account: Option<(i64, String, String, String)> = sqlx::query_as(
        "SELECT id, username, server_url, auth_method FROM miniflux_accounts WHERE is_active = 1",
    )
    .fetch_optional(&pool)
    .await?;

    // If no active account, return early gracefully
    if active_account.is_none() {
        log::info!("Auto-reconnect: No active account found for auto-reconnect");
        return Ok(());
    }

    let (account_id, username, server_url, auth_method) = active_account.unwrap();
    log::debug!(
        "Auto-reconnect: Found active account ID {} for user '{}' at '{}'",
        account_id,
        username,
        server_url
    );

    // Fetch credentials from keyring based on auth_method
    let config = match auth_method.as_str() {
        "token" => {
            let token = get_token(&server_url, &username).await.map_err(|e| {
                log::error!(
                    "Auto-reconnect: Failed to fetch token from keyring: {:?}",
                    e
                );
                e
            })?;
            AuthConfig {
                server_url: server_url.clone(),
                auth_token: Some(token),
                username: None,
                password: None,
            }
        }
        "password" => {
            let password = get_password(&server_url, &username).await.map_err(|e| {
                log::error!(
                    "Auto-reconnect: Failed to fetch password from keyring: {:?}",
                    e
                );
                e
            })?;
            AuthConfig {
                server_url: server_url.clone(),
                auth_token: None,
                username: Some(username.clone()),
                password: Some(password),
            }
        }
        _ => {
            log::error!(
                "Auto-reconnect: Invalid auth_method '{}' for account ID {}",
                auth_method,
                account_id
            );
            return Err(AccountError::InvalidCredentials);
        }
    };

    // Call miniflux_connect to establish connection
    log::debug!("Auto-reconnect: Calling miniflux_connect with fetched credentials");
    match crate::commands::miniflux::miniflux_connect(app_handle.clone(), state, config).await {
        Ok(_) => {
            log::info!("Auto-reconnect: Successfully reconnected to Miniflux");

            if let Err(e) = app_handle.emit("miniflux-connected", ()) {
                log::error!("Failed to emit miniflux-connected event: {}", e);
            }

            Ok(())
        }
        Err(e) => {
            log::error!("Auto-reconnect: Connection failed: {}", e);
            Err(AccountError::KeyringError {
                message: format!("Auto-reconnect failed: {}", e),
            })
        }
    }
}

#[cfg(test)]
#[path = "accounts.test.rs"]
mod tests;
