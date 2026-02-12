#[cfg(test)]
mod tests {
    use super::super::delete_removed_feeds;
    use crate::commands::sync::{enqueue_sync_operation, get_or_create_sync_state};
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

    #[tokio::test]
    async fn test_enqueue_sync_operation_persists_queue_row() {
        let pool = setup_test_db().await;
        let payload = serde_json::json!({"status": "read"}).to_string();
        let id = enqueue_sync_operation(&pool, "entry", 123, "mark_read", &payload)
            .await
            .unwrap();

        let row: (i64, String, String, i64, String, String) = sqlx::query_as(
            "SELECT id, entity_type, operation_type, entity_id, payload, status FROM sync_queue WHERE id = ?",
        )
        .bind(id)
        .fetch_one(&pool)
        .await
        .unwrap();

        assert_eq!(row.1, "entry");
        assert_eq!(row.2, "mark_read");
        assert_eq!(row.3, 123);
        assert_eq!(row.4, payload);
        assert_eq!(row.5, "pending");
    }

    #[tokio::test]
    async fn test_get_sync_state_default_row_created() {
        let pool = setup_test_db().await;
        let state = get_or_create_sync_state(&pool).await.unwrap();
        assert!(!state.sync_in_progress);
    }

    #[tokio::test]
    async fn test_enqueue_sync_operation_sets_initial_metadata() {
        let pool = setup_test_db().await;
        let payload = serde_json::json!({"status": "read"}).to_string();

        let id = enqueue_sync_operation(&pool, "entry", 123, "mark_read", &payload)
            .await
            .unwrap();

        let row: (i64, String, String, String) = sqlx::query_as(
            "SELECT retry_count, status, created_at, updated_at FROM sync_queue WHERE id = ?",
        )
        .bind(id)
        .fetch_one(&pool)
        .await
        .unwrap();

        assert_eq!(row.0, 0, "New queue item should have retry_count =0");
        assert_eq!(row.1, "pending");
        assert!(!row.2.is_empty(), "created_at should be set");
        assert!(!row.3.is_empty(), "updated_at should be set");
    }

    #[tokio::test]
    async fn test_delete_removed_feeds_cleans_dependent_rows_before_deleting_feed() {
        let pool = setup_test_db().await;
        let now = "2026-02-11T00:00:00Z";

        sqlx::query(
            "INSERT INTO feeds (id, user_id, title, site_url, feed_url, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
        )
        .bind(100_i64)
        .bind(1_i64)
        .bind("Keep Feed")
        .bind("https://keep.example.com")
        .bind("https://keep.example.com/rss")
        .bind(now)
        .bind(now)
        .execute(&pool)
        .await
        .unwrap();

        sqlx::query(
            "INSERT INTO feeds (id, user_id, title, site_url, feed_url, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
        )
        .bind(200_i64)
        .bind(1_i64)
        .bind("Removed Feed")
        .bind("https://removed.example.com")
        .bind("https://removed.example.com/rss")
        .bind(now)
        .bind(now)
        .execute(&pool)
        .await
        .unwrap();

        sqlx::query(
            "INSERT INTO entries (id, user_id, feed_id, title, url, hash, published_at, created_at, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
        )
        .bind(1_000_i64)
        .bind(1_i64)
        .bind(100_i64)
        .bind("Keep Entry")
        .bind("https://keep.example.com/1")
        .bind("keep-hash")
        .bind(now)
        .bind(now)
        .bind("unread")
        .execute(&pool)
        .await
        .unwrap();

        sqlx::query(
            "INSERT INTO entries (id, user_id, feed_id, title, url, hash, published_at, created_at, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
        )
        .bind(2_000_i64)
        .bind(1_i64)
        .bind(200_i64)
        .bind("Removed Entry")
        .bind("https://removed.example.com/1")
        .bind("removed-hash")
        .bind(now)
        .bind(now)
        .bind("unread")
        .execute(&pool)
        .await
        .unwrap();

        sqlx::query(
            "INSERT INTO icons (id, feed_id, icon_id, data, mime_type, created_at) VALUES (?, ?, ?, ?, ?, ?)",
        )
        .bind(1_i64)
        .bind(100_i64)
        .bind(10_i64)
        .bind("aGVsbG8=")
        .bind("image/png")
        .bind(now)
        .execute(&pool)
        .await
        .unwrap();

        sqlx::query(
            "INSERT INTO icons (id, feed_id, icon_id, data, mime_type, created_at) VALUES (?, ?, ?, ?, ?, ?)",
        )
        .bind(2_i64)
        .bind(200_i64)
        .bind(20_i64)
        .bind("d29ybGQ=")
        .bind("image/png")
        .bind(now)
        .execute(&pool)
        .await
        .unwrap();

        delete_removed_feeds(&pool, 1, &[100]).await.unwrap();

        let removed_feed_count: i64 =
            sqlx::query_scalar("SELECT COUNT(*) FROM feeds WHERE id = 200 AND user_id = 1")
                .fetch_one(&pool)
                .await
                .unwrap();
        assert_eq!(removed_feed_count, 0);

        let removed_entry_count: i64 =
            sqlx::query_scalar("SELECT COUNT(*) FROM entries WHERE feed_id = 200 AND user_id = 1")
                .fetch_one(&pool)
                .await
                .unwrap();
        assert_eq!(removed_entry_count, 0);

        let removed_icon_count: i64 =
            sqlx::query_scalar("SELECT COUNT(*) FROM icons WHERE feed_id = 200")
                .fetch_one(&pool)
                .await
                .unwrap();
        assert_eq!(removed_icon_count, 0);

        let kept_feed_count: i64 =
            sqlx::query_scalar("SELECT COUNT(*) FROM feeds WHERE id = 100 AND user_id = 1")
                .fetch_one(&pool)
                .await
                .unwrap();
        assert_eq!(kept_feed_count, 1);
    }

    #[tokio::test]
    async fn test_delete_removed_feeds_with_empty_remote_list_only_clears_current_user_data() {
        let pool = setup_test_db().await;
        let now = "2026-02-11T00:00:00Z";

        sqlx::query(
            "INSERT INTO feeds (id, user_id, title, site_url, feed_url, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
        )
        .bind(300_i64)
        .bind(1_i64)
        .bind("User1 Feed")
        .bind("https://u1.example.com")
        .bind("https://u1.example.com/rss")
        .bind(now)
        .bind(now)
        .execute(&pool)
        .await
        .unwrap();

        sqlx::query(
            "INSERT INTO feeds (id, user_id, title, site_url, feed_url, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
        )
        .bind(400_i64)
        .bind(2_i64)
        .bind("User2 Feed")
        .bind("https://u2.example.com")
        .bind("https://u2.example.com/rss")
        .bind(now)
        .bind(now)
        .execute(&pool)
        .await
        .unwrap();

        sqlx::query(
            "INSERT INTO entries (id, user_id, feed_id, title, url, hash, published_at, created_at, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
        )
        .bind(3_000_i64)
        .bind(1_i64)
        .bind(300_i64)
        .bind("User1 Entry")
        .bind("https://u1.example.com/1")
        .bind("u1-hash")
        .bind(now)
        .bind(now)
        .bind("unread")
        .execute(&pool)
        .await
        .unwrap();

        sqlx::query(
            "INSERT INTO entries (id, user_id, feed_id, title, url, hash, published_at, created_at, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
        )
        .bind(4_000_i64)
        .bind(2_i64)
        .bind(400_i64)
        .bind("User2 Entry")
        .bind("https://u2.example.com/1")
        .bind("u2-hash")
        .bind(now)
        .bind(now)
        .bind("unread")
        .execute(&pool)
        .await
        .unwrap();

        sqlx::query(
            "INSERT INTO icons (id, feed_id, icon_id, data, mime_type, created_at) VALUES (?, ?, ?, ?, ?, ?)",
        )
        .bind(3_i64)
        .bind(300_i64)
        .bind(30_i64)
        .bind("dXNlcjE=")
        .bind("image/png")
        .bind(now)
        .execute(&pool)
        .await
        .unwrap();

        sqlx::query(
            "INSERT INTO icons (id, feed_id, icon_id, data, mime_type, created_at) VALUES (?, ?, ?, ?, ?, ?)",
        )
        .bind(4_i64)
        .bind(400_i64)
        .bind(40_i64)
        .bind("dXNlcjI=")
        .bind("image/png")
        .bind(now)
        .execute(&pool)
        .await
        .unwrap();

        delete_removed_feeds(&pool, 1, &[]).await.unwrap();

        let user1_feed_count: i64 =
            sqlx::query_scalar("SELECT COUNT(*) FROM feeds WHERE user_id = 1")
                .fetch_one(&pool)
                .await
                .unwrap();
        assert_eq!(user1_feed_count, 0);

        let user1_entry_count: i64 =
            sqlx::query_scalar("SELECT COUNT(*) FROM entries WHERE user_id = 1")
                .fetch_one(&pool)
                .await
                .unwrap();
        assert_eq!(user1_entry_count, 0);

        let user1_icon_count: i64 =
            sqlx::query_scalar("SELECT COUNT(*) FROM icons WHERE feed_id = 300")
                .fetch_one(&pool)
                .await
                .unwrap();
        assert_eq!(user1_icon_count, 0);

        let user2_feed_count: i64 =
            sqlx::query_scalar("SELECT COUNT(*) FROM feeds WHERE user_id = 2")
                .fetch_one(&pool)
                .await
                .unwrap();
        assert_eq!(user2_feed_count, 1);

        let user2_entry_count: i64 =
            sqlx::query_scalar("SELECT COUNT(*) FROM entries WHERE user_id = 2")
                .fetch_one(&pool)
                .await
                .unwrap();
        assert_eq!(user2_entry_count, 1);

        let user2_icon_count: i64 =
            sqlx::query_scalar("SELECT COUNT(*) FROM icons WHERE feed_id = 400")
                .fetch_one(&pool)
                .await
                .unwrap();
        assert_eq!(user2_icon_count, 1);
    }
}
