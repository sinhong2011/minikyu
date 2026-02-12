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

/// Deserialize Option<i64> from string, number, null, or missing field.
pub fn deserialize_option_i64_from_string_or_number<'de, D>(
    deserializer: D,
) -> Result<Option<i64>, D::Error>
where
    D: Deserializer<'de>,
{
    #[derive(Deserialize)]
    #[serde(untagged)]
    enum OptionalStringOrNumber {
        String(String),
        Number(i64),
    }

    match Option::<OptionalStringOrNumber>::deserialize(deserializer)? {
        Some(OptionalStringOrNumber::String(s)) => {
            s.parse().map(Some).map_err(serde::de::Error::custom)
        }
        Some(OptionalStringOrNumber::Number(n)) => Ok(Some(n)),
        None => Ok(None),
    }
}

#[cfg(test)]
mod tests {
    use super::{
        deserialize_i64_from_string_or_number, deserialize_option_i64_from_string_or_number,
    };
    use serde::Deserialize;

    #[derive(Debug, Deserialize)]
    struct NumberWrapper {
        #[serde(deserialize_with = "deserialize_i64_from_string_or_number")]
        value: i64,
    }

    #[derive(Debug, Deserialize)]
    struct OptionalNumberWrapper {
        #[serde(
            default,
            deserialize_with = "deserialize_option_i64_from_string_or_number"
        )]
        value: Option<i64>,
    }

    #[test]
    fn deserialize_i64_accepts_string_and_number() {
        let string_value: NumberWrapper = serde_json::from_str(r#"{"value":"123"}"#).unwrap();
        let number_value: NumberWrapper = serde_json::from_str(r#"{"value":123}"#).unwrap();

        assert_eq!(string_value.value, 123);
        assert_eq!(number_value.value, 123);
    }

    #[test]
    fn deserialize_option_i64_accepts_string_number_null_and_missing() {
        let string_value: OptionalNumberWrapper =
            serde_json::from_str(r#"{"value":"456"}"#).unwrap();
        let number_value: OptionalNumberWrapper = serde_json::from_str(r#"{"value":456}"#).unwrap();
        let null_value: OptionalNumberWrapper = serde_json::from_str(r#"{"value":null}"#).unwrap();
        let missing_value: OptionalNumberWrapper = serde_json::from_str(r#"{}"#).unwrap();

        assert_eq!(string_value.value, Some(456));
        assert_eq!(number_value.value, Some(456));
        assert_eq!(null_value.value, None);
        assert_eq!(missing_value.value, None);
    }
}
