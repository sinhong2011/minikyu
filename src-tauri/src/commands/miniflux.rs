use crate::miniflux::{AuthConfig, EntryFilters, EntryUpdate, FeedUpdate, MinifluxClient};
use crate::AppState;
use chrono::{TimeZone, Utc};
use sqlx::sqlite::SqlitePool;
use sqlx::QueryBuilder;
use sqlx::Row;
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
    let pool = state
        .db_pool
        .lock()
        .await
        .as_ref()
        .ok_or("Database not initialized")?
        .clone();

    get_categories_from_db(&pool).await
}

/// Get all feeds
#[tauri::command]
#[specta::specta]
pub async fn get_feeds(state: State<'_, AppState>) -> Result<Vec<crate::miniflux::Feed>, String> {
    let pool = state
        .db_pool
        .lock()
        .await
        .as_ref()
        .ok_or("Database not initialized")?
        .clone();

    get_feeds_from_db(&pool).await
}

/// Get feeds by category
#[tauri::command]
#[specta::specta]
pub async fn get_category_feeds(
    state: State<'_, AppState>,
    category_id: String,
) -> Result<Vec<crate::miniflux::Feed>, String> {
    let pool = state
        .db_pool
        .lock()
        .await
        .as_ref()
        .ok_or("Database not initialized")?
        .clone();

    let category_id_parsed = category_id
        .parse::<i64>()
        .map_err(|e| format!("Invalid category ID: {}", e))?;

    get_category_feeds_from_db(&pool, category_id_parsed).await
}

/// Get entries with filters
#[tauri::command]
#[specta::specta]
pub async fn get_entries(
    state: State<'_, AppState>,
    filters: EntryFilters,
) -> Result<crate::miniflux::EntryResponse, String> {
    let pool = state
        .db_pool
        .lock()
        .await
        .as_ref()
        .ok_or("Database not initialized")?
        .clone();

    get_entries_from_db(&pool, &filters).await
}

/// Get a single entry
#[tauri::command]
#[specta::specta]
pub async fn get_entry(
    state: State<'_, AppState>,
    entry_id: String,
) -> Result<crate::miniflux::Entry, String> {
    let pool = state
        .db_pool
        .lock()
        .await
        .as_ref()
        .ok_or("Database not initialized")?
        .clone();

    let id_parsed = entry_id
        .parse::<i64>()
        .map_err(|e| format!("Invalid entry ID: {}", e))?;

    get_entry_from_db(&pool, id_parsed).await
}

/// Mark entry as read
#[tauri::command]
#[specta::specta]
pub async fn mark_entry_read(state: State<'_, AppState>, id: String) -> Result<(), String> {
    let guard = state.miniflux.client.lock().await;
    let client = guard.as_ref().ok_or("Not connected to Miniflux server")?;

    let id_parsed = id
        .parse::<i64>()
        .map_err(|e| format!("Invalid entry ID: {}", e))?;

    client
        .update_entries(vec![id_parsed], "read".to_string())
        .await
}

/// Mark multiple entries as read
#[tauri::command]
#[specta::specta]
pub async fn mark_entries_read(state: State<'_, AppState>, ids: Vec<String>) -> Result<(), String> {
    let guard = state.miniflux.client.lock().await;
    let client = guard.as_ref().ok_or("Not connected to Miniflux server")?;

    let ids_parsed: Vec<i64> = ids
        .iter()
        .map(|id| {
            id.parse::<i64>()
                .map_err(|e| format!("Invalid entry ID: {}", e))
        })
        .collect::<Result<Vec<_>, _>>()?;

    client.update_entries(ids_parsed, "read".to_string()).await
}

/// Toggle entry star
#[tauri::command]
#[specta::specta]
pub async fn toggle_entry_star(state: State<'_, AppState>, id: String) -> Result<(), String> {
    let guard = state.miniflux.client.lock().await;
    let client = guard.as_ref().ok_or("Not connected to Miniflux server")?;

    let id_parsed = id
        .parse::<i64>()
        .map_err(|e| format!("Invalid entry ID: {}", e))?;

    client.toggle_bookmark(id_parsed).await
}

/// Update entry
#[tauri::command]
#[specta::specta]
pub async fn update_entry(
    state: State<'_, AppState>,
    id: String,
    updates: EntryUpdate,
) -> Result<crate::miniflux::Entry, String> {
    let guard = state.miniflux.client.lock().await;
    let client = guard.as_ref().ok_or("Not connected to Miniflux server")?;

    let id_parsed = id
        .parse::<i64>()
        .map_err(|e| format!("Invalid entry ID: {}", e))?;

    client.update_entry(id_parsed, updates).await
}

/// Refresh a feed
#[tauri::command]
#[specta::specta]
pub async fn refresh_feed(state: State<'_, AppState>, id: String) -> Result<(), String> {
    let guard = state.miniflux.client.lock().await;
    let client = guard.as_ref().ok_or("Not connected to Miniflux server")?;

    let id_parsed = id
        .parse::<i64>()
        .map_err(|e| format!("Invalid feed ID: {}", e))?;

    client.refresh_feed(id_parsed).await
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
    category_id: Option<String>,
) -> Result<i64, String> {
    let guard = state.miniflux.client.lock().await;
    let client = guard.as_ref().ok_or("Not connected to Miniflux server")?;

    let category_id_parsed = category_id
        .map(|id| {
            id.parse::<i64>()
                .map_err(|e| format!("Invalid category ID: {}", e))
        })
        .transpose()?;

    client.create_feed(feed_url, category_id_parsed).await
}

/// Update a feed
#[tauri::command]
#[specta::specta]
pub async fn update_feed(
    state: State<'_, AppState>,
    id: String,
    updates: FeedUpdate,
) -> Result<crate::miniflux::Feed, String> {
    let guard = state.miniflux.client.lock().await;
    let client = guard.as_ref().ok_or("Not connected to Miniflux server")?;

    let id_parsed = id
        .parse::<i64>()
        .map_err(|e| format!("Invalid feed ID: {}", e))?;

    client.update_feed(id_parsed, updates).await
}

/// Delete a feed
#[tauri::command]
#[specta::specta]
pub async fn delete_feed(state: State<'_, AppState>, id: String) -> Result<(), String> {
    let guard = state.miniflux.client.lock().await;
    let client = guard.as_ref().ok_or("Not connected to Miniflux server")?;

    let id_parsed = id
        .parse::<i64>()
        .map_err(|e| format!("Invalid feed ID: {}", e))?;

    client.delete_feed(id_parsed).await
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
    id: String,
    update_content: bool,
) -> Result<String, String> {
    let guard = state.miniflux.client.lock().await;
    let client = guard.as_ref().ok_or("Not connected to Miniflux server")?;

    let id_parsed = id
        .parse::<i64>()
        .map_err(|e| format!("Invalid entry ID: {}", e))?;

    client.fetch_content(id_parsed, update_content).await
}

pub async fn get_categories_from_db(
    pool: &SqlitePool,
) -> Result<Vec<crate::miniflux::Category>, String> {
    let rows = sqlx::query(
        r#"
        SELECT id, user_id, title, hide_globally, created_at, updated_at
        FROM categories
        ORDER BY title ASC
        "#,
    )
    .fetch_all(pool)
    .await
    .map_err(|e| format!("Failed to fetch categories: {e}"))?;

    let categories = rows
        .iter()
        .map(|row| crate::miniflux::Category {
            id: row.get("id"),
            user_id: row.get("user_id"),
            title: row.get("title"),
            hide_globally: row.get("hide_globally"),
            created_at: row.get("created_at"),
            updated_at: row.get("updated_at"),
        })
        .collect();

    Ok(categories)
}

pub async fn get_feeds_from_db(pool: &SqlitePool) -> Result<Vec<crate::miniflux::Feed>, String> {
    let rows = sqlx::query(
        r#"
        SELECT f.id, f.user_id, f.title, f.site_url, f.feed_url, f.category_id,
               f.checked_at, f.etag_header, f.last_modified_header, f.parsing_error_message,
               f.parsing_error_count, f.scraper_rules, f.rewrite_rules, f.crawler,
               f.blocklist_rules, f.keeplist_rules, f.user_agent, f.username, f.password,
               f.disabled, f.ignore_http_cache, f.fetch_via_proxy, f.no_media_player,
               f.allow_self_signed_certificates, f.urlrewrite_rules, f.cookie,
               f.apprise_service_urls, f.hide_globally, f.created_at, f.updated_at,
               c.id as cat_id, c.user_id as cat_user_id, c.title as cat_title,
               c.hide_globally as cat_hide_globally, c.created_at as cat_created_at,
               c.updated_at as cat_updated_at
        FROM feeds f
        LEFT JOIN categories c ON f.category_id = c.id
        ORDER BY f.title ASC
        "#,
    )
    .fetch_all(pool)
    .await
    .map_err(|e| format!("Failed to fetch feeds: {e}"))?;

    let feeds = rows.iter().map(build_feed_from_row).collect();

    Ok(feeds)
}

pub async fn get_category_feeds_from_db(
    pool: &SqlitePool,
    category_id: i64,
) -> Result<Vec<crate::miniflux::Feed>, String> {
    let rows = sqlx::query(
        r#"
        SELECT f.id, f.user_id, f.title, f.site_url, f.feed_url, f.category_id,
               f.checked_at, f.etag_header, f.last_modified_header, f.parsing_error_message,
               f.parsing_error_count, f.scraper_rules, f.rewrite_rules, f.crawler,
               f.blocklist_rules, f.keeplist_rules, f.user_agent, f.username, f.password,
               f.disabled, f.ignore_http_cache, f.fetch_via_proxy, f.no_media_player,
               f.allow_self_signed_certificates, f.urlrewrite_rules, f.cookie,
               f.apprise_service_urls, f.hide_globally, f.created_at, f.updated_at,
               c.id as cat_id, c.user_id as cat_user_id, c.title as cat_title,
               c.hide_globally as cat_hide_globally, c.created_at as cat_created_at,
               c.updated_at as cat_updated_at
        FROM feeds f
        LEFT JOIN categories c ON f.category_id = c.id
        WHERE f.category_id = ?
        ORDER BY f.title ASC
        "#,
    )
    .bind(category_id)
    .fetch_all(pool)
    .await
    .map_err(|e| format!("Failed to fetch category feeds: {e}"))?;

    let feeds = rows.iter().map(build_feed_from_row).collect();

    Ok(feeds)
}

pub async fn get_entries_from_db(
    pool: &SqlitePool,
    filters: &EntryFilters,
) -> Result<crate::miniflux::EntryResponse, String> {
    let mut count_query: QueryBuilder<sqlx::Sqlite> = QueryBuilder::new(
        r#"
        SELECT COUNT(*)
        FROM entries e
        JOIN feeds f ON e.feed_id = f.id
        LEFT JOIN categories c ON f.category_id = c.id
        WHERE 1=1
        "#,
    );

    apply_entry_filters(&mut count_query, filters);

    let total: i64 = count_query
        .build_query_scalar()
        .fetch_one(pool)
        .await
        .map_err(|e| format!("Failed to count entries: {e}"))?;

    if total == 0 {
        return Ok(crate::miniflux::EntryResponse {
            total: 0,
            entries: None,
        });
    }

    let limit = filters.limit.unwrap_or(100);
    let offset = filters.offset.unwrap_or(0);

    let mut query: QueryBuilder<sqlx::Sqlite> = QueryBuilder::new(
        r#"
        SELECT e.id, e.user_id, e.feed_id, e.title, e.url, e.comments_url, e.author,
               e.content, e.hash, e.published_at, e.created_at, e.changed_at, e.status,
               e.share_code, e.starred, e.reading_time,
               f.id as f_id, f.user_id as f_user_id, f.title as f_title, f.site_url as f_site_url,
               f.feed_url as f_feed_url, f.category_id as f_category_id, f.checked_at as f_checked_at,
               f.etag_header as f_etag_header, f.last_modified_header as f_last_modified_header,
               f.parsing_error_message as f_parsing_error_message, f.parsing_error_count as f_parsing_error_count,
               f.scraper_rules as f_scraper_rules, f.rewrite_rules as f_rewrite_rules,
               f.crawler as f_crawler, f.blocklist_rules as f_blocklist_rules,
               f.keeplist_rules as f_keeplist_rules, f.user_agent as f_user_agent,
               f.username as f_username, f.password as f_password, f.disabled as f_disabled,
               f.ignore_http_cache as f_ignore_http_cache, f.fetch_via_proxy as f_fetch_via_proxy,
               f.no_media_player as f_no_media_player, f.allow_self_signed_certificates as f_allow_self_signed_certificates,
               f.urlrewrite_rules as f_urlrewrite_rules, f.cookie as f_cookie,
               f.apprise_service_urls as f_apprise_service_urls, f.hide_globally as f_hide_globally,
               f.created_at as f_created_at, f.updated_at as f_updated_at,
               c.id as c_id, c.user_id as c_user_id, c.title as c_title,
               c.hide_globally as c_hide_globally, c.created_at as c_created_at,
               c.updated_at as c_updated_at
        FROM entries e
        JOIN feeds f ON e.feed_id = f.id
        LEFT JOIN categories c ON f.category_id = c.id
        WHERE 1=1
        "#,
    );

    apply_entry_filters(&mut query, filters);

    query.push(" ORDER BY e.published_at DESC");
    query.push(" LIMIT ");
    query.push_bind(limit);
    query.push(" OFFSET ");
    query.push_bind(offset);

    let rows = query
        .build()
        .fetch_all(pool)
        .await
        .map_err(|e| format!("Failed to fetch entries: {e}"))?;

    let entries: Vec<crate::miniflux::Entry> = rows.iter().map(build_entry_from_row).collect();

    Ok(crate::miniflux::EntryResponse {
        total,
        entries: Some(entries),
    })
}

fn apply_entry_filters(query: &mut QueryBuilder<sqlx::Sqlite>, filters: &EntryFilters) {
    if let Some(status) = &filters.status {
        query.push(" AND e.status = ");
        query.push_bind(status.clone());
    }

    if let Some(starred) = filters.starred {
        query.push(" AND e.starred = ");
        query.push_bind(starred);
    }

    if let Some(category_id) = filters.category_id {
        query.push(" AND c.id = ");
        query.push_bind(category_id);
    }

    if let Some(feed_id) = filters.feed_id {
        query.push(" AND e.feed_id = ");
        query.push_bind(feed_id);
    }

    if let Some(search) = &filters.search {
        let like_pattern = format!("%{search}%");
        query.push(" AND (e.title LIKE ");
        query.push_bind(like_pattern.clone());
        query.push(" OR e.content LIKE ");
        query.push_bind(like_pattern);
        query.push(")");
    }

    if let Some(after) = filters.after {
        if let chrono::LocalResult::Single(date) = Utc.timestamp_opt(after, 0) {
            let value = date.to_rfc3339();
            query.push(" AND e.published_at >= ");
            query.push_bind(value);
        }
    }

    if let Some(before) = filters.before {
        if let chrono::LocalResult::Single(date) = Utc.timestamp_opt(before, 0) {
            let value = date.to_rfc3339();
            query.push(" AND e.published_at <= ");
            query.push_bind(value);
        }
    }
}

pub async fn get_entry_from_db(
    pool: &SqlitePool,
    id: i64,
) -> Result<crate::miniflux::Entry, String> {
    let row = sqlx::query(
        r#"
        SELECT e.id, e.user_id, e.feed_id, e.title, e.url, e.comments_url, e.author,
               e.content, e.hash, e.published_at, e.created_at, e.changed_at, e.status,
               e.share_code, e.starred, e.reading_time,
               f.id as f_id, f.user_id as f_user_id, f.title as f_title, f.site_url as f_site_url,
               f.feed_url as f_feed_url, f.category_id as f_category_id, f.checked_at as f_checked_at,
               f.etag_header as f_etag_header, f.last_modified_header as f_last_modified_header,
               f.parsing_error_message as f_parsing_error_message, f.parsing_error_count as f_parsing_error_count,
               f.scraper_rules as f_scraper_rules, f.rewrite_rules as f_rewrite_rules,
               f.crawler as f_crawler, f.blocklist_rules as f_blocklist_rules,
               f.keeplist_rules as f_keeplist_rules, f.user_agent as f_user_agent,
               f.username as f_username, f.password as f_password, f.disabled as f_disabled,
               f.ignore_http_cache as f_ignore_http_cache, f.fetch_via_proxy as f_fetch_via_proxy,
               f.no_media_player as f_no_media_player, f.allow_self_signed_certificates as f_allow_self_signed_certificates,
               f.urlrewrite_rules as f_urlrewrite_rules, f.cookie as f_cookie,
               f.apprise_service_urls as f_apprise_service_urls, f.hide_globally as f_hide_globally,
               f.created_at as f_created_at, f.updated_at as f_updated_at,
               c.id as c_id, c.user_id as c_user_id, c.title as c_title,
               c.hide_globally as c_hide_globally, c.created_at as c_created_at,
               c.updated_at as c_updated_at
        FROM entries e
        JOIN feeds f ON e.feed_id = f.id
        LEFT JOIN categories c ON f.category_id = c.id
        WHERE e.id = ?
        "#,
    )
    .bind(id)
    .fetch_optional(pool)
    .await
    .map_err(|e| format!("Failed to fetch entry: {e}"))?
    .ok_or_else(|| format!("Entry with id {id} not found"))?;

    Ok(build_entry_from_row(&row))
}

fn build_feed_from_row(row: &sqlx::sqlite::SqliteRow) -> crate::miniflux::Feed {
    let category = row
        .get::<Option<i64>, _>("cat_id")
        .map(|cat_id| crate::miniflux::Category {
            id: cat_id,
            user_id: row.get("cat_user_id"),
            title: row.get("cat_title"),
            hide_globally: row.get("cat_hide_globally"),
            created_at: row.get("cat_created_at"),
            updated_at: row.get("cat_updated_at"),
        });

    crate::miniflux::Feed {
        id: row.get("id"),
        user_id: row.get("user_id"),
        title: row.get("title"),
        site_url: row.get("site_url"),
        feed_url: row.get("feed_url"),
        category,
        icon: None,
        checked_at: row.get("checked_at"),
        etag_header: row.get("etag_header"),
        last_modified_header: row.get("last_modified_header"),
        parsing_error_message: row.get("parsing_error_message"),
        parsing_error_count: row.get("parsing_error_count"),
        scraper_rules: row.get("scraper_rules"),
        rewrite_rules: row.get("rewrite_rules"),
        crawler: row.get("crawler"),
        blocklist_rules: row.get("blocklist_rules"),
        keeplist_rules: row.get("keeplist_rules"),
        user_agent: row.get("user_agent"),
        username: row.get("username"),
        password: row.get("password"),
        disabled: row.get("disabled"),
        ignore_http_cache: row.get("ignore_http_cache"),
        fetch_via_proxy: row.get("fetch_via_proxy"),
        no_media_player: row.get("no_media_player"),
        allow_self_signed_certificates: row.get("allow_self_signed_certificates"),
        urlrewrite_rules: row.get("urlrewrite_rules"),
        cookie: row.get("cookie"),
        apprise_service_urls: row.get("apprise_service_urls"),
        hide_globally: row.get("hide_globally"),
        created_at: row.get("created_at"),
        updated_at: row.get("updated_at"),
    }
}

fn build_entry_from_row(row: &sqlx::sqlite::SqliteRow) -> crate::miniflux::Entry {
    let feed_category = row
        .get::<Option<i64>, _>("c_id")
        .map(|cat_id| crate::miniflux::Category {
            id: cat_id,
            user_id: row.get("c_user_id"),
            title: row.get("c_title"),
            hide_globally: row.get("c_hide_globally"),
            created_at: row.get("c_created_at"),
            updated_at: row.get("c_updated_at"),
        });

    let feed = crate::miniflux::Feed {
        id: row.get("f_id"),
        user_id: row.get("f_user_id"),
        title: row.get("f_title"),
        site_url: row.get("f_site_url"),
        feed_url: row.get("f_feed_url"),
        category: feed_category,
        icon: None,
        checked_at: row.get("f_checked_at"),
        etag_header: row.get("f_etag_header"),
        last_modified_header: row.get("f_last_modified_header"),
        parsing_error_message: row.get("f_parsing_error_message"),
        parsing_error_count: row.get("f_parsing_error_count"),
        scraper_rules: row.get("f_scraper_rules"),
        rewrite_rules: row.get("f_rewrite_rules"),
        crawler: row.get("f_crawler"),
        blocklist_rules: row.get("f_blocklist_rules"),
        keeplist_rules: row.get("f_keeplist_rules"),
        user_agent: row.get("f_user_agent"),
        username: row.get("f_username"),
        password: row.get("f_password"),
        disabled: row.get("f_disabled"),
        ignore_http_cache: row.get("f_ignore_http_cache"),
        fetch_via_proxy: row.get("f_fetch_via_proxy"),
        no_media_player: row.get("f_no_media_player"),
        allow_self_signed_certificates: row.get("f_allow_self_signed_certificates"),
        urlrewrite_rules: row.get("f_urlrewrite_rules"),
        cookie: row.get("f_cookie"),
        apprise_service_urls: row.get("f_apprise_service_urls"),
        hide_globally: row.get("f_hide_globally"),
        created_at: row.get("f_created_at"),
        updated_at: row.get("f_updated_at"),
    };

    crate::miniflux::Entry {
        id: row.get("id"),
        user_id: row.get("user_id"),
        feed_id: row.get("feed_id"),
        title: row.get("title"),
        url: row.get("url"),
        comments_url: row.get("comments_url"),
        author: row.get("author"),
        content: row.get("content"),
        hash: row.get("hash"),
        published_at: row.get("published_at"),
        created_at: row.get("created_at"),
        changed_at: row.get("changed_at"),
        status: row.get("status"),
        share_code: row.get("share_code"),
        starred: row.get("starred"),
        reading_time: row.get("reading_time"),
        enclosures: None,
        feed,
        tags: None,
    }
}

#[cfg(test)]
#[path = "miniflux.test.rs"]
mod tests;
