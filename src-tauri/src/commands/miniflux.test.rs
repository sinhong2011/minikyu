#[cfg(test)]
mod tests {
    use crate::database::migrations::run_migrations;
    use crate::miniflux::EntryFilters;
    use chrono::{Duration, Utc};
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

    async fn insert_category(pool: &SqlitePool, id: i64, title: &str, now: &str) {
        sqlx::query(
            r#"
            INSERT INTO categories (id, user_id, title, hide_globally, created_at, updated_at)
            VALUES (?, 1, ?, false, ?, ?)
            "#,
        )
        .bind(id)
        .bind(title)
        .bind(now)
        .bind(now)
        .execute(pool)
        .await
        .expect("Failed to insert category");
    }

    async fn insert_feed(
        pool: &SqlitePool,
        id: i64,
        title: &str,
        site_url: &str,
        feed_url: &str,
        category_id: i64,
        now: &str,
    ) {
        sqlx::query(
            r#"
            INSERT INTO feeds (id, user_id, title, site_url, feed_url, category_id, created_at, updated_at)
            VALUES (?, 1, ?, ?, ?, ?, ?, ?)
            "#,
        )
        .bind(id)
        .bind(title)
        .bind(site_url)
        .bind(feed_url)
        .bind(category_id)
        .bind(now)
        .bind(now)
        .execute(pool)
        .await
        .expect("Failed to insert feed");
    }

    async fn insert_entry(
        pool: &SqlitePool,
        id: i64,
        feed_id: i64,
        title: &str,
        status: &str,
        starred: bool,
        published_at: &str,
        content: Option<&str>,
    ) {
        sqlx::query(
            r#"
            INSERT INTO entries (id, user_id, feed_id, title, url, hash, published_at, created_at, status, starred, content)
            VALUES (?, 1, ?, ?, 'https://example.com/article', ?, ?, ?, ?, ?, ?)
            "#,
        )
        .bind(id)
        .bind(feed_id)
        .bind(title)
        .bind(format!("hash-{id}"))
        .bind(published_at)
        .bind(published_at)
        .bind(status)
        .bind(starred)
        .bind(content)
        .execute(pool)
        .await
        .expect("Failed to insert entry");
    }

    // ==================== get_categories tests ====================

    #[tokio::test]
    async fn test_get_categories_empty_db() {
        let pool = setup_test_db().await;

        let categories = super::super::get_categories_from_db(&pool)
            .await
            .expect("get_categories_from_db should not error");

        assert!(categories.is_empty(), "Empty DB should return empty vec");
    }

    #[tokio::test]
    async fn test_get_categories_with_seeded_data() {
        let pool = setup_test_db().await;
        let now = Utc::now().to_rfc3339();

        insert_category(&pool, 1, "Technology", &now).await;

        let categories = super::super::get_categories_from_db(&pool)
            .await
            .expect("get_categories_from_db should not error");

        assert_eq!(categories.len(), 1, "Should return 1 category");
        assert_eq!(categories[0].id, 1);
        assert_eq!(categories[0].user_id, 1);
        assert_eq!(categories[0].title, "Technology");
        assert!(!categories[0].hide_globally);
    }

    // ==================== get_feeds tests ====================

    #[tokio::test]
    async fn test_get_feeds_empty_db() {
        let pool = setup_test_db().await;

        let feeds = super::super::get_feeds_from_db(&pool)
            .await
            .expect("get_feeds_from_db should not error");

        assert!(feeds.is_empty(), "Empty DB should return empty vec");
    }

    #[tokio::test]
    async fn test_get_feeds_with_seeded_data() {
        let pool = setup_test_db().await;
        let now = Utc::now().to_rfc3339();

        insert_category(&pool, 1, "Technology", &now).await;
        insert_feed(
            &pool,
            1,
            "Tech News",
            "https://tech.example.com",
            "https://tech.example.com/rss",
            1,
            &now,
        )
        .await;

        let feeds = super::super::get_feeds_from_db(&pool)
            .await
            .expect("get_feeds_from_db should not error");

        assert_eq!(feeds.len(), 1, "Should return 1 feed");
        assert_eq!(feeds[0].id, 1);
        assert_eq!(feeds[0].user_id, 1);
        assert_eq!(feeds[0].title, "Tech News");
        assert_eq!(feeds[0].site_url, "https://tech.example.com");
        assert_eq!(feeds[0].feed_url, "https://tech.example.com/rss");
        // Category should be populated
        assert!(feeds[0].category.is_some());
        let cat = feeds[0].category.as_ref().unwrap();
        assert_eq!(cat.id, 1);
        assert_eq!(cat.title, "Technology");
    }

    // ==================== get_category_feeds tests ====================

    #[tokio::test]
    async fn test_get_category_feeds_empty_db() {
        let pool = setup_test_db().await;

        let feeds = super::super::get_category_feeds_from_db(&pool, 1)
            .await
            .expect("get_category_feeds_from_db should not error");

        assert!(feeds.is_empty(), "Empty DB should return empty vec");
    }

    #[tokio::test]
    async fn test_get_category_feeds_with_seeded_data() {
        let pool = setup_test_db().await;
        let now = Utc::now().to_rfc3339();

        insert_category(&pool, 1, "Technology", &now).await;
        insert_category(&pool, 2, "Science", &now).await;
        insert_feed(
            &pool,
            1,
            "Tech News",
            "https://tech.example.com",
            "https://tech.example.com/rss",
            1,
            &now,
        )
        .await;
        insert_feed(
            &pool,
            2,
            "Science Daily",
            "https://science.example.com",
            "https://science.example.com/rss",
            2,
            &now,
        )
        .await;

        // Get feeds for category 1
        let feeds = super::super::get_category_feeds_from_db(&pool, 1)
            .await
            .expect("get_category_feeds_from_db should not error");

        assert_eq!(feeds.len(), 1, "Should return 1 feed for category 1");
        assert_eq!(feeds[0].id, 1);
        assert_eq!(feeds[0].title, "Tech News");
    }

    // ==================== get_entries tests ====================

    #[tokio::test]
    async fn test_get_entries_empty_db() {
        let pool = setup_test_db().await;
        let filters = EntryFilters::default();

        let response = super::super::get_entries_from_db(&pool, &filters)
            .await
            .expect("get_entries_from_db should not error");

        assert_eq!(response.total, 0, "Empty DB should have 0 total");
        assert!(
            response.entries.is_none() || response.entries.as_ref().unwrap().is_empty(),
            "Empty DB should return no entries"
        );
    }

    #[tokio::test]
    async fn test_get_entries_with_seeded_data() {
        let pool = setup_test_db().await;
        let now = Utc::now().to_rfc3339();

        insert_category(&pool, 1, "Technology", &now).await;
        insert_feed(
            &pool,
            1,
            "Tech News",
            "https://tech.example.com",
            "https://tech.example.com/rss",
            1,
            &now,
        )
        .await;
        insert_entry(
            &pool,
            1,
            1,
            "Test Article",
            "unread",
            false,
            &now,
            None,
        )
        .await;

        let filters = EntryFilters::default();
        let response = super::super::get_entries_from_db(&pool, &filters)
            .await
            .expect("get_entries_from_db should not error");

        assert_eq!(response.total, 1, "Should have 1 total entry");
        let entries = response.entries.expect("Should have entries");
        assert_eq!(entries.len(), 1, "Should return 1 entry");
        assert_eq!(entries[0].id, 1);
        assert_eq!(entries[0].title, "Test Article");
        assert_eq!(entries[0].status, "unread");
        // Entry should have feed populated
        assert_eq!(entries[0].feed.id, 1);
        assert_eq!(entries[0].feed.title, "Tech News");
    }

    // ==================== get_entry tests ====================

    #[tokio::test]
    async fn test_get_entry_not_found() {
        let pool = setup_test_db().await;

        let result = super::super::get_entry_from_db(&pool, 999).await;

        assert!(result.is_err(), "Should error when entry not found");
    }

    #[tokio::test]
    async fn test_get_entry_with_seeded_data() {
        let pool = setup_test_db().await;
        let now = Utc::now().to_rfc3339();

        insert_category(&pool, 1, "Technology", &now).await;
        insert_feed(
            &pool,
            1,
            "Tech News",
            "https://tech.example.com",
            "https://tech.example.com/rss",
            1,
            &now,
        )
        .await;
        insert_entry(
            &pool,
            1,
            1,
            "Test Article",
            "unread",
            true,
            &now,
            Some("Article content here"),
        )
        .await;

        let entry = super::super::get_entry_from_db(&pool, 1)
            .await
            .expect("get_entry_from_db should not error");

        assert_eq!(entry.id, 1);
        assert_eq!(entry.title, "Test Article");
        assert_eq!(entry.status, "unread");
        assert!(entry.starred);
        assert_eq!(entry.content, Some("Article content here".to_string()));
        // Entry should have feed populated
        assert_eq!(entry.feed.id, 1);
        assert_eq!(entry.feed.title, "Tech News");
    }

    #[tokio::test]
    async fn test_get_entries_filters_by_status() {
        let pool = setup_test_db().await;
        let now = Utc::now().to_rfc3339();

        insert_category(&pool, 1, "Technology", &now).await;
        insert_feed(
            &pool,
            1,
            "Tech News",
            "https://tech.example.com",
            "https://tech.example.com/rss",
            1,
            &now,
        )
        .await;
        insert_entry(&pool, 1, 1, "Unread", "unread", false, &now, None).await;
        insert_entry(&pool, 2, 1, "Read", "read", false, &now, None).await;

        let filters = EntryFilters {
            status: Some("unread".to_string()),
            ..EntryFilters::default()
        };

        let response = super::super::get_entries_from_db(&pool, &filters)
            .await
            .expect("get_entries_from_db should not error");

        let entries = response.entries.expect("Should have entries");
        assert_eq!(entries.len(), 1);
        assert_eq!(entries[0].title, "Unread");
    }

    #[tokio::test]
    async fn test_get_entries_filters_by_starred() {
        let pool = setup_test_db().await;
        let now = Utc::now().to_rfc3339();

        insert_category(&pool, 1, "Technology", &now).await;
        insert_feed(
            &pool,
            1,
            "Tech News",
            "https://tech.example.com",
            "https://tech.example.com/rss",
            1,
            &now,
        )
        .await;
        insert_entry(&pool, 1, 1, "Starred", "unread", true, &now, None).await;
        insert_entry(&pool, 2, 1, "Not Starred", "unread", false, &now, None).await;

        let filters = EntryFilters {
            starred: Some(true),
            ..EntryFilters::default()
        };

        let response = super::super::get_entries_from_db(&pool, &filters)
            .await
            .expect("get_entries_from_db should not error");

        let entries = response.entries.expect("Should have entries");
        assert_eq!(entries.len(), 1);
        assert_eq!(entries[0].title, "Starred");
    }

    #[tokio::test]
    async fn test_get_entries_filters_by_category() {
        let pool = setup_test_db().await;
        let now = Utc::now().to_rfc3339();

        insert_category(&pool, 1, "Technology", &now).await;
        insert_category(&pool, 2, "Science", &now).await;
        insert_feed(
            &pool,
            1,
            "Tech News",
            "https://tech.example.com",
            "https://tech.example.com/rss",
            1,
            &now,
        )
        .await;
        insert_feed(
            &pool,
            2,
            "Science Daily",
            "https://science.example.com",
            "https://science.example.com/rss",
            2,
            &now,
        )
        .await;
        insert_entry(&pool, 1, 1, "Tech Entry", "unread", false, &now, None).await;
        insert_entry(&pool, 2, 2, "Science Entry", "unread", false, &now, None).await;

        let filters = EntryFilters {
            category_id: Some(2),
            ..EntryFilters::default()
        };

        let response = super::super::get_entries_from_db(&pool, &filters)
            .await
            .expect("get_entries_from_db should not error");

        let entries = response.entries.expect("Should have entries");
        assert_eq!(entries.len(), 1);
        assert_eq!(entries[0].title, "Science Entry");
    }

    #[tokio::test]
    async fn test_get_entries_filters_by_search() {
        let pool = setup_test_db().await;
        let now = Utc::now().to_rfc3339();

        insert_category(&pool, 1, "Technology", &now).await;
        insert_feed(
            &pool,
            1,
            "Tech News",
            "https://tech.example.com",
            "https://tech.example.com/rss",
            1,
            &now,
        )
        .await;
        insert_entry(
            &pool,
            1,
            1,
            "Rust Article",
            "unread",
            false,
            &now,
            Some("The Rust language"),
        )
        .await;
        insert_entry(
            &pool,
            2,
            1,
            "Go Article",
            "unread",
            false,
            &now,
            Some("The Go language"),
        )
        .await;

        let filters = EntryFilters {
            search: Some("Rust".to_string()),
            ..EntryFilters::default()
        };

        let response = super::super::get_entries_from_db(&pool, &filters)
            .await
            .expect("get_entries_from_db should not error");

        let entries = response.entries.expect("Should have entries");
        assert_eq!(entries.len(), 1);
        assert_eq!(entries[0].title, "Rust Article");
    }

    #[tokio::test]
    async fn test_get_entries_filters_by_after_timestamp() {
        let pool = setup_test_db().await;
        let now = Utc::now();
        let old_time = (now - Duration::days(2)).to_rfc3339();
        let recent_time = (now - Duration::hours(1)).to_rfc3339();

        insert_category(&pool, 1, "Technology", &recent_time).await;
        insert_feed(
            &pool,
            1,
            "Tech News",
            "https://tech.example.com",
            "https://tech.example.com/rss",
            1,
            &recent_time,
        )
        .await;
        insert_entry(
            &pool,
            1,
            1,
            "Old Entry",
            "unread",
            false,
            &old_time,
            None,
        )
        .await;
        insert_entry(
            &pool,
            2,
            1,
            "Recent Entry",
            "unread",
            false,
            &recent_time,
            None,
        )
        .await;

        let filters = EntryFilters {
            after: Some((now - Duration::hours(12)).timestamp()),
            ..EntryFilters::default()
        };

        let response = super::super::get_entries_from_db(&pool, &filters)
            .await
            .expect("get_entries_from_db should not error");

        let entries = response.entries.expect("Should have entries");
        assert_eq!(entries.len(), 1);
        assert_eq!(entries[0].title, "Recent Entry");
    }
}
