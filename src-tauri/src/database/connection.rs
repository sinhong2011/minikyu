use sqlx::{sqlite::SqlitePool, Pool, Sqlite};
use std::path::PathBuf;
use tauri::AppHandle;

/// Get the database path for the application
pub fn get_db_path(app_handle: &AppHandle) -> PathBuf {
    let app_dir = app_handle
        .path()
        .app_data_dir()
        .expect("Failed to get app data directory");

    // Create directory if it doesn't exist
    std::fs::create_dir_all(&app_dir).expect("Failed to create app data directory");

    app_dir.join("miniflux.db")
}

/// Initialize the database pool with migrations
pub async fn init_database_pool(app_handle: &AppHandle) -> Result<SqlitePool, sqlx::Error> {
    let db_path = get_db_path(app_handle);
    let db_url = format!("sqlite:{}", db_path.display());

    log::info!("Initializing database at: {}", db_url);

    // Create connection pool
    let pool = SqlitePool::connect(&db_url).await?;

    // Run migrations
    sqlx::query(
        r#"
        PRAGMA journal_mode = WAL;
        PRAGMA foreign_keys = ON;
        PRAGMA synchronous = NORMAL;
        "#,
    )
    .execute(&pool)
    .await?;

    // Run schema migrations
    run_migrations(&pool).await?;

    log::info!("Database initialized successfully");

    Ok(pool)
}

/// Run database migrations
async fn run_migrations(pool: &SqlitePool) -> Result<(), sqlx::Error> {
    // Categories table
    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS categories (
            id INTEGER PRIMARY KEY,
            user_id INTEGER NOT NULL,
            title TEXT NOT NULL,
            hide_globally BOOLEAN DEFAULT FALSE,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            sync_status TEXT DEFAULT 'synced',
            UNIQUE(id, user_id)
        )
        "#,
    )
    .execute(pool)
    .await?;

    // Feeds table
    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS feeds (
            id INTEGER PRIMARY KEY,
            user_id INTEGER NOT NULL,
            title TEXT NOT NULL,
            site_url TEXT NOT NULL,
            feed_url TEXT NOT NULL,
            category_id INTEGER,
            checked_at TEXT,
            etag_header TEXT,
            last_modified_header TEXT,
            parsing_error_message TEXT,
            parsing_error_count INTEGER DEFAULT 0,
            scraper_rules TEXT,
            rewrite_rules TEXT,
            crawler BOOLEAN DEFAULT FALSE,
            blocklist_rules TEXT,
            keeplist_rules TEXT,
            user_agent TEXT,
            username TEXT,
            password TEXT,
            disabled BOOLEAN DEFAULT FALSE,
            ignore_http_cache BOOLEAN DEFAULT FALSE,
            fetch_via_proxy BOOLEAN DEFAULT FALSE,
            no_media_player BOOLEAN DEFAULT FALSE,
            allow_self_signed_certificates BOOLEAN DEFAULT FALSE,
            urlrewrite_rules TEXT,
            cookie TEXT,
            apprise_service_urls TEXT,
            hide_globally BOOLEAN DEFAULT FALSE,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            sync_status TEXT DEFAULT 'synced',
            FOREIGN KEY (category_id) REFERENCES categories(id),
            UNIQUE(id, user_id)
        )
        "#,
    )
    .execute(pool)
    .await?;

    // Icons table
    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS icons (
            id INTEGER PRIMARY KEY,
            feed_id INTEGER NOT NULL,
            icon_id INTEGER NOT NULL,
            data TEXT NOT NULL,
            mime_type TEXT NOT NULL,
            created_at TEXT NOT NULL,
            FOREIGN KEY (feed_id) REFERENCES feeds(id),
            UNIQUE(feed_id)
        )
        "#,
    )
    .execute(pool)
    .await?;

    // Entries table
    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS entries (
            id INTEGER PRIMARY KEY,
            user_id INTEGER NOT NULL,
            feed_id INTEGER NOT NULL,
            title TEXT NOT NULL,
            url TEXT NOT NULL,
            comments_url TEXT,
            author TEXT,
            content TEXT,
            hash TEXT NOT NULL,
            published_at TEXT NOT NULL,
            created_at TEXT NOT NULL,
            changed_at TEXT,
            status TEXT NOT NULL,
            share_code TEXT,
            starred BOOLEAN DEFAULT FALSE,
            reading_time INTEGER,
            sync_status TEXT DEFAULT 'synced',
            FOREIGN KEY (feed_id) REFERENCES feeds(id),
            UNIQUE(id, user_id)
        )
        "#,
    )
    .execute(pool)
    .await?;

    // Enclosures table
    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS enclosures (
            id INTEGER PRIMARY KEY,
            entry_id INTEGER NOT NULL,
            url TEXT NOT NULL,
            mime_type TEXT NOT NULL,
            length INTEGER,
            position INTEGER DEFAULT 0,
            media_type TEXT,
            downloaded BOOLEAN DEFAULT FALSE,
            local_path TEXT,
            download_progress INTEGER DEFAULT 0,
            created_at TEXT NOT NULL,
            FOREIGN KEY (entry_id) REFERENCES entries(id) ON DELETE CASCADE
        )
        "#,
    )
    .execute(pool)
    .await?;

    // Tags table
    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS tags (
            id INTEGER PRIMARY KEY,
            entry_id INTEGER NOT NULL,
            tag TEXT NOT NULL,
            created_at TEXT NOT NULL,
            FOREIGN KEY (entry_id) REFERENCES entries(id) ON DELETE CASCADE,
            UNIQUE(entry_id, tag)
        )
        "#,
    )
    .execute(pool)
    .await?;

    // Users table
    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY,
            username TEXT NOT NULL UNIQUE,
            is_admin BOOLEAN DEFAULT FALSE,
            theme TEXT DEFAULT 'system',
            language TEXT DEFAULT 'en',
            timezone TEXT DEFAULT 'UTC',
            entry_sorting_direction TEXT DEFAULT 'asc',
            entries_per_page INTEGER DEFAULT 100,
            keyboard_shortcuts TEXT,
            display_mode TEXT DEFAULT 'standalone',
            show_reading_time BOOLEAN DEFAULT TRUE,
            entry_swipe BOOLEAN DEFAULT TRUE,
            custom_css TEXT,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        )
        "#,
    )
    .execute(pool)
    .await?;

    // Sync state table
    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS sync_state (
            id INTEGER PRIMARY KEY,
            last_sync_at TEXT,
            last_full_sync_at TEXT,
            sync_in_progress BOOLEAN DEFAULT FALSE,
            sync_error TEXT,
            sync_version INTEGER DEFAULT 1
        )
        "#,
    )
    .execute(pool)
    .await?;

    // Sync queue table
    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS sync_queue (
            id INTEGER PRIMARY KEY,
            operation_type TEXT NOT NULL,
            entity_type TEXT NOT NULL,
            entity_id INTEGER NOT NULL,
            payload TEXT NOT NULL,
            retry_count INTEGER DEFAULT 0,
            status TEXT DEFAULT 'pending',
            error_message TEXT,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        )
        "#,
    )
    .execute(pool)
    .await?;

    // Podcast progress table
    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS podcast_progress (
            id INTEGER PRIMARY KEY,
            entry_id INTEGER NOT NULL UNIQUE,
            current_time INTEGER NOT NULL,
            total_time INTEGER NOT NULL,
            completed BOOLEAN DEFAULT FALSE,
            last_played_at TEXT NOT NULL,
            FOREIGN KEY (entry_id) REFERENCES entries(id) ON DELETE CASCADE
        )
        "#,
    )
    .execute(pool)
    .await?;

    // Create indexes
    sqlx::query("CREATE INDEX IF NOT EXISTS idx_entries_feed_id ON entries(feed_id)")
        .execute(pool)
        .await?;

    sqlx::query("CREATE INDEX IF NOT EXISTS idx_entries_status ON entries(status)")
        .execute(pool)
        .await?;

    sqlx::query("CREATE INDEX IF NOT EXISTS idx_entries_starred ON entries(starred)")
        .execute(pool)
        .await?;

    sqlx::query(
        "CREATE INDEX IF NOT EXISTS idx_entries_published_at ON entries(published_at DESC)",
    )
    .execute(pool)
    .await?;

    sqlx::query("CREATE INDEX IF NOT EXISTS idx_entries_user_status ON entries(user_id, status)")
        .execute(pool)
        .await?;

    sqlx::query("CREATE INDEX IF NOT EXISTS idx_enclosures_entry_id ON enclosures(entry_id)")
        .execute(pool)
        .await?;

    sqlx::query("CREATE INDEX IF NOT EXISTS idx_enclosures_media_type ON enclosures(media_type)")
        .execute(pool)
        .await?;

    sqlx::query("CREATE INDEX IF NOT EXISTS idx_sync_queue_status ON sync_queue(status)")
        .execute(pool)
        .await?;

    sqlx::query("CREATE INDEX IF NOT EXISTS idx_feeds_category_id ON feeds(category_id)")
        .execute(pool)
        .await?;

    sqlx::query("CREATE INDEX IF NOT EXISTS idx_feeds_user_id ON feeds(user_id)")
        .execute(pool)
        .await?;

    sqlx::query("CREATE INDEX IF NOT EXISTS idx_categories_user_id ON categories(user_id)")
        .execute(pool)
        .await?;

    log::info!("Database migrations completed");

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_in_memory_db() {
        let pool = SqlitePool::connect("sqlite::memory:").await.unwrap();
        run_migrations(&pool).await.unwrap();

        // Verify tables exist
        let tables: Vec<String> =
            sqlx::query_scalar("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
                .fetch_all(&pool)
                .await
                .unwrap();

        assert!(tables.contains(&"categories".to_string()));
        assert!(tables.contains(&"feeds".to_string()));
        assert!(tables.contains(&"entries".to_string()));
        assert!(tables.contains(&"enclosures".to_string()));
        assert!(tables.contains(&"tags".to_string()));
        assert!(tables.contains(&"users".to_string()));
        assert!(tables.contains(&"sync_state".to_string()));
        assert!(tables.contains(&"sync_queue".to_string()));
        assert!(tables.contains(&"podcast_progress".to_string()));
    }
}
