//! Error types for account operations

use serde::{Deserialize, Serialize};
use specta::Type;
use thiserror::Error;

/// Error types for account operations
#[derive(Debug, Error, Serialize, Deserialize, Type)]
#[serde(tag = "type", content = "data")]
pub enum AccountError {
    /// Credentials not found in keyring
    #[error("Credentials not found")]
    NotFound,

    /// Invalid credentials provided
    #[error("Invalid credentials")]
    InvalidCredentials,

    /// Keyring operation failed
    #[error("Keyring error: {message}")]
    KeyringError { message: String },

    /// Database operation failed
    #[error("Database error: {0}")]
    DatabaseError(String),
}

impl From<sqlx::Error> for AccountError {
    fn from(err: sqlx::Error) -> Self {
        AccountError::DatabaseError(err.to_string())
    }
}
