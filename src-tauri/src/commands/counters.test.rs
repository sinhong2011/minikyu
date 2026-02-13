#[cfg(test)]
mod tests {
    use crate::database::migrations::run_migrations;
    use sqlx::SqlitePool;

    async fn setup_test_db() -> SqlitePool {
        let pool = SqlitePool::connect("sqlite::memory:")
            .await
            .expect("Failed to create in-memory database");
        run_migrations(&pool)
            .await
            .expect("Failed to run migrations");
        pool
    }

    async fn insert_minimum_feed_data(pool: &SqlitePool) {
        let now = "2026-02-12T00:00:00Z";

        sqlx::query(
            r#"
            INSERT INTO categories (id, user_id, title, hide_globally, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?)
            "#,
        )
        .bind(1_i64)
        .bind(1_i64)
        .bind("General")
        .bind(false)
        .bind(now)
        .bind(now)
        .execute(pool)
        .await
        .expect("Failed to insert category");

        sqlx::query(
            r#"
            INSERT INTO feeds (id, user_id, title, site_url, feed_url, category_id, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            "#,
        )
        .bind(1_i64)
        .bind(1_i64)
        .bind("Feed")
        .bind("https://example.com")
        .bind("https://example.com/feed.xml")
        .bind(1_i64)
        .bind(now)
        .bind(now)
        .execute(pool)
        .await
        .expect("Failed to insert feed");
    }

    async fn insert_entry(pool: &SqlitePool, id: i64, status: &str, published_at: &str) {
        sqlx::query(
            r#"
            INSERT INTO entries (id, user_id, feed_id, title, url, hash, published_at, created_at, status)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            "#,
        )
        .bind(id)
        .bind(1_i64)
        .bind(1_i64)
        .bind(format!("Entry {id}"))
        .bind(format!("https://example.com/{id}"))
        .bind(format!("hash-{id}"))
        .bind(published_at)
        .bind(published_at)
        .bind(status)
        .execute(pool)
        .await
        .expect("Failed to insert entry");
    }

    #[tokio::test]
    async fn test_query_unread_count_for_window_normalizes_timezone_offsets() {
        let pool = setup_test_db().await;
        insert_minimum_feed_data(&pool).await;

        // This timestamp is 2026-02-12 04:30:00 UTC and should be counted in the 12th UTC window.
        insert_entry(&pool, 1, "unread", "2026-02-11T20:30:00-08:00").await;
        // This timestamp is 2026-02-11 23:30:00 UTC and should be excluded from the 12th UTC window.
        insert_entry(&pool, 2, "unread", "2026-02-11T15:30:00-08:00").await;
        // Read entries must never be counted.
        insert_entry(&pool, 3, "read", "2026-02-12T09:00:00Z").await;

        let count = super::super::query_unread_count_for_window(
            &pool,
            "2026-02-12 00:00:00",
            "2026-02-13 00:00:00",
        )
        .await
        .expect("Query should succeed");

        assert_eq!(
            count, 1,
            "Only one unread entry should be inside the window"
        );
    }
}
