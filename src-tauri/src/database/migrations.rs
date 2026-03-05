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
        apply_composite_index_migration(pool).await?;
        record_migration(pool, 2, "add_composite_index").await?;
    }

    if !applied_migrations.contains(&3) {
        apply_entries_sort_index_migration(pool).await?;
        record_migration(pool, 3, "add_entries_status_published_at_index").await?;
    }

    if !applied_migrations.contains(&4) {
        apply_podcast_settings_migration(pool).await?;
        record_migration(pool, 4, "podcast_feed_settings_and_duration").await?;
    }

    if !applied_migrations.contains(&5) {
        apply_local_cache_migration(pool).await?;
        record_migration(pool, 5, "article_summaries_and_translation_cache").await?;
    }

    if !applied_migrations.contains(&6) {
        apply_per_account_sync_state_migration(pool).await?;
        record_migration(pool, 6, "per_account_sync_state").await?;
    }

    if !applied_migrations.contains(&7) {
        apply_sync_state_stats_migration(pool).await?;
        record_migration(pool, 7, "sync_state_completion_stats").await?;
    }

    if !applied_migrations.contains(&8) {
        apply_downloads_media_type_migration(pool).await?;
        record_migration(pool, 8, "downloads_media_type").await?;
    }

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

pub(crate) async fn apply_composite_index_migration(pool: &SqlitePool) -> Result<(), sqlx::Error> {
    sqlx::query("CREATE INDEX IF NOT EXISTS idx_entries_feed_status ON entries(feed_id, status)")
        .execute(pool)
        .await?;

    log::info!("Composite index migration applied (version 2)");

    Ok(())
}

pub(crate) async fn apply_entries_sort_index_migration(
    pool: &SqlitePool,
) -> Result<(), sqlx::Error> {
    sqlx::query(
        "CREATE INDEX IF NOT EXISTS idx_entries_status_published_at ON entries(status, published_at DESC)",
    )
    .execute(pool)
    .await?;

    log::info!("Entries sort index migration applied (version 3)");

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
        CREATE TABLE IF NOT EXISTS miniflux_connections (
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

    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS sync_state (
            id INTEGER PRIMARY KEY,
            last_sync_at TEXT,
            last_full_sync_at TEXT,
            sync_in_progress BOOLEAN DEFAULT FALSE,
            sync_error TEXT,
            sync_version INTEGER DEFAULT 1,
            entries_offset INTEGER DEFAULT 0,
            entries_pulled INTEGER DEFAULT 0,
            entries_total INTEGER DEFAULT 0
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
            "current_time" INTEGER NOT NULL,
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

pub(crate) async fn apply_podcast_settings_migration(pool: &SqlitePool) -> Result<(), sqlx::Error> {
    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS podcast_feed_settings (
            feed_id INTEGER PRIMARY KEY,
            auto_download_count INTEGER DEFAULT 3,
            playback_speed REAL DEFAULT 1.0,
            auto_cleanup_days INTEGER DEFAULT 7,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        )
        "#,
    )
    .execute(pool)
    .await?;

    sqlx::query("ALTER TABLE enclosures ADD COLUMN duration_seconds INTEGER")
        .execute(pool)
        .await
        .ok(); // OK if column already exists

    log::info!("Podcast settings migration applied (version 4)");
    Ok(())
}

pub(crate) async fn apply_local_cache_migration(pool: &SqlitePool) -> Result<(), sqlx::Error> {
    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS article_summaries (
            entry_id TEXT NOT NULL PRIMARY KEY,
            summary TEXT NOT NULL,
            provider_used TEXT,
            model_used TEXT,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        )
        "#,
    )
    .execute(pool)
    .await?;

    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS translation_cache (
            cache_key TEXT NOT NULL PRIMARY KEY,
            translated_text TEXT NOT NULL,
            provider_used TEXT NOT NULL,
            cached_at INTEGER NOT NULL
        )
        "#,
    )
    .execute(pool)
    .await?;

    sqlx::query(
        "CREATE INDEX IF NOT EXISTS idx_translation_cache_cached_at ON translation_cache(cached_at)",
    )
    .execute(pool)
    .await?;

    log::info!("Local cache migration applied (version 5)");
    Ok(())
}

pub(crate) async fn apply_per_account_sync_state_migration(
    pool: &SqlitePool,
) -> Result<(), sqlx::Error> {
    // Add account_id column (nullable for existing rows)
    sqlx::query("ALTER TABLE sync_state ADD COLUMN account_id INTEGER")
        .execute(pool)
        .await
        .ok(); // OK if column already exists

    // Assign existing sync_state row to the active account
    sqlx::query(
        r#"
        UPDATE sync_state
        SET account_id = (SELECT id FROM miniflux_connections WHERE is_active = 1 LIMIT 1)
        WHERE account_id IS NULL
        "#,
    )
    .execute(pool)
    .await?;

    // Add completion stats columns
    sqlx::query("ALTER TABLE sync_state ADD COLUMN categories_synced INTEGER DEFAULT 0")
        .execute(pool)
        .await
        .ok();
    sqlx::query("ALTER TABLE sync_state ADD COLUMN feeds_synced INTEGER DEFAULT 0")
        .execute(pool)
        .await
        .ok();
    sqlx::query("ALTER TABLE sync_state ADD COLUMN entries_synced INTEGER DEFAULT 0")
        .execute(pool)
        .await
        .ok();

    // Create unique index so each account has at most one sync_state row
    sqlx::query(
        "CREATE UNIQUE INDEX IF NOT EXISTS idx_sync_state_account_id ON sync_state(account_id)",
    )
    .execute(pool)
    .await?;

    log::info!("Per-account sync state migration applied (version 6)");
    Ok(())
}

/// Ensures sync_state has completion stats columns.
/// Needed for DBs that ran migration 6 before stats columns were added.
pub(crate) async fn apply_sync_state_stats_migration(
    pool: &SqlitePool,
) -> Result<(), sqlx::Error> {
    sqlx::query("ALTER TABLE sync_state ADD COLUMN categories_synced INTEGER DEFAULT 0")
        .execute(pool)
        .await
        .ok(); // OK if column already exists
    sqlx::query("ALTER TABLE sync_state ADD COLUMN feeds_synced INTEGER DEFAULT 0")
        .execute(pool)
        .await
        .ok();
    sqlx::query("ALTER TABLE sync_state ADD COLUMN entries_synced INTEGER DEFAULT 0")
        .execute(pool)
        .await
        .ok();

    log::info!("Sync state stats migration applied (version 7)");
    Ok(())
}

pub(crate) async fn apply_downloads_media_type_migration(
    pool: &SqlitePool,
) -> Result<(), sqlx::Error> {
    sqlx::query("ALTER TABLE downloads ADD COLUMN media_type TEXT")
        .execute(pool)
        .await
        .ok(); // OK if column already exists

    log::info!("Downloads media_type migration applied (version 8)");
    Ok(())
}

#[cfg(test)]
#[path = "migrations.test.rs"]
mod tests;
