//! Podcast playback and feed settings management

use crate::miniflux::types::{CleanupResult, PodcastFeedSettings, PodcastProgress};
use crate::AppState;
use chrono::Utc;
use sqlx::Row;
use tauri::Manager;

/// Get the entry_id for an enclosure by its URL (for linking downloads to player)
#[tauri::command]
#[specta::specta]
pub async fn get_entry_id_by_enclosure_url(
    app: tauri::AppHandle,
    url: String,
) -> Result<Option<String>, String> {
    let state: tauri::State<'_, AppState> = app.state();
    let pool = state
        .db_pool
        .lock()
        .await
        .as_ref()
        .ok_or("Database not initialized")?
        .clone();

    let row = sqlx::query("SELECT entry_id FROM enclosures WHERE url = ? LIMIT 1")
        .bind(&url)
        .fetch_optional(&pool)
        .await
        .map_err(|e| format!("{e}"))?;

    match row {
        Some(r) => {
            let entry_id: i64 = r.get("entry_id");
            Ok(Some(entry_id.to_string()))
        }
        None => Ok(None),
    }
}

/// Get podcast settings for a feed. Returns defaults if no settings exist.
#[tauri::command]
#[specta::specta]
pub async fn get_podcast_feed_settings(
    app: tauri::AppHandle,
    feed_id: i64,
) -> Result<PodcastFeedSettings, String> {
    let state: tauri::State<'_, AppState> = app.state();
    let pool = state
        .db_pool
        .lock()
        .await
        .as_ref()
        .ok_or("Database not initialized")?
        .clone();

    let row = sqlx::query(
        "SELECT feed_id, auto_download_count, playback_speed, auto_cleanup_days FROM podcast_feed_settings WHERE feed_id = ?",
    )
    .bind(feed_id)
    .fetch_optional(&pool)
    .await
    .map_err(|e| format!("{e}"))?;

    match row {
        Some(row) => Ok(PodcastFeedSettings {
            feed_id: row.get("feed_id"),
            auto_download_count: row.get("auto_download_count"),
            playback_speed: row.get("playback_speed"),
            auto_cleanup_days: row.get("auto_cleanup_days"),
        }),
        None => Ok(PodcastFeedSettings {
            feed_id,
            auto_download_count: 3,
            playback_speed: 1.0,
            auto_cleanup_days: 7,
        }),
    }
}

/// Update podcast settings for a feed (upsert)
#[tauri::command]
#[specta::specta]
pub async fn update_podcast_feed_settings(
    app: tauri::AppHandle,
    feed_id: i64,
    auto_download_count: i32,
    playback_speed: f64,
    auto_cleanup_days: i32,
) -> Result<(), String> {
    let state: tauri::State<'_, AppState> = app.state();
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
        INSERT INTO podcast_feed_settings (feed_id, auto_download_count, playback_speed, auto_cleanup_days, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?)
        ON CONFLICT(feed_id) DO UPDATE SET
            auto_download_count = excluded.auto_download_count,
            playback_speed = excluded.playback_speed,
            auto_cleanup_days = excluded.auto_cleanup_days,
            updated_at = excluded.updated_at
        "#,
    )
    .bind(feed_id)
    .bind(auto_download_count)
    .bind(playback_speed)
    .bind(auto_cleanup_days)
    .bind(&now)
    .bind(&now)
    .execute(&pool)
    .await
    .map_err(|e| format!("{e}"))?;

    Ok(())
}

/// Save podcast playback progress (upsert)
#[tauri::command]
#[specta::specta]
pub async fn save_podcast_progress(
    app: tauri::AppHandle,
    entry_id: i64,
    current_time: i32,
    total_time: i32,
) -> Result<(), String> {
    let state: tauri::State<'_, AppState> = app.state();
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
        INSERT INTO podcast_progress (entry_id, "current_time", total_time, completed, last_played_at)
        VALUES (?, ?, ?, FALSE, ?)
        ON CONFLICT(entry_id) DO UPDATE SET
            "current_time" = excluded."current_time",
            total_time = excluded.total_time,
            last_played_at = excluded.last_played_at
        "#,
    )
    .bind(entry_id)
    .bind(current_time)
    .bind(total_time)
    .bind(&now)
    .execute(&pool)
    .await
    .map_err(|e| format!("{e}"))?;

    Ok(())
}

/// Get podcast progress for a single entry
#[tauri::command]
#[specta::specta]
pub async fn get_podcast_progress(
    app: tauri::AppHandle,
    entry_id: i64,
) -> Result<Option<PodcastProgress>, String> {
    let state: tauri::State<'_, AppState> = app.state();
    let pool = state
        .db_pool
        .lock()
        .await
        .as_ref()
        .ok_or("Database not initialized")?
        .clone();

    let row = sqlx::query(
        r#"SELECT entry_id, "current_time", total_time, completed, last_played_at FROM podcast_progress WHERE entry_id = ?"#,
    )
    .bind(entry_id)
    .fetch_optional(&pool)
    .await
    .map_err(|e| format!("{e}"))?;

    match row {
        Some(r) => Ok(Some(PodcastProgress {
            entry_id: r.try_get("entry_id").map_err(|e| format!("{e}"))?,
            current_time: r.try_get("current_time").map_err(|e| format!("{e}"))?,
            total_time: r.try_get("total_time").map_err(|e| format!("{e}"))?,
            completed: r.try_get("completed").map_err(|e| format!("{e}"))?,
            last_played_at: r.try_get("last_played_at").map_err(|e| format!("{e}"))?,
        })),
        None => Ok(None),
    }
}

/// Get podcast progress for multiple entries (batch)
#[tauri::command]
#[specta::specta]
pub async fn get_podcast_progress_batch(
    app: tauri::AppHandle,
    entry_ids: Vec<i64>,
) -> Result<Vec<PodcastProgress>, String> {
    if entry_ids.is_empty() {
        return Ok(vec![]);
    }

    let state: tauri::State<'_, AppState> = app.state();
    let pool = state
        .db_pool
        .lock()
        .await
        .as_ref()
        .ok_or("Database not initialized")?
        .clone();

    let placeholders: Vec<String> = entry_ids.iter().map(|_| "?".to_string()).collect();
    let query_str = format!(
        r#"SELECT entry_id, "current_time", total_time, completed, last_played_at FROM podcast_progress WHERE entry_id IN ({})"#,
        placeholders.join(",")
    );

    let mut query = sqlx::query(&query_str);
    for id in &entry_ids {
        query = query.bind(id);
    }

    let rows = query.fetch_all(&pool).await.map_err(|e| format!("{e}"))?;

    let mut results = Vec::with_capacity(rows.len());
    for r in &rows {
        results.push(PodcastProgress {
            entry_id: r.try_get("entry_id").map_err(|e| format!("{e}"))?,
            current_time: r.try_get("current_time").map_err(|e| format!("{e}"))?,
            total_time: r.try_get("total_time").map_err(|e| format!("{e}"))?,
            completed: r.try_get("completed").map_err(|e| format!("{e}"))?,
            last_played_at: r.try_get("last_played_at").map_err(|e| format!("{e}"))?,
        });
    }
    Ok(results)
}

/// Mark an episode as completed
#[tauri::command]
#[specta::specta]
pub async fn mark_episode_completed(app: tauri::AppHandle, entry_id: i64) -> Result<(), String> {
    let state: tauri::State<'_, AppState> = app.state();
    let pool = state
        .db_pool
        .lock()
        .await
        .as_ref()
        .ok_or("Database not initialized")?
        .clone();
    let now = Utc::now().to_rfc3339();

    sqlx::query(
        "UPDATE podcast_progress SET completed = TRUE, last_played_at = ? WHERE entry_id = ?",
    )
    .bind(&now)
    .bind(entry_id)
    .execute(&pool)
    .await
    .map_err(|e| format!("{e}"))?;

    Ok(())
}

/// Seed test data for e2e tests. No-op in release builds.
#[tauri::command]
#[specta::specta]
pub async fn seed_e2e_test_data(app: tauri::AppHandle, entry_ids: Vec<i64>) -> Result<(), String> {
    if !cfg!(debug_assertions) {
        return Err("Test command not available in release builds".to_string());
    }

    let state: tauri::State<'_, AppState> = app.state();
    let pool = state
        .db_pool
        .lock()
        .await
        .as_ref()
        .ok_or("Database not initialized")?
        .clone();
    let now = Utc::now().to_rfc3339();

    // Clear stale test data that may have incorrect column types from previous runs
    sqlx::query("DELETE FROM podcast_progress")
        .execute(&pool)
        .await
        .map_err(|e| format!("{e}"))?;
    sqlx::query("DELETE FROM podcast_feed_settings")
        .execute(&pool)
        .await
        .map_err(|e| format!("{e}"))?;

    // Create test category
    sqlx::query(
        "INSERT OR IGNORE INTO categories (id, title, user_id, hide_globally, created_at, updated_at) VALUES (1, 'Test', 1, FALSE, ?, ?)",
    )
    .bind(&now)
    .bind(&now)
    .execute(&pool)
    .await
    .map_err(|e| format!("{e}"))?;

    // Create test feed
    sqlx::query(
        r#"INSERT OR IGNORE INTO feeds (id, user_id, feed_url, site_url, title, checked_at, category_id, created_at, updated_at)
           VALUES (1, 1, 'https://test.example.com/feed.xml', 'https://test.example.com', 'Test Feed', ?, 1, ?, ?)"#,
    )
    .bind(&now)
    .bind(&now)
    .bind(&now)
    .execute(&pool)
    .await
    .map_err(|e| format!("{e}"))?;

    // Create test entries
    for entry_id in &entry_ids {
        sqlx::query(
            r#"INSERT OR IGNORE INTO entries (id, user_id, feed_id, status, hash, title, url, published_at, created_at, changed_at, content)
               VALUES (?, 1, 1, 'read', ?, 'Test Entry', 'https://test.example.com/entry', ?, ?, ?, '')"#,
        )
        .bind(entry_id)
        .bind(format!("hash-{entry_id}"))
        .bind(&now)
        .bind(&now)
        .bind(&now)
        .execute(&pool)
        .await
        .map_err(|e| format!("{e}"))?;
    }

    Ok(())
}

/// Clean up played podcast episodes older than auto_cleanup_days
#[tauri::command]
#[specta::specta]
pub async fn cleanup_played_episodes(app: tauri::AppHandle) -> Result<CleanupResult, String> {
    let state: tauri::State<'_, AppState> = app.state();
    let pool = state
        .db_pool
        .lock()
        .await
        .as_ref()
        .ok_or("Database not initialized")?
        .clone();

    // Find completed episodes past their cleanup threshold
    let rows = sqlx::query(
        r#"
        SELECT e.local_path, e.entry_id
        FROM enclosures e
        JOIN podcast_progress pp ON e.entry_id = pp.entry_id
        JOIN entries ent ON e.entry_id = ent.id
        LEFT JOIN podcast_feed_settings pfs ON ent.feed_id = pfs.feed_id
        WHERE pp.completed = TRUE
          AND e.downloaded = TRUE
          AND e.local_path IS NOT NULL
          AND pp.last_played_at < datetime('now', '-' || COALESCE(pfs.auto_cleanup_days, 7) || ' days')
          AND e.mime_type LIKE 'audio/%'
        "#,
    )
    .fetch_all(&pool)
    .await
    .map_err(|e| format!("{e}"))?;

    let mut deleted_count = 0i32;
    let mut freed_bytes = 0i64;

    for row in &rows {
        let local_path: Option<String> = row.get("local_path");
        let entry_id: i64 = row.get("entry_id");

        if let Some(path) = local_path {
            if let Ok(metadata) = std::fs::metadata(&path) {
                freed_bytes += metadata.len() as i64;
            }
            let _ = std::fs::remove_file(&path);
        }

        let _ = sqlx::query(
            "UPDATE enclosures SET downloaded = FALSE, local_path = NULL, download_progress = 0 WHERE entry_id = ? AND mime_type LIKE 'audio/%'",
        )
        .bind(entry_id)
        .execute(&pool)
        .await;

        deleted_count += 1;
    }

    log::info!("Podcast cleanup: deleted {deleted_count} episodes, freed {freed_bytes} bytes");

    Ok(CleanupResult {
        deleted_count,
        freed_bytes,
    })
}
