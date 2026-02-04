#[cfg(test)]
mod tests {
    use sqlx::sqlite::SqlitePool;

    use crate::database::migrations::run_migrations;

    #[tokio::test]
    async fn test_schema_versions_table_creation() {
        // Arrange: Create in-memory database
        let pool = SqlitePool::connect("sqlite::memory:").await.unwrap();

        // Act: Run migrations
        run_migrations(&pool).await.unwrap();

        // Assert: Verify schema_versions table exists with correct structure
        let tables: Vec<String> =
            sqlx::query_scalar("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
                .fetch_all(&pool)
                .await
                .unwrap();

        assert!(
            tables.contains(&"schema_versions".to_string()),
            "schema_versions table should be created"
        );

        // Verify table structure
        let columns: Vec<(String, String)> = sqlx::query_as(
            "SELECT name, type FROM pragma_table_info('schema_versions') ORDER BY cid",
        )
        .fetch_all(&pool)
        .await
        .unwrap();

        assert_eq!(columns.len(), 3, "Should have 3 columns");
        assert_eq!(columns[0].0, "version", "First column should be version");
        assert_eq!(columns[0].1, "INTEGER", "version should be INTEGER type");
        assert_eq!(
            columns[1].0, "migration_name",
            "Second column should be migration_name"
        );
        assert_eq!(columns[1].1, "TEXT", "migration_name should be TEXT type");
        assert_eq!(
            columns[2].0, "applied_at",
            "Third column should be applied_at"
        );
        assert_eq!(columns[2].1, "TEXT", "applied_at should be TEXT type");
    }

    #[tokio::test]
    async fn test_migration_idempotency() {
        // Arrange: Create in-memory database
        let pool = SqlitePool::connect("sqlite::memory:").await.unwrap();

        // Act: Run migrations twice
        run_migrations(&pool).await.unwrap();
        let result = run_migrations(&pool).await;

        // Assert: Second run should not fail
        assert!(
            result.is_ok(),
            "Running migrations twice should not fail: {:?}",
            result.err()
        );

        // Verify no duplicate entries in schema_versions
        let count: i32 = sqlx::query_scalar("SELECT COUNT(*) FROM schema_versions")
            .fetch_one(&pool)
            .await
            .unwrap();

        // Should have exactly 1 migration (initial_schema)
        assert_eq!(
            count, 1,
            "Should have exactly 1 migration entry after running twice"
        );
    }

    #[tokio::test]
    async fn test_migration_tracking() {
        // Arrange: Create in-memory database
        let pool = SqlitePool::connect("sqlite::memory:").await.unwrap();

        // Act: Run migrations
        run_migrations(&pool).await.unwrap();

        // Assert: Verify migration was tracked
        let migrations: Vec<(i32, String, String)> = sqlx::query_as(
            "SELECT version, migration_name, applied_at FROM schema_versions ORDER BY version",
        )
        .fetch_all(&pool)
        .await
        .unwrap();

        assert!(
            !migrations.is_empty(),
            "At least one migration should be tracked"
        );

        // Verify first migration
        let (version, name, applied_at) = &migrations[0];
        assert_eq!(*version, 1, "First migration should be version 1");
        assert_eq!(
            *name, "initial_schema",
            "First migration should be named 'initial_schema'"
        );
        assert!(!applied_at.is_empty(), "applied_at timestamp should be set");

        // Verify timestamp format (ISO 8601)
        assert!(
            applied_at.contains('T'),
            "Timestamp should be in ISO 8601 format with 'T' separator, got: {}",
            applied_at
        );
    }

    #[tokio::test]
    async fn test_miniflux_accounts_table_creation() {
        let pool = SqlitePool::connect("sqlite::memory:").await.unwrap();
        run_migrations(&pool).await.unwrap();

        // Verify miniflux_accounts table exists
        let tables: Vec<String> =
            sqlx::query_scalar("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
                .fetch_all(&pool)
                .await
                .unwrap();

        assert!(
            tables.contains(&"miniflux_accounts".to_string()),
            "miniflux_accounts table should be created"
        );

        // Verify table structure
        let columns: Vec<(String, String)> = sqlx::query_as(
            "SELECT name, type FROM pragma_table_info('miniflux_accounts') ORDER BY cid",
        )
        .fetch_all(&pool)
        .await
        .unwrap();

        assert_eq!(columns.len(), 7, "Should have 7 columns");
        assert_eq!(columns[0].0, "id", "First column should be id");
        assert_eq!(columns[0].1, "INTEGER", "id should be INTEGER type");
        assert_eq!(columns[1].0, "username", "Second column should be username");
        assert_eq!(columns[1].1, "TEXT", "username should be TEXT type");
        assert_eq!(
            columns[2].0, "server_url",
            "Third column should be server_url"
        );
        assert_eq!(columns[2].1, "TEXT", "server_url should be TEXT type");
        assert_eq!(
            columns[3].0, "auth_method",
            "Fourth column should be auth_method"
        );
        assert_eq!(columns[3].1, "TEXT", "auth_method should be TEXT type");
        assert_eq!(
            columns[4].0, "is_active",
            "Fifth column should be is_active"
        );
        assert_eq!(columns[4].1, "BOOLEAN", "is_active should be BOOLEAN type");
        assert_eq!(
            columns[5].0, "created_at",
            "Sixth column should be created_at"
        );
        assert_eq!(columns[5].1, "TEXT", "created_at should be TEXT type");
        assert_eq!(
            columns[6].0, "updated_at",
            "Seventh column should be updated_at"
        );
        assert_eq!(columns[6].1, "TEXT", "updated_at should be TEXT type");

        // Verify migration was tracked
        let migrations: Vec<(i32, String)> =
            sqlx::query_as("SELECT version, migration_name FROM schema_versions ORDER BY version")
                .fetch_all(&pool)
                .await
                .unwrap();

        assert!(
            migrations
                .iter()
                .any(|(v, n)| *v == 1 && n == "initial_schema"),
            "Migration 1 should be tracked"
        );
    }

    #[tokio::test]
    async fn test_users_table_structure() {
        let pool = SqlitePool::connect("sqlite::memory:").await.unwrap();
        run_migrations(&pool).await.unwrap();

        // Verify server_url column exists
        let columns: Vec<(String, String)> =
            sqlx::query_as("SELECT name, type FROM pragma_table_info('users') ORDER BY cid")
                .fetch_all(&pool)
                .await
                .unwrap();

        assert!(
            columns.iter().any(|(name, _)| name == "server_url"),
            "server_url column should exist"
        );
    }
}
