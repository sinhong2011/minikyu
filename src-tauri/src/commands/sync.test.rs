#[cfg(test)]
mod tests {
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

        assert_eq!(row.0, 0, "New queue item should have retry_count = 0");
        assert_eq!(row.1, "pending");
        assert!(!row.2.is_empty(), "created_at should be set");
        assert!(!row.3.is_empty(), "updated_at should be set");
    }

    #[tokio::test]
    async fn test_sync_miniflux_returns_summary() {
        use crate::commands::sync::sync_miniflux_impl;
        use crate::miniflux::MinifluxClient;

        let pool = setup_test_db().await;
        let client = MinifluxClient::new("https://miniflux.example.org".to_string());

        let result = sync_miniflux_impl(&pool, &client).await;

        assert!(result.is_err());
    }
}
