-- Miniflux Desktop Client Database Schema
-- Version: 1.0
-- Categories
CREATE TABLE IF NOT EXISTS categories (
     id INTEGER PRIMARY KEY,
     user_id INTEGER NOT NULL,
     title TEXT NOT NULL,
     hide_globally BOOLEAN DEFAULT FALSE,
     created_at TEXT NOT NULL,
     updated_at TEXT NOT NULL,
     sync_status TEXT DEFAULT 'synced',
     -- synced, pending, conflict
     UNIQUE(id, user_id)
);

-- Feeds
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
     PASSWORD TEXT,
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
);

-- Icons
CREATE TABLE IF NOT EXISTS icons (
     id INTEGER PRIMARY KEY,
     feed_id INTEGER NOT NULL,
     icon_id INTEGER NOT NULL,
     data TEXT NOT NULL,
     -- Base64 encoded
     mime_type TEXT NOT NULL,
     created_at TEXT NOT NULL,
     FOREIGN KEY (feed_id) REFERENCES feeds(id),
     UNIQUE(feed_id)
);

-- Entries
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
     STATUS TEXT NOT NULL,
     -- read, unread, removed
     share_code TEXT,
     starred BOOLEAN DEFAULT FALSE,
     reading_time INTEGER,
     sync_status TEXT DEFAULT 'synced',
     FOREIGN KEY (feed_id) REFERENCES feeds(id),
     UNIQUE(id, user_id)
);

-- Enclosures (for podcasts/videos)
CREATE TABLE IF NOT EXISTS enclosures (
     id INTEGER PRIMARY KEY,
     entry_id INTEGER NOT NULL,
     url TEXT NOT NULL,
     mime_type TEXT NOT NULL,
     length INTEGER,
     position INTEGER DEFAULT 0,
     media_type TEXT,
     -- audio, video, image
     downloaded BOOLEAN DEFAULT FALSE,
     local_path TEXT,
     download_progress INTEGER DEFAULT 0,
     created_at TEXT NOT NULL,
     FOREIGN KEY (entry_id) REFERENCES entries(id) ON DELETE CASCADE
);

-- Tags
CREATE TABLE IF NOT EXISTS tags (
     id INTEGER PRIMARY KEY,
     entry_id INTEGER NOT NULL,
     tag TEXT NOT NULL,
     created_at TEXT NOT NULL,
     FOREIGN KEY (entry_id) REFERENCES entries(id) ON DELETE CASCADE,
     UNIQUE(entry_id, tag)
);

-- Users (for multi-user support)
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
     -- JSON
     display_mode TEXT DEFAULT 'standalone',
     show_reading_time BOOLEAN DEFAULT TRUE,
     entry_swipe BOOLEAN DEFAULT TRUE,
     custom_css TEXT,
     created_at TEXT NOT NULL,
     updated_at TEXT NOT NULL
);

-- Sync State
CREATE TABLE IF NOT EXISTS sync_state (
     id INTEGER PRIMARY KEY,
     last_sync_at TEXT,
     last_full_sync_at TEXT,
     sync_in_progress BOOLEAN DEFAULT FALSE,
     sync_error TEXT,
     sync_version INTEGER DEFAULT 1
);

-- Sync Queue
CREATE TABLE IF NOT EXISTS sync_queue (
     id INTEGER PRIMARY KEY,
     operation_type TEXT NOT NULL,
     entity_type TEXT NOT NULL,
     entity_id INTEGER NOT NULL,
     payload TEXT NOT NULL,
     -- JSON
     retry_count INTEGER DEFAULT 0,
     STATUS TEXT DEFAULT 'pending',
     -- pending, processing, completed, failed
     error_message TEXT,
     created_at TEXT NOT NULL,
     updated_at TEXT NOT NULL
);

-- Podcast Progress
CREATE TABLE IF NOT EXISTS podcast_progress (
     id INTEGER PRIMARY KEY,
     entry_id INTEGER NOT NULL UNIQUE,
     current_time INTEGER NOT NULL,
     -- seconds
     total_time INTEGER NOT NULL,
     -- seconds
     completed BOOLEAN DEFAULT FALSE,
     last_played_at TEXT NOT NULL,
     FOREIGN KEY (entry_id) REFERENCES entries(id) ON DELETE CASCADE
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_entries_feed_id ON entries(feed_id);

CREATE INDEX IF NOT EXISTS idx_entries_status ON entries(STATUS);

CREATE INDEX IF NOT EXISTS idx_entries_starred ON entries(starred);

CREATE INDEX IF NOT EXISTS idx_entries_published_at ON entries(published_at DESC);

CREATE INDEX IF NOT EXISTS idx_entries_user_status ON entries(user_id, STATUS);

CREATE INDEX IF NOT EXISTS idx_enclosures_entry_id ON enclosures(entry_id);

CREATE INDEX IF NOT EXISTS idx_enclosures_media_type ON enclosures(media_type);

CREATE INDEX IF NOT EXISTS idx_sync_queue_status ON sync_queue(STATUS);

CREATE INDEX IF NOT EXISTS idx_feeds_category_id ON feeds(category_id);

CREATE INDEX IF NOT EXISTS idx_feeds_user_id ON feeds(user_id);

CREATE INDEX IF NOT EXISTS idx_categories_user_id ON categories(user_id);