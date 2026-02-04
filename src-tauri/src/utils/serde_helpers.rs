//! Serde helper functions for consistent serialization patterns.
//!
//! These helpers ensure that Rust types serialize in ways that match
//! TypeScript expectations, particularly for i64 values which need
//! to be serialized as strings to prevent precision loss in JavaScript.

use serde::{Deserialize, Deserializer, Serializer};

/// Serialize i64 as a string for JavaScript compatibility.
///
/// JavaScript's Number type can only safely represent integers up to
/// 2^53 - 1 (Number.MAX_SAFE_INTEGER). Rust i64 can represent up to
/// 2^63 - 1, which would lose precision if sent as a number.
pub fn serialize_i64_as_string<S>(value: &i64, serializer: S) -> Result<S::Ok, S::Error>
where
    S: Serializer,
{
    serializer.serialize_str(&value.to_string())
}

/// Deserialize i64 from either string or number.
///
/// Accepts both formats for flexibility:
/// - `"123"` (string) - from TypeScript
/// - `123` (number) - from JSON files or direct API calls
pub fn deserialize_i64_from_string_or_number<'de, D>(deserializer: D) -> Result<i64, D::Error>
where
    D: Deserializer<'de>,
{
    #[derive(Deserialize)]
    #[serde(untagged)]
    enum StringOrNumber {
        String(String),
        Number(i64),
    }

    match StringOrNumber::deserialize(deserializer)? {
        StringOrNumber::String(s) => s.parse().map_err(serde::de::Error::custom),
        StringOrNumber::Number(n) => Ok(n),
    }
}
