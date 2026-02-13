use crate::miniflux::counters::{CategoryUnread, FeedUnread, UnreadCounts};
use crate::AppState;
use tauri::State;

async fn query_unread_count_for_window(
    pool: &sqlx::SqlitePool,
    window_start_utc: &str,
    window_end_utc: &str,
) -> Result<i64, sqlx::Error> {
    sqlx::query_scalar(
        r#"
        SELECT COUNT(*)
        FROM entries
        WHERE status = 'unread'
        AND datetime(published_at) >= datetime(?)
        AND datetime(published_at) < datetime(?)
        "#,
    )
    .bind(window_start_utc)
    .bind(window_end_utc)
    .fetch_one(pool)
    .await
}

/// Get unread counts from local database
#[tauri::command]
#[specta::specta]
pub async fn get_unread_counts(state: State<'_, AppState>) -> Result<UnreadCounts, String> {
    let pool = state
        .db_pool
        .lock()
        .await
        .as_ref()
        .ok_or("Database not initialized")?
        .clone();

    let total: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM entries WHERE status = 'unread'")
        .fetch_one(&pool)
        .await
        .map_err(|e| format!("Failed to fetch total unread count: {e}"))?;

    let by_category: Vec<CategoryUnread> = sqlx::query_as(
        r#"
        SELECT c.id as category_id, COUNT(e.id) as unread_count
        FROM categories c
        LEFT JOIN feeds f ON f.category_id = c.id
        LEFT JOIN entries e ON e.feed_id = f.id AND e.status = 'unread'
        GROUP BY c.id
        "#,
    )
    .fetch_all(&pool)
    .await
    .map_err(|e| format!("Failed to fetch category unread counts: {e}"))?;

    let by_feed: Vec<FeedUnread> = sqlx::query_as(
        r#"
        SELECT feed_id, COUNT(*) as unread_count
        FROM entries
        WHERE status = 'unread'
        GROUP BY feed_id
        "#,
    )
    .fetch_all(&pool)
    .await
    .map_err(|e| format!("Failed to fetch feed unread counts: {e}"))?;

    let today_window_start_utc: String =
        sqlx::query_scalar("SELECT datetime('now', 'localtime', 'start of day', 'utc')")
            .fetch_one(&pool)
            .await
            .map_err(|e| format!("Failed to calculate today's start boundary: {e}"))?;
    let today_window_end_utc: String =
        sqlx::query_scalar("SELECT datetime('now', 'localtime', 'start of day', '+1 day', 'utc')")
            .fetch_one(&pool)
            .await
            .map_err(|e| format!("Failed to calculate today's end boundary: {e}"))?;

    let today =
        query_unread_count_for_window(&pool, &today_window_start_utc, &today_window_end_utc)
            .await
            .map_err(|e| format!("Failed to fetch today unread count: {e}"))?;

    Ok(UnreadCounts {
        total,
        by_category,
        by_feed,
        today,
    })
}

#[cfg(test)]
#[path = "counters.test.rs"]
mod tests;
