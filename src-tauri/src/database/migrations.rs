use chrono::Utc;
use sqlx::sqlite::SqlitePool;

pub async fn run_migrations(pool: &SqlitePool) -> Result<(), sqlx::Error> {
    create_schema_versions_table(pool).await?;

    let applied_migrations = get_applied_migrations(pool).await?;

    if !applied_migrations.contains(&1) {
        apply_initial_schema(pool).await?;
        record_migration(pool, 1, "initial_schema").await?;
    }

    if !applied_migrations.contains(&2) {
        apply_v2_schema(pool).await?;
        record_migration(pool, 2, "add_downloads_table").await?;
    }

    Ok(())
}

// ... existing code ...

pub(crate) async fn apply_v2_schema(pool: &SqlitePool) -> Result<(), sqlx::Error> {
    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS downloads (
            id INTEGER PRIMARY KEY,
            url TEXT NOT NULL,
            file_name TEXT NOT NULL,
            status TEXT NOT NULL,
            progress INTEGER DEFAULT 0,
            downloaded_bytes INTEGER DEFAULT 0,
            total_bytes INTEGER DEFAULT 0,
            file_path TEXT,
            error TEXT,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        )
        "#,
    )
    .execute(pool)
    .await?;

    sqlx::query("CREATE INDEX IF NOT EXISTS idx_downloads_status ON downloads(status)")
        .execute(pool)
        .await?;

    sqlx::query("CREATE INDEX IF NOT EXISTS idx_downloads_url ON downloads(url)")
        .execute(pool)
        .await?;

    log::info!("V2 schema migration applied (add_downloads_table)");

    Ok(())
}

pub(crate) async fn create_schema_versions_table(pool: &SqlitePool) -> Result<(), sqlx::Error> {
    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS schema_versions (
            version INTEGER PRIMARY KEY,
            migration_name TEXT UNIQUE NOT NULL,
            applied_at TEXT NOT NULL
        )
        "#,
    )
    .execute(pool)
    .await?;

    Ok(())
}

async fn get_applied_migrations(pool: &SqlitePool) -> Result<Vec<i32>, sqlx::Error> {
    let versions: Vec<i32> =
        sqlx::query_scalar("SELECT version FROM schema_versions ORDER BY version")
            .fetch_all(pool)
            .await?;

    Ok(versions)
}

async fn record_migration(
    pool: &SqlitePool,
    version: i32,
    migration_name: &str,
) -> Result<(), sqlx::Error> {
    let applied_at = Utc::now().to_rfc3339();

    sqlx::query(
        r#"
        INSERT INTO schema_versions (version, migration_name, applied_at)
        VALUES (?, ?, ?)
        ON CONFLICT(version) DO NOTHING
        "#,
    )
    .bind(version)
    .bind(migration_name)
    .bind(applied_at)
    .execute(pool)
    .await?;

    Ok(())
}

pub(crate) async fn apply_initial_schema(pool: &SqlitePool) -> Result<(), sqlx::Error> {
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

    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY,
            username TEXT NOT NULL,
            server_url TEXT DEFAULT '',
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
            updated_at TEXT NOT NULL,
            UNIQUE(server_url, username)
        )
        "#,
    )
    .execute(pool)
    .await?;

    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS miniflux_accounts (
            id INTEGER PRIMARY KEY,
            username TEXT NOT NULL,
            server_url TEXT NOT NULL,
            auth_method TEXT NOT NULL,
            is_active BOOLEAN DEFAULT FALSE,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        )
        "#,
    )
    .execute(pool)
    .await?;

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

    log::info!("Initial schema migration applied (version 1)");

    Ok(())
}

#[cfg(test)]
#[path = "migrations.test.rs"]
mod tests;
