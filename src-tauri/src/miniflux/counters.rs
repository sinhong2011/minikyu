use crate::utils::serde_helpers::{deserialize_i64_from_string_or_number, serialize_i64_as_string};
use serde::{Deserialize, Serialize};
use specta::Type;
use sqlx::FromRow;

/// Per-category unread count
#[derive(Debug, Clone, Serialize, Deserialize, Type, FromRow)]
pub struct CategoryUnread {
    #[serde(
        serialize_with = "serialize_i64_as_string",
        deserialize_with = "deserialize_i64_from_string_or_number"
    )]
    #[specta(type = String)]
    pub category_id: i64,
    pub unread_count: i64,
}

/// Per-feed unread count
#[derive(Debug, Clone, Serialize, Deserialize, Type, FromRow)]
pub struct FeedUnread {
    #[serde(
        serialize_with = "serialize_i64_as_string",
        deserialize_with = "deserialize_i64_from_string_or_number"
    )]
    #[specta(type = String)]
    pub feed_id: i64,
    pub unread_count: i64,
}

/// Enhanced unread counts from local database
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub struct UnreadCounts {
    pub total: i64,
    pub by_category: Vec<CategoryUnread>,
    pub by_feed: Vec<FeedUnread>,
    pub today: i64,
}
