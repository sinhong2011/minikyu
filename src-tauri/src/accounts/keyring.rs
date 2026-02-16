//! Keyring helper functions for secure credential storage

use keyring::Entry;
use log::{debug, error, info};

use super::error::AccountError;

const SERVICE_NAME: &str = "minikyu";

pub fn normalize_server_url(url: &str) -> String {
    url.trim()
        .trim_end_matches('/')
        .to_lowercase()
        .split_whitespace()
        .collect::<Vec<_>>()
        .join("")
}

fn create_keyring_entry(server_url: &str, username: &str, suffix: &str) -> Entry {
    let normalized_url = normalize_server_url(server_url);
    let key = format!("{SERVICE_NAME}:{normalized_url}:{username}:{suffix}");
    Entry::new(SERVICE_NAME, &key).expect("Failed to create keyring entry")
}

pub async fn save_token(server_url: &str, username: &str, token: &str) -> Result<(), AccountError> {
    debug!("Saving token for user '{}' at '{}'", username, server_url);

    let entry = create_keyring_entry(server_url, username, "token");

    entry.set_password(token).map_err(|e| {
        error!(
            "Failed to save token for user '{}' at '{}': {}",
            username, server_url, e
        );
        AccountError::KeyringError {
            message: format!("Failed to save token: {e}"),
        }
    })?;

    info!(
        "Successfully saved token for user '{}' at '{}'",
        username, server_url
    );

    Ok(())
}

pub async fn get_token(server_url: &str, username: &str) -> Result<String, AccountError> {
    debug!(
        "Retrieving token for user '{}' at '{}'",
        username, server_url
    );

    let entry = create_keyring_entry(server_url, username, "token");

    entry.get_password().map_err(|e| match e {
        keyring::Error::NoEntry => {
            debug!("No token found for user '{}' at '{}'", username, server_url);
            AccountError::NotFound
        }
        _ => {
            error!(
                "Failed to retrieve token for user '{}' at '{}': {}",
                username, server_url, e
            );
            AccountError::KeyringError {
                message: format!("Failed to retrieve token: {e}"),
            }
        }
    })
}

pub async fn save_password(
    server_url: &str,
    username: &str,
    password: &str,
) -> Result<(), AccountError> {
    debug!(
        "Saving password for user '{}' at '{}'",
        username, server_url
    );

    let entry = create_keyring_entry(server_url, username, "password");

    entry.set_password(password).map_err(|e| {
        error!(
            "Failed to save password for user '{}' at '{}': {}",
            username, server_url, e
        );
        AccountError::KeyringError {
            message: format!("Failed to save password: {e}"),
        }
    })?;

    info!(
        "Successfully saved password for user '{}' at '{}'",
        username, server_url
    );

    Ok(())
}

pub async fn get_password(server_url: &str, username: &str) -> Result<String, AccountError> {
    debug!(
        "Retrieving password for user '{}' at '{}'",
        username, server_url
    );

    let entry = create_keyring_entry(server_url, username, "password");

    entry.get_password().map_err(|e| match e {
        keyring::Error::NoEntry => {
            debug!(
                "No password found for user '{}' at '{}'",
                username, server_url
            );
            AccountError::NotFound
        }
        _ => {
            error!(
                "Failed to retrieve password for user '{}' at '{}': {}",
                username, server_url, e
            );
            AccountError::KeyringError {
                message: format!("Failed to retrieve password: {e}"),
            }
        }
    })
}

pub async fn delete_credentials(server_url: &str, username: &str) -> Result<(), AccountError> {
    info!(
        "Deleting credentials for user '{}' at '{}'",
        username, server_url
    );

    let token_entry = create_keyring_entry(server_url, username, "token");
    let password_entry = create_keyring_entry(server_url, username, "password");

    let token_result = token_entry.delete_credential();
    let password_result = password_entry.delete_credential();

    match (token_result, password_result) {
        (Err(keyring::Error::NoEntry), Err(keyring::Error::NoEntry)) => {
            debug!(
                "No credentials found to delete for user '{}' at '{}'",
                username, server_url
            );
            Err(AccountError::NotFound)
        }
        (Err(e), _) | (_, Err(e)) if !matches!(e, keyring::Error::NoEntry) => {
            error!(
                "Failed to delete credentials for user '{}' at '{}': {}",
                username, server_url, e
            );
            Err(AccountError::KeyringError {
                message: format!("Failed to delete credentials: {e}"),
            })
        }
        _ => {
            info!(
                "Successfully deleted credentials for user '{}' at '{}'",
                username, server_url
            );
            Ok(())
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Check if running in CI environment without keyring support
    fn should_skip_keyring_tests() -> bool {
        // CI environment typically doesn't have a keyring service available
        std::env::var("CI").is_ok()
    }

    #[test]
    fn test_normalize_server_url_lowercase() {
        assert_eq!(
            normalize_server_url("HTTPS://EXAMPLE.COM"),
            "https://example.com"
        );
    }

    #[test]
    fn test_normalize_server_url_trailing_slash() {
        assert_eq!(
            normalize_server_url("https://example.com/"),
            "https://example.com"
        );
    }

    #[test]
    fn test_normalize_server_url_whitespace() {
        assert_eq!(
            normalize_server_url("  https://example.com  "),
            "https://example.com"
        );
    }

    #[test]
    fn test_normalize_server_url_internal_whitespace() {
        assert_eq!(
            normalize_server_url("https://example. com"),
            "https://example.com"
        );
    }

    #[test]
    fn test_normalize_server_url_combined() {
        assert_eq!(
            normalize_server_url("  HTTPS://EXAMPLE.COM/  "),
            "https://example.com"
        );
    }

    #[tokio::test]
    async fn test_save_and_get_token() {
        if should_skip_keyring_tests() {
            println!("Skipping test_save_and_get_token: CI environment without keyring");
            return;
        }

        let server_url = "https://test.example.com";
        let username = "test_user_token";
        let token = "test_token_12345";

        let save_result = save_token(server_url, username, token).await;
        assert!(save_result.is_ok());

        let get_result = get_token(server_url, username).await;
        assert!(get_result.is_ok());
        assert_eq!(get_result.unwrap(), token);

        let _ = delete_credentials(server_url, username).await;
    }

    #[tokio::test]
    async fn test_save_and_get_password() {
        if should_skip_keyring_tests() {
            println!("Skipping test_save_and_get_password: CI environment without keyring");
            return;
        }

        let server_url = "https://test.example.com";
        let username = "test_user_password";
        let password = "test_password_12345";

        let save_result = save_password(server_url, username, password).await;
        assert!(save_result.is_ok());

        let get_result = get_password(server_url, username).await;
        assert!(get_result.is_ok());
        assert_eq!(get_result.unwrap(), password);

        let _ = delete_credentials(server_url, username).await;
    }

    #[tokio::test]
    async fn test_delete_credentials() {
        if should_skip_keyring_tests() {
            println!("Skipping test_delete_credentials: CI environment without keyring");
            return;
        }

        let server_url = "https://test.example.com";
        let username = "test_user_delete";
        let token = "test_token";
        let password = "test_password";

        let _ = save_token(server_url, username, token).await;
        let _ = save_password(server_url, username, password).await;

        let delete_result = delete_credentials(server_url, username).await;
        assert!(delete_result.is_ok());

        let get_token_result = get_token(server_url, username).await;
        assert!(matches!(get_token_result, Err(AccountError::NotFound)));

        let get_password_result = get_password(server_url, username).await;
        assert!(matches!(get_password_result, Err(AccountError::NotFound)));
    }

    #[tokio::test]
    async fn test_get_token_not_found() {
        if should_skip_keyring_tests() {
            println!("Skipping test_get_token_not_found: CI environment without keyring");
            return;
        }

        let server_url = "https://test.example.com";
        let username = "nonexistent_user_token";

        let result = get_token(server_url, username).await;
        assert!(matches!(result, Err(AccountError::NotFound)));
    }

    #[tokio::test]
    async fn test_get_password_not_found() {
        if should_skip_keyring_tests() {
            println!("Skipping test_get_password_not_found: CI environment without keyring");
            return;
        }

        let server_url = "https://test.example.com";
        let username = "nonexistent_user_password";

        let result = get_password(server_url, username).await;
        assert!(matches!(result, Err(AccountError::NotFound)));
    }

    #[tokio::test]
    async fn test_delete_credentials_not_found() {
        if should_skip_keyring_tests() {
            println!("Skipping test_delete_credentials_not_found: CI environment without keyring");
            return;
        }

        let server_url = "https://test.example.com";
        let username = "nonexistent_user_delete";

        let result = delete_credentials(server_url, username).await;
        assert!(matches!(result, Err(AccountError::NotFound)));
    }
}
