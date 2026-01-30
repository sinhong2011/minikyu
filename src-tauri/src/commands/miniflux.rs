use crate::database::init_database_pool;
use crate::miniflux::{
    AuthConfig, EntryFilters, EntryUpdate, FeedUpdate, MinifluxClient, SyncResult,
};
use specta::Type;
use std::sync::Arc;
use tauri::{AppHandle, State};
use tokio::sync::Mutex;

/// Global state for Miniflux client
pub struct MinifluxState {
    pub client: Arc<Mutex<Option<MinifluxClient>>>,
}

/// Connect to Miniflux server
#[tauri::command]
#[specta::specta]
pub async fn miniflux_connect(
    app_handle: AppHandle,
    state: State<'_, MinifluxState>,
    config: AuthConfig,
) -> Result<bool, String> {
    log::info!("Connecting to Miniflux server: {}", config.server_url);

    let client = if let Some(token) = config.auth_token {
        MinifluxClient::new(config.server_url).with_token(token)
    } else if let (Some(username), Some(password)) = (config.username, config.password) {
        MinifluxClient::new(config.server_url).with_credentials(username, password)
    } else {
        return Err("Either auth_token or username/password must be provided".to_string());
    };

    // Test authentication
    match client.authenticate().await {
        Ok(true) => {
            log::info!("Successfully authenticated with Miniflux server");
            *state.client.lock().await = Some(client);

            // Initialize database
            init_database_pool(&app_handle)
                .await
                .map_err(|e| format!("Failed to initialize database: {}", e))?;

            Ok(true)
        }
        Ok(false) => Err("Authentication failed: Invalid credentials".to_string()),
        Err(e) => Err(format!("Connection error: {}", e)),
    }
}

/// Disconnect from Miniflux server
#[tauri::command]
#[specta::specta]
pub async fn miniflux_disconnect(state: State<'_, MinifluxState>) -> Result<(), String> {
    log::info!("Disconnecting from Miniflux server");
    *state.client.lock().await = None;
    Ok(())
}

/// Check if connected to Miniflux server
#[tauri::command]
#[specta::specta]
pub async fn miniflux_is_connected(state: State<'_, MinifluxState>) -> Result<bool, String> {
    Ok(state.client.lock().await.is_some())
}

/// Get all categories
#[tauri::command]
#[specta::specta]
pub async fn get_categories(
    state: State<'_, MinifluxState>,
) -> Result<Vec<crate::miniflux::Category>, String> {
    let client = state
        .client
        .lock()
        .await
        .as_ref()
        .ok_or("Not connected to Miniflux server")?
        .clone();

    client.get_categories().await
}

/// Get all feeds
#[tauri::command]
#[specta::specta]
pub async fn get_feeds(
    state: State<'_, MinifluxState>,
) -> Result<Vec<crate::miniflux::Feed>, String> {
    let client = state
        .client
        .lock()
        .await
        .as_ref()
        .ok_or("Not connected to Miniflux server")?
        .clone();

    client.get_feeds().await
}

/// Get feeds by category
#[tauri::command]
#[specta::specta]
pub async fn get_category_feeds(
    state: State<'_, MinifluxState>,
    category_id: i64,
) -> Result<Vec<crate::miniflux::Feed>, String> {
    let client = state
        .client
        .lock()
        .await
        .as_ref()
        .ok_or("Not connected to Miniflux server")?
        .clone();

    client.get_category_feeds(category_id).await
}

/// Get entries with filters
#[tauri::command]
#[specta::specta]
pub async fn get_entries(
    state: State<'_, MinifluxState>,
    filters: EntryFilters,
) -> Result<crate::miniflux::EntryResponse, String> {
    let client = state
        .client
        .lock()
        .await
        .as_ref()
        .ok_or("Not connected to Miniflux server")?
        .clone();

    client.get_entries(&filters).await
}

/// Get a single entry
#[tauri::command]
#[specta::specta]
pub async fn get_entry(
    state: State<'_, MinifluxState>,
    id: i64,
) -> Result<crate::miniflux::Entry, String> {
    let client = state
        .client
        .lock()
        .await
        .as_ref()
        .ok_or("Not connected to Miniflux server")?
        .clone();

    client.get_entry(id).await
}

/// Mark entry as read
#[tauri::command]
#[specta::specta]
pub async fn mark_entry_read(state: State<'_, MinifluxState>, id: i64) -> Result<(), String> {
    let client = state
        .client
        .lock()
        .await
        .as_ref()
        .ok_or("Not connected to Miniflux server")?
        .clone();

    client.update_entries(vec![id], "read".to_string()).await
}

/// Mark multiple entries as read
#[tauri::command]
#[specta::specta]
pub async fn mark_entries_read(
    state: State<'_, MinifluxState>,
    ids: Vec<i64>,
) -> Result<(), String> {
    let client = state
        .client
        .lock()
        .await
        .as_ref()
        .ok_or("Not connected to Miniflux server")?
        .clone();

    client.update_entries(ids, "read".to_string()).await
}

/// Mark entry as unread
#[tauri::command]
#[specta::specta]
pub async fn mark_entry_unread(state: State<'_, MinifluxState>, id: i64) -> Result<(), String> {
    let client = state
        .client
        .lock()
        .await
        .as_ref()
        .ok_or("Not connected to Miniflux server")?
        .clone();

    client.update_entries(vec![id], "unread".to_string()).await
}

/// Toggle entry star
#[tauri::command]
#[specta::specta]
pub async fn toggle_entry_star(state: State<'_, MinifluxState>, id: i64) -> Result<(), String> {
    let client = state
        .client
        .lock()
        .await
        .as_ref()
        .ok_or("Not connected to Miniflux server")?
        .clone();

    client.toggle_bookmark(id).await
}

/// Update entry
#[tauri::command]
#[specta::specta]
pub async fn update_entry(
    state: State<'_, MinifluxState>,
    id: i64,
    updates: EntryUpdate,
) -> Result<crate::miniflux::Entry, String> {
    let client = state
        .client
        .lock()
        .await
        .as_ref()
        .ok_or("Not connected to Miniflux server")?
        .clone();

    client.update_entry(id, updates).await
}

/// Refresh a feed
#[tauri::command]
#[specta::specta]
pub async fn refresh_feed(state: State<'_, MinifluxState>, id: i64) -> Result<(), String> {
    let client = state
        .client
        .lock()
        .await
        .as_ref()
        .ok_or("Not connected to Miniflux server")?
        .clone();

    client.refresh_feed(id).await
}

/// Refresh all feeds
#[tauri::command]
#[specta::specta]
pub async fn refresh_all_feeds(state: State<'_, MinifluxState>) -> Result<(), String> {
    let client = state
        .client
        .lock()
        .await
        .as_ref()
        .ok_or("Not connected to Miniflux server")?
        .clone();

    client.refresh_all_feeds().await
}

/// Create a new feed
#[tauri::command]
#[specta::specta]
pub async fn create_feed(
    state: State<'_, MinifluxState>,
    feed_url: String,
    category_id: Option<i64>,
) -> Result<i64, String> {
    let client = state
        .client
        .lock()
        .await
        .as_ref()
        .ok_or("Not connected to Miniflux server")?
        .clone();

    client.create_feed(feed_url, category_id).await
}

/// Update a feed
#[tauri::command]
#[specta::specta]
pub async fn update_feed(
    state: State<'_, MinifluxState>,
    id: i64,
    updates: FeedUpdate,
) -> Result<crate::miniflux::Feed, String> {
    let client = state
        .client
        .lock()
        .await
        .as_ref()
        .ok_or("Not connected to Miniflux server")?
        .clone();

    client.update_feed(id, updates).await
}

/// Delete a feed
#[tauri::command]
#[specta::specta]
pub async fn delete_feed(state: State<'_, MinifluxState>, id: i64) -> Result<(), String> {
    let client = state
        .client
        .lock()
        .await
        .as_ref()
        .ok_or("Not connected to Miniflux server")?
        .clone();

    client.delete_feed(id).await
}

/// Get current user
#[tauri::command]
#[specta::specta]
pub async fn get_current_user(
    state: State<'_, MinifluxState>,
) -> Result<crate::miniflux::User, String> {
    let client = state
        .client
        .lock()
        .await
        .as_ref()
        .ok_or("Not connected to Miniflux server")?
        .clone();

    client.get_current_user().await
}

/// Get counters
#[tauri::command]
#[specta::specta]
pub async fn get_counters(
    state: State<'_, MinifluxState>,
) -> Result<crate::miniflux::Counters, String> {
    let client = state
        .client
        .lock()
        .await
        .as_ref()
        .ok_or("Not connected to Miniflux server")?
        .clone();

    client.get_counters().await
}

/// Discover subscriptions from URL
#[tauri::command]
#[specta::specta]
pub async fn discover_subscriptions(
    state: State<'_, MinifluxState>,
    url: String,
) -> Result<Vec<crate::miniflux::Subscription>, String> {
    let client = state
        .client
        .lock()
        .await
        .as_ref()
        .ok_or("Not connected to Miniflux server")?
        .clone();

    client.discover(url).await
}

/// Export OPML
#[tauri::command]
#[specta::specta]
pub async fn export_opml(state: State<'_, MinifluxState>) -> Result<String, String> {
    let client = state
        .client
        .lock()
        .await
        .as_ref()
        .ok_or("Not connected to Miniflux server")?
        .clone();

    client.export_opml().await
}

/// Import OPML
#[tauri::command]
#[specta::specta]
pub async fn import_opml(
    state: State<'_, MinifluxState>,
    opml_content: String,
) -> Result<(), String> {
    let client = state
        .client
        .lock()
        .await
        .as_ref()
        .ok_or("Not connected to Miniflux server")?
        .clone();

    client.import_opml(opml_content).await
}

/// Fetch original article content
#[tauri::command]
#[specta::specta]
pub async fn fetch_entry_content(
    state: State<'_, MinifluxState>,
    id: i64,
    update_content: bool,
) -> Result<String, String> {
    let client = state
        .client
        .lock()
        .await
        .as_ref()
        .ok_or("Not connected to Miniflux server")?
        .clone();

    client.fetch_content(id, update_content).await
}
