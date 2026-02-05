use chrono::{TimeZone, Utc};
use serde::{Deserialize, Serialize};
use sqlx::{FromRow, QueryBuilder, SqlitePool};
use tauri::{AppHandle, Emitter, State};

use crate::miniflux::{EntryFilters, MinifluxClient};
use crate::AppState;

#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
pub struct SyncSummary {
    pub entries_pulled: u32,
    pub entries_pushed: u32,
    pub feeds_pulled: u32,
    pub categories_pulled: u32,
}
#[derive(Debug, Clone, FromRow)]
#[allow(dead_code)]
pub struct SyncState {
    pub id: i64,
    pub last_sync_at: Option<String>,
    pub last_full_sync_at: Option<String>,
    pub sync_in_progress: bool,
    pub sync_error: Option<String>,
    pub sync_version: i64,
}

#[derive(Debug, Clone, Copy)]
struct SyncWindow {
    limit: i64,
}

impl Default for SyncWindow {
    fn default() -> Self {
        Self { limit: 200 }
    }
}

/// Gets or creates the sync state row. Only one row exists in the table.
pub async fn get_or_create_sync_state(pool: &SqlitePool) -> Result<SyncState, String> {
    if let Some(row) = sqlx::query_as::<_, SyncState>(
        "SELECT id, last_sync_at, last_full_sync_at, sync_in_progress, sync_error, sync_version FROM sync_state LIMIT 1",
    )
    .fetch_optional(pool)
    .await
    .map_err(|e| format!("{e}"))?
    {
        return Ok(row);
    }

    sqlx::query(
        "INSERT INTO sync_state (last_sync_at, last_full_sync_at, sync_in_progress, sync_error, sync_version) VALUES (NULL, NULL, 0, NULL, 1)",
    )
    .execute(pool)
    .await
    .map_err(|e| format!("{e}"))?;

    sqlx::query_as::<_, SyncState>(
        "SELECT id, last_sync_at, last_full_sync_at, sync_in_progress, sync_error, sync_version FROM sync_state LIMIT 1",
    )
    .fetch_one(pool)
    .await
    .map_err(|e| format!("{e}"))
}

#[allow(dead_code)]
pub async fn enqueue_sync_operation(
    pool: &SqlitePool,
    entity_type: &str,
    entity_id: i64,
    operation_type: &str,
    payload: &str,
) -> Result<i64, String> {
    let now = Utc::now().to_rfc3339();
    let result = sqlx::query(
        r#"
        INSERT INTO sync_queue (operation_type, entity_type, entity_id, payload, retry_count, status, created_at, updated_at)
        VALUES (?, ?, ?, ?, 0, 'pending', ?, ?)
        "#,
    )
    .bind(operation_type)
    .bind(entity_type)
    .bind(entity_id)
    .bind(payload)
    .bind(&now)
    .bind(&now)
    .execute(pool)
    .await
    .map_err(|e| format!("{e}"))?;

    Ok(result.last_insert_rowid())
}

pub async fn sync_miniflux_impl(
    pool: &SqlitePool,
    client: &MinifluxClient,
) -> Result<SyncSummary, String> {
    let window = SyncWindow::default();
    let now = Utc::now().to_rfc3339();
    let sync_started_at = now.clone();
    let mut summary = SyncSummary {
        entries_pulled: 0,
        entries_pushed: 0,
        feeds_pulled: 0,
        categories_pulled: 0,
    };

    let mut sync_state = get_or_create_sync_state(pool).await?;
    let is_full_sync = sync_state.last_full_sync_at.is_none();

    sqlx::query("UPDATE sync_state SET sync_in_progress = 1, sync_error = NULL")
        .execute(pool)
        .await
        .map_err(|e| format!("Failed to mark sync in progress: {e}"))?;

    let user = client.get_current_user().await?;
    let user_id = user.id;

    if is_full_sync {
        mark_categories_stale(pool, user_id).await?;
        mark_feeds_stale(pool, user_id).await?;
        mark_entries_stale(pool, user_id).await?;
    }

    let categories = client.get_categories().await?;
    let category_ids: Vec<i64> = categories.iter().map(|category| category.id).collect();
    upsert_categories(pool, &categories, &now).await?;
    summary.categories_pulled = categories.len() as u32;

    let feeds = client.get_feeds().await?;
    let feed_ids: Vec<i64> = feeds.iter().map(|feed| feed.id).collect();
    upsert_feeds(pool, &feeds, &now).await?;
    summary.feeds_pulled = feeds.len() as u32;

    if is_full_sync {
        sync_full_entries(pool, client, &window, &mut summary).await?;
    } else {
        sync_incremental_entries(pool, client, &window, &mut summary, &sync_state).await?;
    }

    if is_full_sync {
        delete_stale_entries(pool, user_id).await?;
        delete_stale_feeds(pool, user_id).await?;
        delete_stale_categories(pool, user_id).await?;
    } else {
        delete_removed_entries(pool, user_id, &sync_state).await?;
        delete_removed_feeds(pool, user_id, &feed_ids).await?;
        delete_removed_categories(pool, user_id, &category_ids).await?;
    }

    sqlx::query(
        "UPDATE sync_state SET last_sync_at = ?, last_full_sync_at = COALESCE(last_full_sync_at, ?), sync_in_progress = 0, sync_error = NULL",
    )
    .bind(&sync_started_at)
    .bind(&sync_started_at)
    .execute(pool)
    .await
    .map_err(|e| format!("Failed to update sync state: {e}"))?;

    sync_state.last_sync_at = Some(now);

    Ok(summary)
}

#[tauri::command]
#[specta::specta]
pub async fn sync_miniflux(
    app_handle: AppHandle,
    state: State<'_, AppState>,
) -> Result<SyncSummary, String> {
    log::info!("Starting Miniflux sync");

    if let Err(e) = app_handle.emit("sync-started", ()) {
        log::error!("Failed to emit sync-started event: {e}");
    }

    let pool = state
        .db_pool
        .lock()
        .await
        .as_ref()
        .ok_or("Database not initialized")?
        .clone();

    let client_guard = state.miniflux.client.lock().await;
    let client = client_guard
        .as_ref()
        .ok_or("Not connected to Miniflux server")?
        .clone();

    let summary = match sync_miniflux_impl(&pool, &client).await {
        Ok(summary) => summary,
        Err(error) => {
            let _ = sqlx::query("UPDATE sync_state SET sync_in_progress = 0, sync_error = ?")
                .bind(&error)
                .execute(&pool)
                .await;

            return Err(error);
        }
    };

    if let Err(e) = app_handle.emit("sync-completed", &summary) {
        log::error!("Failed to emit sync-completed event: {e}");
    }

    log::info!(
        "Sync completed: {} entries pulled, {} pushed",
        summary.entries_pulled,
        summary.entries_pushed
    );

    Ok(summary)
}

async fn upsert_categories(
    pool: &SqlitePool,
    categories: &[crate::miniflux::Category],
    now: &str,
) -> Result<(), String> {
    log::debug!("Upserting {} categories...", categories.len());
    let mut builder: QueryBuilder<sqlx::Sqlite> = QueryBuilder::new(
        "INSERT INTO categories (id, user_id, title, hide_globally, created_at, updated_at, sync_status)",
    );

    builder.push_values(categories, |mut row, category| {
        row.push_bind(category.id)
            .push_bind(category.user_id)
            .push_bind(&category.title)
            .push_bind(category.hide_globally)
            .push_bind(category.created_at.as_deref().unwrap_or(now))
            .push_bind(category.updated_at.as_deref().unwrap_or(now))
            .push_bind("synced");
    });

    builder.push(
        " ON CONFLICT(id) DO UPDATE SET user_id = excluded.user_id, title = excluded.title, hide_globally = excluded.hide_globally, created_at = excluded.created_at, updated_at = excluded.updated_at, sync_status = 'synced'",
    );

    builder
        .build()
        .execute(pool)
        .await
        .map_err(|e| format!("Failed to upsert categories: {e}"))?;

    Ok(())
}

async fn mark_categories_stale(pool: &SqlitePool, user_id: i64) -> Result<(), String> {
    sqlx::query("UPDATE categories SET sync_status = 'stale' WHERE user_id = ?")
        .bind(user_id)
        .execute(pool)
        .await
        .map_err(|e| format!("Failed to mark categories stale: {e}"))?;
    Ok(())
}

async fn upsert_feeds(
    pool: &SqlitePool,
    feeds: &[crate::miniflux::Feed],
    now: &str,
) -> Result<(), String> {
    log::debug!("Upserting {} feeds...", feeds.len());
    let mut builder: QueryBuilder<sqlx::Sqlite> = QueryBuilder::new(
        "INSERT INTO feeds (id, user_id, title, site_url, feed_url, category_id, checked_at, etag_header, last_modified_header, parsing_error_message, parsing_error_count, scraper_rules, rewrite_rules, crawler, blocklist_rules, keeplist_rules, user_agent, username, password, disabled, ignore_http_cache, fetch_via_proxy, no_media_player, allow_self_signed_certificates, urlrewrite_rules, cookie, apprise_service_urls, hide_globally, created_at, updated_at, sync_status)",
    );

    builder.push_values(feeds, |mut row, feed| {
        row.push_bind(feed.id)
            .push_bind(feed.user_id)
            .push_bind(&feed.title)
            .push_bind(&feed.site_url)
            .push_bind(&feed.feed_url)
            .push_bind(feed.category.as_ref().map(|category| category.id))
            .push_bind(feed.checked_at.as_deref())
            .push_bind(feed.etag_header.as_deref())
            .push_bind(feed.last_modified_header.as_deref())
            .push_bind(feed.parsing_error_message.as_deref())
            .push_bind(feed.parsing_error_count)
            .push_bind(feed.scraper_rules.as_deref())
            .push_bind(feed.rewrite_rules.as_deref())
            .push_bind(feed.crawler)
            .push_bind(feed.blocklist_rules.as_deref())
            .push_bind(feed.keeplist_rules.as_deref())
            .push_bind(feed.user_agent.as_deref())
            .push_bind(feed.username.as_deref())
            .push_bind(feed.password.as_deref())
            .push_bind(feed.disabled)
            .push_bind(feed.ignore_http_cache)
            .push_bind(feed.fetch_via_proxy)
            .push_bind(feed.no_media_player)
            .push_bind(feed.allow_self_signed_certificates)
            .push_bind(feed.urlrewrite_rules.as_deref())
            .push_bind(feed.cookie.as_deref())
            .push_bind(feed.apprise_service_urls.as_deref())
            .push_bind(feed.hide_globally)
            .push_bind(feed.created_at.as_deref().unwrap_or(now))
            .push_bind(feed.updated_at.as_deref().unwrap_or(now))
            .push_bind("synced");
    });

    builder.push(
        " ON CONFLICT(id) DO UPDATE SET user_id = excluded.user_id, title = excluded.title, site_url = excluded.site_url, feed_url = excluded.feed_url, category_id = excluded.category_id, checked_at = excluded.checked_at, etag_header = excluded.etag_header, last_modified_header = excluded.last_modified_header, parsing_error_message = excluded.parsing_error_message, parsing_error_count = excluded.parsing_error_count, scraper_rules = excluded.scraper_rules, rewrite_rules = excluded.rewrite_rules, crawler = excluded.crawler, blocklist_rules = excluded.blocklist_rules, keeplist_rules = excluded.keeplist_rules, user_agent = excluded.user_agent, username = excluded.username, password = excluded.password, disabled = excluded.disabled, ignore_http_cache = excluded.ignore_http_cache, fetch_via_proxy = excluded.fetch_via_proxy, no_media_player = excluded.no_media_player, allow_self_signed_certificates = excluded.allow_self_signed_certificates, urlrewrite_rules = excluded.urlrewrite_rules, cookie = excluded.cookie, apprise_service_urls = excluded.apprise_service_urls, hide_globally = excluded.hide_globally, created_at = excluded.created_at, updated_at = excluded.updated_at, sync_status = 'synced'",
    );

    builder
        .build()
        .execute(pool)
        .await
        .map_err(|e| format!("Failed to upsert feeds: {e}"))?;

    Ok(())
}

async fn mark_feeds_stale(pool: &SqlitePool, user_id: i64) -> Result<(), String> {
    sqlx::query("UPDATE feeds SET sync_status = 'stale' WHERE user_id = ?")
        .bind(user_id)
        .execute(pool)
        .await
        .map_err(|e| format!("Failed to mark feeds stale: {e}"))?;
    Ok(())
}

async fn upsert_entries(
    pool: &SqlitePool,
    entries: &[crate::miniflux::Entry],
    now: &str,
) -> Result<(), String> {
    if entries.is_empty() {
        return Ok(());
    }

    let mut builder: QueryBuilder<sqlx::Sqlite> = QueryBuilder::new(
        "INSERT INTO entries (id, user_id, feed_id, title, url, comments_url, author, content, hash, published_at, created_at, changed_at, status, share_code, starred, reading_time, sync_status)",
    );

    builder.push_values(entries, |mut row, entry| {
        row.push_bind(entry.id)
            .push_bind(entry.user_id)
            .push_bind(entry.feed_id)
            .push_bind(&entry.title)
            .push_bind(&entry.url)
            .push_bind(entry.comments_url.as_deref())
            .push_bind(entry.author.as_deref())
            .push_bind(entry.content.as_deref())
            .push_bind(&entry.hash)
            .push_bind(&entry.published_at)
            .push_bind(entry.created_at.as_deref().unwrap_or(now))
            .push_bind(entry.changed_at.as_deref())
            .push_bind(&entry.status)
            .push_bind(entry.share_code.as_deref())
            .push_bind(entry.starred)
            .push_bind(entry.reading_time)
            .push_bind("synced");
    });

    builder.push(
        " ON CONFLICT(id) DO UPDATE SET user_id = excluded.user_id, feed_id = excluded.feed_id, title = excluded.title, url = excluded.url, comments_url = excluded.comments_url, author = excluded.author, content = excluded.content, hash = excluded.hash, published_at = excluded.published_at, created_at = excluded.created_at, changed_at = excluded.changed_at, status = excluded.status, share_code = excluded.share_code, starred = excluded.starred, reading_time = excluded.reading_time, sync_status = 'synced'",
    );

    builder
        .build()
        .execute(pool)
        .await
        .map_err(|e| format!("Failed to upsert entries: {e}"))?;

    Ok(())
}

async fn mark_entries_stale(pool: &SqlitePool, user_id: i64) -> Result<(), String> {
    sqlx::query("UPDATE entries SET sync_status = 'stale' WHERE user_id = ?")
        .bind(user_id)
        .execute(pool)
        .await
        .map_err(|e| format!("Failed to mark entries stale: {e}"))?;
    Ok(())
}

async fn sync_full_entries(
    pool: &SqlitePool,
    client: &MinifluxClient,
    window: &SyncWindow,
    summary: &mut SyncSummary,
) -> Result<(), String> {
    let mut offset = 0;
    let mut total_seen = 0;

    loop {
        let filters = EntryFilters {
            offset: Some(offset),
            limit: Some(window.limit),
            order: Some("published_at".to_string()),
            direction: Some("desc".to_string()),
            ..EntryFilters::default()
        };

        let response = client.get_entries(&filters).await?;
        let entries = response.entries.unwrap_or_default();
        let count = entries.len();

        if count == 0 {
            break;
        }

        upsert_entries(pool, &entries, &Utc::now().to_rfc3339()).await?;
        summary.entries_pulled = summary.entries_pulled.saturating_add(count as u32);
        total_seen += count as i64;

        if total_seen >= response.total {
            break;
        }

        offset += window.limit;
    }

    Ok(())
}

async fn sync_incremental_entries(
    pool: &SqlitePool,
    client: &MinifluxClient,
    window: &SyncWindow,
    summary: &mut SyncSummary,
    state: &SyncState,
) -> Result<(), String> {
    let mut offset = 0;
    let mut total_seen = 0;
    let changed_after = state
        .last_sync_at
        .as_ref()
        .and_then(|timestamp| parse_rfc3339_to_epoch(timestamp).ok());

    loop {
        let filters = EntryFilters {
            offset: Some(offset),
            limit: Some(window.limit),
            order: Some("published_at".to_string()),
            direction: Some("desc".to_string()),
            changed_after,
            ..EntryFilters::default()
        };

        let response = client.get_entries(&filters).await?;
        let entries = response.entries.unwrap_or_default();
        let count = entries.len();

        if count == 0 {
            break;
        }

        upsert_entries(pool, &entries, &Utc::now().to_rfc3339()).await?;
        summary.entries_pulled = summary.entries_pulled.saturating_add(count as u32);
        total_seen += count as i64;

        if total_seen >= response.total {
            break;
        }

        offset += window.limit;
    }

    Ok(())
}

async fn delete_stale_categories(pool: &SqlitePool, user_id: i64) -> Result<(), String> {
    sqlx::query("DELETE FROM categories WHERE user_id = ? AND sync_status = 'stale'")
        .bind(user_id)
        .execute(pool)
        .await
        .map_err(|e| format!("Failed to delete stale categories: {e}"))?;
    Ok(())
}

async fn delete_stale_feeds(pool: &SqlitePool, user_id: i64) -> Result<(), String> {
    sqlx::query("DELETE FROM feeds WHERE user_id = ? AND sync_status = 'stale'")
        .bind(user_id)
        .execute(pool)
        .await
        .map_err(|e| format!("Failed to delete stale feeds: {e}"))?;
    Ok(())
}

async fn delete_stale_entries(pool: &SqlitePool, user_id: i64) -> Result<(), String> {
    sqlx::query("DELETE FROM entries WHERE user_id = ? AND sync_status = 'stale'")
        .bind(user_id)
        .execute(pool)
        .await
        .map_err(|e| format!("Failed to delete stale entries: {e}"))?;
    Ok(())
}

async fn delete_removed_categories(
    pool: &SqlitePool,
    user_id: i64,
    category_ids: &[i64],
) -> Result<(), String> {
    if category_ids.is_empty() {
        sqlx::query("DELETE FROM categories WHERE user_id = ?")
            .bind(user_id)
            .execute(pool)
            .await
            .map_err(|e| format!("Failed to clear categories: {e}"))?;
        return Ok(());
    }

    let mut builder: QueryBuilder<sqlx::Sqlite> =
        QueryBuilder::new("DELETE FROM categories WHERE user_id = ");
    builder.push_bind(user_id);
    builder.push(" AND id NOT IN (");
    let mut separated = builder.separated(",");
    for id in category_ids {
        separated.push_bind(id);
    }
    builder.push(")");

    builder
        .build()
        .execute(pool)
        .await
        .map_err(|e| format!("Failed to delete removed categories: {e}"))?;
    Ok(())
}

async fn delete_removed_feeds(
    pool: &SqlitePool,
    user_id: i64,
    feed_ids: &[i64],
) -> Result<(), String> {
    if feed_ids.is_empty() {
        sqlx::query("DELETE FROM feeds WHERE user_id = ?")
            .bind(user_id)
            .execute(pool)
            .await
            .map_err(|e| format!("Failed to clear feeds: {e}"))?;
        return Ok(());
    }

    let mut builder: QueryBuilder<sqlx::Sqlite> =
        QueryBuilder::new("DELETE FROM feeds WHERE user_id = ");
    builder.push_bind(user_id);
    builder.push(" AND id NOT IN (");
    let mut separated = builder.separated(",");
    for id in feed_ids {
        separated.push_bind(id);
    }
    builder.push(")");

    builder
        .build()
        .execute(pool)
        .await
        .map_err(|e| format!("Failed to delete removed feeds: {e}"))?;
    Ok(())
}

async fn delete_removed_entries(
    pool: &SqlitePool,
    user_id: i64,
    state: &SyncState,
) -> Result<(), String> {
    let changed_after = state
        .last_sync_at
        .as_ref()
        .and_then(|timestamp| parse_rfc3339_to_epoch(timestamp).ok());

    if let Some(changed_after) = changed_after {
        let threshold = Utc
            .timestamp_opt(changed_after, 0)
            .single()
            .ok_or("Failed to convert changed_after timestamp".to_string())?
            .to_rfc3339();

        sqlx::query(
            "DELETE FROM entries WHERE user_id = ? AND status = 'removed' AND (changed_at IS NOT NULL AND changed_at >= ?)",
        )
        .bind(user_id)
        .bind(&threshold)
        .execute(pool)
        .await
        .map_err(|e| format!("Failed to delete removed entries: {e}"))?;
    }

    Ok(())
}

fn parse_rfc3339_to_epoch(value: &str) -> Result<i64, String> {
    let parsed = chrono::DateTime::parse_from_rfc3339(value)
        .map_err(|e| format!("Failed to parse last_sync_at: {e}"))?;
    Ok(parsed.timestamp())
}

#[cfg(test)]
#[path = "sync.test.rs"]
mod tests;
