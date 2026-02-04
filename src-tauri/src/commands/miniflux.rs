use crate::miniflux::{AuthConfig, EntryFilters, EntryUpdate, FeedUpdate, MinifluxClient};
use crate::AppState;
use chrono::Utc;
use std::sync::Arc;
use tauri::{AppHandle, Emitter, State};
use tokio::sync::Mutex;

/// Global state for Miniflux client
#[derive(Clone)]
pub struct MinifluxState {
    pub client: Arc<Mutex<Option<MinifluxClient>>>,
}

/// Connect to Miniflux server
#[tauri::command]
#[specta::specta]
pub async fn miniflux_connect(
    app_handle: AppHandle,
    state: State<'_, AppState>,
    config: AuthConfig,
) -> Result<bool, String> {
    log::info!("Connecting to Miniflux server: {}", config.server_url);

    let server_url = config.server_url.clone();
    let client = if let Some(ref token) = config.auth_token {
        MinifluxClient::new(server_url).with_token(token.clone())
    } else if let (Some(username), Some(password)) =
        (config.username.clone(), config.password.clone())
    {
        MinifluxClient::new(server_url).with_credentials(username, password)
    } else {
        return Err("Either auth_token or username/password must be provided".to_string());
    };

    // Test authentication
    match client.authenticate().await {
        Ok(true) => {
            log::info!("Successfully authenticated with Miniflux server");

            let user = client.get_current_user().await.map_err(|e| {
                log::error!("Failed to fetch current user: {}", e);
                format!("Failed to fetch current user: {}", e)
            })?;

            log::info!("Fetched current user: {} (ID: {})", user.username, user.id);

            *state.miniflux.client.lock().await = Some(client);

            // Initialize database
            let pool = state
                .db_pool
                .lock()
                .await
                .as_ref()
                .ok_or("Database not initialized")?
                .clone();
            let now = Utc::now().to_rfc3339();
            sqlx::query(
                r#"
                INSERT INTO users (
                    id, username, server_url, is_admin, theme, language, timezone,
                    entry_sorting_direction, entries_per_page, keyboard_shortcuts,
                    display_mode, show_reading_time, entry_swipe, custom_css,
                    created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(server_url, username) DO UPDATE SET
                    is_admin = excluded.is_admin,
                    theme = excluded.theme,
                    language = excluded.language,
                    timezone = excluded.timezone,
                    entry_sorting_direction = excluded.entry_sorting_direction,
                    entries_per_page = excluded.entries_per_page,
                    keyboard_shortcuts = excluded.keyboard_shortcuts,
                    display_mode = excluded.display_mode,
                    show_reading_time = excluded.show_reading_time,
                    entry_swipe = excluded.entry_swipe,
                    custom_css = excluded.custom_css,
                    updated_at = excluded.updated_at
                "#,
            )
            .bind(user.id)
            .bind(&user.username)
            .bind(&config.server_url)
            .bind(user.is_admin)
            .bind(user.theme.as_deref())
            .bind(user.language.as_deref())
            .bind(user.timezone.as_deref())
            .bind(user.entry_sorting_direction.as_deref())
            .bind(user.entries_per_page.unwrap_or(100))
            .bind(user.keyboard_shortcuts)
            .bind(user.display_mode.as_deref())
            .bind(user.show_reading_time.unwrap_or(true))
            .bind(user.entry_swipe.unwrap_or(true))
            .bind(user.stylesheet.as_deref())
            .bind(&now)
            .bind(&now)
            .execute(&pool)
            .await
            .map_err(|e| format!("Failed to save user to database: {}", e))?;

            log::info!("User '{}' saved to database", user.username);

            log::info!("Saving credentials after successful authentication");

            let mut config_with_username = config.clone();
            config_with_username.username = Some(user.username.clone());

            if let Err(e) = app_handle.emit("miniflux-connected", ()) {
                log::error!("Failed to emit miniflux-connected event: {}", e);
            }

            if let Err(e) = crate::commands::accounts::save_miniflux_account(
                app_handle.clone(),
                state.clone(),
                config_with_username,
            )
            .await
            {
                let error_msg = format!("Failed to save credentials: {}", e);
                log::error!("{}", error_msg);
                // Don't return error here - authentication was successful, just log the issue
                // The user can still use the app, just won't have credentials saved
            }

            Ok(true)
        }
        Ok(false) => Err("Authentication failed: Invalid credentials".to_string()),
        Err(e) => Err(format!("Connection error: {}", e)),
    }
}

/// Disconnect from Miniflux server
#[tauri::command]
#[specta::specta]
pub async fn miniflux_disconnect(state: State<'_, AppState>) -> Result<(), String> {
    log::info!("Disconnecting from Miniflux server");
    *state.miniflux.client.lock().await = None;
    Ok(())
}

/// Check if connected to Miniflux server
#[tauri::command]
#[specta::specta]
pub async fn miniflux_is_connected(state: State<'_, AppState>) -> Result<bool, String> {
    Ok(state.miniflux.client.lock().await.is_some())
}

/// Get all categories
#[tauri::command]
#[specta::specta]
pub async fn get_categories(
    state: State<'_, AppState>,
) -> Result<Vec<crate::miniflux::Category>, String> {
    let guard = state.miniflux.client.lock().await;
    let client = guard.as_ref().ok_or("Not connected to Miniflux server")?;

    client.get_categories().await
}

/// Get all feeds
#[tauri::command]
#[specta::specta]
pub async fn get_feeds(state: State<'_, AppState>) -> Result<Vec<crate::miniflux::Feed>, String> {
    let guard = state.miniflux.client.lock().await;
    let client = guard.as_ref().ok_or("Not connected to Miniflux server")?;

    client.get_feeds().await
}

/// Get feeds by category
#[tauri::command]
#[specta::specta]
pub async fn get_category_feeds(
    state: State<'_, AppState>,
    category_id: i64,
) -> Result<Vec<crate::miniflux::Feed>, String> {
    let guard = state.miniflux.client.lock().await;
    let client = guard.as_ref().ok_or("Not connected to Miniflux server")?;

    client.get_category_feeds(category_id).await
}

/// Get entries with filters
#[tauri::command]
#[specta::specta]
pub async fn get_entries(
    state: State<'_, AppState>,
    filters: EntryFilters,
) -> Result<crate::miniflux::EntryResponse, String> {
    let guard = state.miniflux.client.lock().await;
    let client = guard.as_ref().ok_or("Not connected to Miniflux server")?;

    client.get_entries(&filters).await
}

/// Get a single entry
#[tauri::command]
#[specta::specta]
pub async fn get_entry(
    state: State<'_, AppState>,
    id: i64,
) -> Result<crate::miniflux::Entry, String> {
    let guard = state.miniflux.client.lock().await;
    let client = guard.as_ref().ok_or("Not connected to Miniflux server")?;

    client.get_entry(id).await
}

/// Mark entry as read
#[tauri::command]
#[specta::specta]
pub async fn mark_entry_read(state: State<'_, AppState>, id: i64) -> Result<(), String> {
    let guard = state.miniflux.client.lock().await;
    let client = guard.as_ref().ok_or("Not connected to Miniflux server")?;

    client.update_entries(vec![id], "read".to_string()).await
}

/// Mark multiple entries as read
#[tauri::command]
#[specta::specta]
pub async fn mark_entries_read(state: State<'_, AppState>, ids: Vec<i64>) -> Result<(), String> {
    let guard = state.miniflux.client.lock().await;
    let client = guard.as_ref().ok_or("Not connected to Miniflux server")?;

    client.update_entries(ids, "read".to_string()).await
}

/// Mark entry as unread
#[tauri::command]
#[specta::specta]
pub async fn mark_entry_unread(state: State<'_, AppState>, id: i64) -> Result<(), String> {
    let guard = state.miniflux.client.lock().await;
    let client = guard.as_ref().ok_or("Not connected to Miniflux server")?;

    client.update_entries(vec![id], "unread".to_string()).await
}

/// Toggle entry star
#[tauri::command]
#[specta::specta]
pub async fn toggle_entry_star(state: State<'_, AppState>, id: i64) -> Result<(), String> {
    let guard = state.miniflux.client.lock().await;
    let client = guard.as_ref().ok_or("Not connected to Miniflux server")?;

    client.toggle_bookmark(id).await
}

/// Update entry
#[tauri::command]
#[specta::specta]
pub async fn update_entry(
    state: State<'_, AppState>,
    id: i64,
    updates: EntryUpdate,
) -> Result<crate::miniflux::Entry, String> {
    let guard = state.miniflux.client.lock().await;
    let client = guard.as_ref().ok_or("Not connected to Miniflux server")?;

    client.update_entry(id, updates).await
}

/// Refresh a feed
#[tauri::command]
#[specta::specta]
pub async fn refresh_feed(state: State<'_, AppState>, id: i64) -> Result<(), String> {
    let guard = state.miniflux.client.lock().await;
    let client = guard.as_ref().ok_or("Not connected to Miniflux server")?;

    client.refresh_feed(id).await
}

/// Refresh all feeds
#[tauri::command]
#[specta::specta]
pub async fn refresh_all_feeds(state: State<'_, AppState>) -> Result<(), String> {
    let guard = state.miniflux.client.lock().await;
    let client = guard.as_ref().ok_or("Not connected to Miniflux server")?;

    client.refresh_all_feeds().await
}

/// Create a new feed
#[tauri::command]
#[specta::specta]
pub async fn create_feed(
    state: State<'_, AppState>,
    feed_url: String,
    category_id: Option<i64>,
) -> Result<i64, String> {
    let guard = state.miniflux.client.lock().await;
    let client = guard.as_ref().ok_or("Not connected to Miniflux server")?;

    client.create_feed(feed_url, category_id).await
}

/// Update a feed
#[tauri::command]
#[specta::specta]
pub async fn update_feed(
    state: State<'_, AppState>,
    id: i64,
    updates: FeedUpdate,
) -> Result<crate::miniflux::Feed, String> {
    let guard = state.miniflux.client.lock().await;
    let client = guard.as_ref().ok_or("Not connected to Miniflux server")?;

    client.update_feed(id, updates).await
}

/// Delete a feed
#[tauri::command]
#[specta::specta]
pub async fn delete_feed(state: State<'_, AppState>, id: i64) -> Result<(), String> {
    let guard = state.miniflux.client.lock().await;
    let client = guard.as_ref().ok_or("Not connected to Miniflux server")?;

    client.delete_feed(id).await
}

/// Get current user
#[tauri::command]
#[specta::specta]
pub async fn get_current_user(state: State<'_, AppState>) -> Result<crate::miniflux::User, String> {
    log::info!("[get_current_user] Command invoked");
    
    let guard = state.miniflux.client.lock().await;
    let client = guard.as_ref().ok_or_else(|| {
        log::error!("[get_current_user] No Miniflux client available - not connected to server");
        "Not connected to Miniflux server".to_string()
    })?;

    log::info!("[get_current_user] Client acquired, fetching user from Miniflux API");
    
    let result = client.get_current_user().await;
    
    match &result {
        Ok(user) => {
            log::info!(
                "[get_current_user] Successfully fetched user: id={}, username={}, is_admin={}",
                user.id,
                user.username,
                user.is_admin
            );
        }
        Err(e) => {
            log::error!("[get_current_user] Failed to fetch user: {}", e);
        }
    }
    
    result
}

/// Get counters
#[tauri::command]
#[specta::specta]
pub async fn get_counters(state: State<'_, AppState>) -> Result<crate::miniflux::Counters, String> {
    let guard = state.miniflux.client.lock().await;
    let client = guard.as_ref().ok_or("Not connected to Miniflux server")?;

    client.get_counters().await
}

/// Discover subscriptions from URL
#[tauri::command]
#[specta::specta]
pub async fn discover_subscriptions(
    state: State<'_, AppState>,
    url: String,
) -> Result<Vec<crate::miniflux::Subscription>, String> {
    let guard = state.miniflux.client.lock().await;
    let client = guard.as_ref().ok_or("Not connected to Miniflux server")?;

    client.discover(url).await
}

/// Export OPML
#[tauri::command]
#[specta::specta]
pub async fn export_opml(state: State<'_, AppState>) -> Result<String, String> {
    let guard = state.miniflux.client.lock().await;
    let client = guard.as_ref().ok_or("Not connected to Miniflux server")?;

    client.export_opml().await
}

/// Import OPML
#[tauri::command]
#[specta::specta]
pub async fn import_opml(state: State<'_, AppState>, opml_content: String) -> Result<(), String> {
    let guard = state.miniflux.client.lock().await;
    let client = guard.as_ref().ok_or("Not connected to Miniflux server")?;

    client.import_opml(opml_content).await
}

/// Fetch original article content
#[tauri::command]
#[specta::specta]
pub async fn fetch_entry_content(
    state: State<'_, AppState>,
    id: i64,
    update_content: bool,
) -> Result<String, String> {
    let guard = state.miniflux.client.lock().await;
    let client = guard.as_ref().ok_or("Not connected to Miniflux server")?;

    client.fetch_content(id, update_content).await
}
