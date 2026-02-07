use crate::utils::serde_helpers::{deserialize_i64_from_string_or_number, serialize_i64_as_string};
use serde::{Deserialize, Serialize};
use specta::Type;

/// Miniflux Category
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub struct Category {
    #[serde(
        serialize_with = "serialize_i64_as_string",
        deserialize_with = "deserialize_i64_from_string_or_number"
    )]
    #[specta(type = String)]
    pub id: i64,
    #[serde(
        serialize_with = "serialize_i64_as_string",
        deserialize_with = "deserialize_i64_from_string_or_number"
    )]
    #[specta(type = String)]
    pub user_id: i64,
    pub title: String,
    #[serde(default)]
    pub hide_globally: bool,
    #[serde(default)]
    pub created_at: Option<String>,
    #[serde(default)]
    pub updated_at: Option<String>,
}

/// Miniflux Feed
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub struct Feed {
    #[serde(
        serialize_with = "serialize_i64_as_string",
        deserialize_with = "deserialize_i64_from_string_or_number"
    )]
    #[specta(type = String)]
    pub id: i64,
    #[serde(
        serialize_with = "serialize_i64_as_string",
        deserialize_with = "deserialize_i64_from_string_or_number"
    )]
    #[specta(type = String)]
    pub user_id: i64,
    pub title: String,
    pub site_url: String,
    pub feed_url: String,
    pub category: Option<Category>,
    pub icon: Option<FeedIcon>,
    #[serde(default)]
    pub checked_at: Option<String>,
    #[serde(default)]
    pub etag_header: Option<String>,
    #[serde(default)]
    pub last_modified_header: Option<String>,
    #[serde(default)]
    pub parsing_error_message: Option<String>,
    #[serde(default)]
    pub parsing_error_count: i32,
    #[serde(default)]
    pub scraper_rules: Option<String>,
    #[serde(default)]
    pub rewrite_rules: Option<String>,
    #[serde(default)]
    pub crawler: bool,
    #[serde(default)]
    pub blocklist_rules: Option<String>,
    #[serde(default)]
    pub keeplist_rules: Option<String>,
    #[serde(default)]
    pub user_agent: Option<String>,
    #[serde(default)]
    pub username: Option<String>,
    #[serde(default)]
    pub password: Option<String>,
    #[serde(default)]
    pub disabled: bool,
    #[serde(default)]
    pub ignore_http_cache: bool,
    #[serde(default)]
    pub fetch_via_proxy: bool,
    #[serde(default)]
    pub no_media_player: bool,
    #[serde(default)]
    pub allow_self_signed_certificates: bool,
    #[serde(default)]
    pub urlrewrite_rules: Option<String>,
    #[serde(default)]
    pub cookie: Option<String>,
    #[serde(default)]
    pub apprise_service_urls: Option<String>,
    #[serde(default)]
    pub hide_globally: bool,
    #[serde(default)]
    pub created_at: Option<String>,
    #[serde(default)]
    pub updated_at: Option<String>,
}

/// Feed Icon
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub struct FeedIcon {
    #[serde(
        serialize_with = "serialize_i64_as_string",
        deserialize_with = "deserialize_i64_from_string_or_number"
    )]
    #[specta(type = String)]
    pub feed_id: i64,
    #[serde(
        serialize_with = "serialize_i64_as_string",
        deserialize_with = "deserialize_i64_from_string_or_number"
    )]
    #[specta(type = String)]
    pub icon_id: i64,
}

/// Icon Data
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub struct Icon {
    #[serde(
        serialize_with = "serialize_i64_as_string",
        deserialize_with = "deserialize_i64_from_string_or_number"
    )]
    #[specta(type = String)]
    pub id: i64,
    pub data: String, // Base64 encoded
    pub mime_type: String,
}

/// Miniflux Entry
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub struct Entry {
    #[serde(
        serialize_with = "serialize_i64_as_string",
        deserialize_with = "deserialize_i64_from_string_or_number"
    )]
    #[specta(type = String)]
    pub id: i64,
    #[serde(
        serialize_with = "serialize_i64_as_string",
        deserialize_with = "deserialize_i64_from_string_or_number"
    )]
    #[specta(type = String)]
    pub user_id: i64,
    #[serde(
        serialize_with = "serialize_i64_as_string",
        deserialize_with = "deserialize_i64_from_string_or_number"
    )]
    #[specta(type = String)]
    pub feed_id: i64,
    pub title: String,
    pub url: String,
    #[serde(default)]
    pub comments_url: Option<String>,
    #[serde(default)]
    pub author: Option<String>,
    #[serde(default)]
    pub content: Option<String>,
    pub hash: String,
    pub published_at: String,
    #[serde(default)]
    pub created_at: Option<String>,
    #[serde(default)]
    pub changed_at: Option<String>,
    pub status: String, // "read", "unread", "removed"
    #[serde(default)]
    pub share_code: Option<String>,
    #[serde(default)]
    pub starred: bool,
    #[serde(default)]
    pub reading_time: Option<i32>,
    #[serde(default)]
    pub enclosures: Option<Vec<Enclosure>>,
    pub feed: Feed,
    #[serde(default)]
    pub tags: Option<Vec<String>>,
}

/// Entry Response (with pagination)
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub struct EntryResponse {
    pub total: i64,
    #[serde(default)]
    pub entries: Option<Vec<Entry>>,
}

/// Enclosure (for podcasts/videos)
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub struct Enclosure {
    #[serde(
        serialize_with = "serialize_i64_as_string",
        deserialize_with = "deserialize_i64_from_string_or_number"
    )]
    #[specta(type = String)]
    pub id: i64,
    #[serde(
        serialize_with = "serialize_i64_as_string",
        deserialize_with = "deserialize_i64_from_string_or_number"
    )]
    #[specta(type = String)]
    pub entry_id: i64,
    pub url: String,
    pub mime_type: String,
    #[serde(default)]
    pub length: Option<i64>,
    #[serde(default)]
    pub position: i32,
}

/// User
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub struct User {
    #[serde(
        serialize_with = "serialize_i64_as_string",
        deserialize_with = "deserialize_i64_from_string_or_number"
    )]
    #[specta(type = String)]
    pub id: i64,
    pub username: String,
    #[serde(default)]
    pub is_admin: bool,
    #[serde(default)]
    pub theme: Option<String>,
    #[serde(default)]
    pub language: Option<String>,
    #[serde(default)]
    pub timezone: Option<String>,
    #[serde(default)]
    pub entry_sorting_direction: Option<String>,
    #[serde(default)]
    pub entry_sorting_order: Option<String>,
    #[serde(default)]
    pub entries_per_page: Option<i32>,
    #[serde(default)]
    pub keyboard_shortcuts: Option<bool>,
    #[serde(default)]
    pub display_mode: Option<String>,
    #[serde(default)]
    pub show_reading_time: Option<bool>,
    #[serde(default)]
    pub entry_swipe: Option<bool>,
    #[serde(default)]
    pub stylesheet: Option<String>,
    #[serde(default)]
    pub google_id: Option<String>,
    #[serde(default)]
    pub openid_connect_id: Option<String>,
    #[serde(default)]
    pub last_login_at: Option<String>,
    #[serde(default)]
    pub created_at: Option<String>,
    #[serde(default)]
    pub updated_at: Option<String>,
}

/// Counters
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub struct Counters {
    pub user_id: i64,
    pub read_count: i64,
    pub unread_count: i64,
}

/// Subscription (from discover)
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub struct Subscription {
    pub url: String,
    pub title: String,
    #[serde(rename = "type")]
    pub feed_type: String,
}

/// Entry Filters
#[derive(Debug, Clone, Serialize, Deserialize, Type, Default)]
pub struct EntryFilters {
    #[serde(default)]
    pub status: Option<String>,
    #[serde(default)]
    pub offset: Option<i64>,
    #[serde(default)]
    pub limit: Option<i64>,
    #[serde(default)]
    pub order: Option<String>,
    #[serde(default)]
    pub direction: Option<String>,
    #[serde(default)]
    pub before: Option<i64>,
    #[serde(default)]
    pub after: Option<i64>,
    #[serde(default)]
    pub published_before: Option<i64>,
    #[serde(default)]
    pub published_after: Option<i64>,
    #[serde(default)]
    pub changed_before: Option<i64>,
    #[serde(default)]
    pub changed_after: Option<i64>,
    #[serde(default)]
    pub before_entry_id: Option<i64>,
    #[serde(default)]
    pub after_entry_id: Option<i64>,
    #[serde(default)]
    pub starred: Option<bool>,
    #[serde(default)]
    pub search: Option<String>,
    #[serde(default)]
    pub category_id: Option<i64>,
    #[serde(default)]
    pub feed_id: Option<i64>,
    #[serde(default)]
    pub globally_visible: Option<bool>,
}

/// Feed Update
#[derive(Debug, Clone, Serialize, Deserialize, Type, Default)]
pub struct FeedUpdate {
    #[serde(default)]
    pub feed_url: Option<String>,
    #[serde(default)]
    pub site_url: Option<String>,
    #[serde(default)]
    pub title: Option<String>,
    #[serde(default)]
    pub category_id: Option<i64>,
    #[serde(default)]
    pub scraper_rules: Option<String>,
    #[serde(default)]
    pub rewrite_rules: Option<String>,
    #[serde(default)]
    pub blocklist_rules: Option<String>,
    #[serde(default)]
    pub keeplist_rules: Option<String>,
    #[serde(default)]
    pub crawler: Option<bool>,
    #[serde(default)]
    pub user_agent: Option<String>,
    #[serde(default)]
    pub username: Option<String>,
    #[serde(default)]
    pub password: Option<String>,
    #[serde(default)]
    pub disabled: Option<bool>,
    #[serde(default)]
    pub ignore_http_cache: Option<bool>,
    #[serde(default)]
    pub fetch_via_proxy: Option<bool>,
}

/// Entry Update
#[derive(Debug, Clone, Serialize, Deserialize, Type, Default)]
pub struct EntryUpdate {
    #[serde(default)]
    pub title: Option<String>,
    #[serde(default)]
    pub content: Option<String>,
}

/// User Create
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub struct UserCreate {
    pub username: String,
    pub password: String,
    #[serde(default)]
    pub is_admin: Option<bool>,
}

/// User Update
#[derive(Debug, Clone, Serialize, Deserialize, Type, Default)]
pub struct UserUpdate {
    #[serde(default)]
    pub username: Option<String>,
    #[serde(default)]
    pub password: Option<String>,
    #[serde(default)]
    pub theme: Option<String>,
    #[serde(default)]
    pub language: Option<String>,
    #[serde(default)]
    pub timezone: Option<String>,
    #[serde(default)]
    pub entry_sorting_direction: Option<String>,
    #[serde(default)]
    pub entries_per_page: Option<i32>,
    #[serde(default)]
    pub keyboard_shortcuts: Option<bool>,
    #[serde(default)]
    pub display_mode: Option<String>,
    #[serde(default)]
    pub show_reading_time: Option<bool>,
    #[serde(default)]
    pub entry_swipe: Option<bool>,
    #[serde(default)]
    pub stylesheet: Option<String>,
}

/// Download Progress
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub struct DownloadProgress {
    pub enclosure_id: i64,
    pub file_name: String,
    pub url: String,
    pub progress: i32, // 0-100
    pub downloaded_bytes: i64,
    pub total_bytes: i64,
    pub status: String, // "downloading", "completed", "failed", "cancelled"
    pub file_path: Option<String>,
}

/// Authentication Config
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub struct AuthConfig {
    pub server_url: String,
    #[serde(default)]
    pub auth_token: Option<String>,
    #[serde(default)]
    pub username: Option<String>,
    #[serde(default)]
    pub password: Option<String>,
}
