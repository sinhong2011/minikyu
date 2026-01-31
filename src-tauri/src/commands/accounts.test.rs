#[cfg(test)]
mod tests {
    use crate::accounts::error::AccountError;
    use crate::accounts::keyring::{delete_credentials, get_password, get_token};
    use crate::commands::accounts::MinifluxAccount;
    use crate::database::migrations::run_migrations;
    use crate::miniflux::AuthConfig;
    use chrono::Utc;
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

    async fn save_miniflux_account_test(
        pool: &SqlitePool,
        config: AuthConfig,
    ) -> Result<i64, AccountError> {
        let username = config
            .username
            .as_ref()
            .ok_or(AccountError::InvalidCredentials)?
            .trim();

        if username.is_empty() {
            return Err(AccountError::InvalidCredentials);
        }

        let has_token = config
            .auth_token
            .as_ref()
            .map_or(false, |t| !t.trim().is_empty());
        let has_password = config
            .password
            .as_ref()
            .map_or(false, |p| !p.trim().is_empty());

        if !has_token && !has_password {
            return Err(AccountError::InvalidCredentials);
        }

        let auth_method = if has_token { "token" } else { "password" };
        let now = Utc::now().to_rfc3339();

        let existing_account: Option<(i64,)> =
            sqlx::query_as("SELECT id FROM miniflux_accounts WHERE username = ?")
                .bind(username)
                .fetch_optional(pool)
                .await?;

        let account_id = if let Some((id,)) = existing_account {
            sqlx::query(
                r#"
                UPDATE miniflux_accounts
                SET server_url = ?,
                    auth_method = ?,
                    updated_at = ?
                WHERE id = ?
                "#,
            )
            .bind(&config.server_url)
            .bind(auth_method)
            .bind(&now)
            .bind(id)
            .execute(pool)
            .await?;

            id
        } else {
            let result = sqlx::query(
                r#"
                INSERT INTO miniflux_accounts (username, server_url, auth_method, is_active, created_at, updated_at)
                VALUES (?, ?, ?, 0, ?, ?)
                "#,
            )
            .bind(username)
            .bind(&config.server_url)
            .bind(auth_method)
            .bind(&now)
            .bind(&now)
            .execute(pool)
            .await?;

            result.last_insert_rowid()
        };

        sqlx::query("UPDATE miniflux_accounts SET is_active = 0 WHERE username != ?")
            .bind(username)
            .execute(pool)
            .await?;

        sqlx::query("UPDATE miniflux_accounts SET is_active = 1 WHERE username = ?")
            .bind(username)
            .execute(pool)
            .await?;

        if let Some(token) = &config.auth_token {
            if !token.trim().is_empty() {
                use crate::accounts::keyring::save_token;
                save_token(&config.server_url, username, token).await?;
            }
        }

        if let Some(password) = &config.password {
            if !password.trim().is_empty() {
                use crate::accounts::keyring::save_password;
                save_password(&config.server_url, username, password).await?;
            }
        }

        Ok(account_id)
    }

    async fn get_miniflux_accounts_test(
        pool: &SqlitePool,
    ) -> Result<Vec<MinifluxAccount>, AccountError> {
        let accounts: Vec<MinifluxAccount> = sqlx::query_as(
            "SELECT id, username, server_url, auth_method, is_active, created_at, updated_at 
             FROM miniflux_accounts 
             ORDER BY created_at DESC",
        )
        .fetch_all(pool)
        .await
        .map_err(|e| AccountError::DatabaseError(e.to_string()))?;

        Ok(accounts)
    }

    #[tokio::test]
    async fn test_save_new_account_with_token() {
        let pool = setup_test_db().await;

        let config = AuthConfig {
            server_url: "https://miniflux.example.com".to_string(),
            auth_token: Some("test_token_123".to_string()),
            username: Some("testuser".to_string()),
            password: None,
        };

        let result = save_miniflux_account_test(&pool, config.clone()).await;
        assert!(result.is_ok(), "Failed to save account: {:?}", result.err());

        let account_id = result.unwrap();
        assert!(account_id > 0);

        // Verify account is in database
        let row: (i64, String, String, String, i64) = sqlx::query_as(
            "SELECT id, username, server_url, auth_method, is_active FROM miniflux_accounts WHERE id = ?",
        )
        .bind(account_id)
        .fetch_one(&pool)
        .await
        .expect("Failed to fetch account");

        assert_eq!(row.1, "testuser");
        assert_eq!(row.2, "https://miniflux.example.com");
        assert_eq!(row.3, "token");
        assert_eq!(row.4, 1); // is_active = true

        // Verify token is in keyring
        let token_result =
            get_token("https://miniflux.example.com", "testuser").await;
        assert!(token_result.is_ok());
        assert_eq!(token_result.unwrap(), "test_token_123");

        // Cleanup keyring
        let _ = delete_credentials("https://miniflux.example.com", "testuser").await;
    }

    #[tokio::test]
    async fn test_save_new_account_with_password() {
        let pool = setup_test_db().await;

        let config = AuthConfig {
            server_url: "https://miniflux.example.com".to_string(),
            auth_token: None,
            username: Some("testuser2".to_string()),
            password: Some("test_password_456".to_string()),
        };

        let result = save_miniflux_account_test(&pool, config.clone()).await;
        assert!(result.is_ok(), "Failed to save account: {:?}", result.err());

        let account_id = result.unwrap();
        assert!(account_id > 0);

        // Verify account is in database
        let row: (i64, String, String, String, i64) = sqlx::query_as(
            "SELECT id, username, server_url, auth_method, is_active FROM miniflux_accounts WHERE id = ?",
        )
        .bind(account_id)
        .fetch_one(&pool)
        .await
        .expect("Failed to fetch account");

        assert_eq!(row.1, "testuser2");
        assert_eq!(row.2, "https://miniflux.example.com");
        assert_eq!(row.3, "password");
        assert_eq!(row.4, 1); // is_active = true

        // Verify password is in keyring
        let password_result =
            get_password("https://miniflux.example.com", "testuser2").await;
        assert!(password_result.is_ok());
        assert_eq!(password_result.unwrap(), "test_password_456");

        // Cleanup keyring
        let _ = delete_credentials("https://miniflux.example.com", "testuser2").await;
    }

    #[tokio::test]
    async fn test_update_existing_account() {
        let pool = setup_test_db().await;

        // First save
        let config1 = AuthConfig {
            server_url: "https://miniflux.example.com".to_string(),
            auth_token: Some("old_token".to_string()),
            username: Some("testuser3".to_string()),
            password: None,
        };

        let account_id1 = save_miniflux_account_test(&pool, config1.clone())
            .await
            .expect("Failed to save first account");

        let config2 = AuthConfig {
            server_url: "https://miniflux.example.com".to_string(),
            auth_token: None,
            username: Some("testuser3".to_string()),
            password: Some("new_password".to_string()),
        };

        let account_id2 = save_miniflux_account_test(&pool, config2.clone())
            .await
            .expect("Failed to update account");

        assert_eq!(
            account_id1, account_id2,
            "Account ID should remain the same"
        );

        // Verify auth_method is updated
        let row: (String,) =
            sqlx::query_as("SELECT auth_method FROM miniflux_accounts WHERE id = ?")
                .bind(account_id2)
                .fetch_one(&pool)
                .await
                .expect("Failed to fetch account");

        assert_eq!(row.0, "password");

        // Verify new password is in keyring
        let password_result =
            get_password("https://miniflux.example.com", "testuser3").await;
        assert!(password_result.is_ok());
        assert_eq!(password_result.unwrap(), "new_password");

        // Cleanup keyring
        let _ = delete_credentials("https://miniflux.example.com", "testuser3").await;
    }

    #[tokio::test]
    async fn test_is_active_exclusivity() {
        let pool = setup_test_db().await;

        // Save first account
        let config1 = AuthConfig {
            server_url: "https://miniflux1.example.com".to_string(),
            auth_token: Some("token1".to_string()),
            username: Some("user1".to_string()),
            password: None,
        };

        save_miniflux_account_test(&pool, config1.clone())
            .await
            .expect("Failed to save first account");

        // Save second account
        let config2 = AuthConfig {
            server_url: "https://miniflux2.example.com".to_string(),
            auth_token: Some("token2".to_string()),
            username: Some("user2".to_string()),
            password: None,
        };

        save_miniflux_account_test(&pool, config2.clone())
            .await
            .expect("Failed to save second account");

        // Verify only one account is active
        let active_count: i64 =
            sqlx::query_scalar("SELECT COUNT(*) FROM miniflux_accounts WHERE is_active = 1")
                .fetch_one(&pool)
                .await
                .expect("Failed to count active accounts");

        assert_eq!(active_count, 1, "Only one account should be active");

        // Verify it's the second account
        let active_username: String =
            sqlx::query_scalar("SELECT username FROM miniflux_accounts WHERE is_active = 1")
                .fetch_one(&pool)
                .await
                .expect("Failed to fetch active username");

        assert_eq!(active_username, "user2");

        // Cleanup keyring
        let _ = delete_credentials("https://miniflux1.example.com", "user1").await;
        let _ = delete_credentials("https://miniflux2.example.com", "user2").await;
    }

    #[tokio::test]
    async fn test_missing_credentials() {
        let pool = setup_test_db().await;

        let config = AuthConfig {
            server_url: "https://miniflux.example.com".to_string(),
            auth_token: None,
            username: Some("testuser".to_string()),
            password: None,
        };

        let result = save_miniflux_account_test(&pool, config).await;
        assert!(result.is_err());

        match result.unwrap_err() {
            AccountError::InvalidCredentials => {}
            err => panic!("Expected InvalidCredentials, got {:?}", err),
        }
    }

    #[tokio::test]
    async fn test_missing_username() {
        let pool = setup_test_db().await;

        let config = AuthConfig {
            server_url: "https://miniflux.example.com".to_string(),
            auth_token: Some("token".to_string()),
            username: None,
            password: None,
        };

        let result = save_miniflux_account_test(&pool, config).await;
        assert!(result.is_err());

        match result.unwrap_err() {
            AccountError::InvalidCredentials => {}
            err => panic!("Expected InvalidCredentials, got {:?}", err),
        }
    }

    #[tokio::test]
    async fn test_duplicate_username_allowed_with_update() {
        let pool = setup_test_db().await;

        // First save
        let config1 = AuthConfig {
            server_url: "https://miniflux.example.com".to_string(),
            auth_token: Some("token1".to_string()),
            username: Some("duplicate_user".to_string()),
            password: None,
        };

        let id1 = save_miniflux_account_test(&pool, config1.clone())
            .await
            .expect("Failed to save first account");

        // Second save with same username should update
        let config2 = AuthConfig {
            server_url: "https://miniflux2.example.com".to_string(),
            auth_token: Some("token2".to_string()),
            username: Some("duplicate_user".to_string()),
            password: None,
        };

        let id2 = save_miniflux_account_test(&pool, config2.clone())
            .await
            .expect("Second save should succeed and update");

        assert_eq!(id1, id2, "Should update existing account");

        // Verify server_url is updated
        let server_url: String =
            sqlx::query_scalar("SELECT server_url FROM miniflux_accounts WHERE id = ?")
                .bind(id2)
                .fetch_one(&pool)
                .await
                .expect("Failed to fetch server_url");

        assert_eq!(server_url, "https://miniflux2.example.com");

        // Cleanup keyring
        let _ = delete_credentials("https://miniflux2.example.com", "duplicate_user").await;
    }

    #[tokio::test]
    async fn test_get_accounts_returns_all() {
        let pool = setup_test_db().await;

        // Create multiple accounts
        let config1 = AuthConfig {
            server_url: "https://miniflux1.example.com".to_string(),
            auth_token: Some("token1".to_string()),
            username: Some("user1".to_string()),
            password: None,
        };

        let config2 = AuthConfig {
            server_url: "https://miniflux2.example.com".to_string(),
            auth_token: Some("token2".to_string()),
            username: Some("user2".to_string()),
            password: None,
        };

        save_miniflux_account_test(&pool, config1.clone())
            .await
            .expect("Failed to save first account");

        save_miniflux_account_test(&pool, config2.clone())
            .await
            .expect("Failed to save second account");

        // Get all accounts
        let accounts = get_miniflux_accounts_test(&pool)
            .await
            .expect("Failed to get accounts");

        assert_eq!(accounts.len(), 2, "Should return 2 accounts");

        // Verify accounts contain expected data
        let usernames: Vec<&str> = accounts.iter().map(|a| a.username.as_str()).collect();
        assert!(usernames.contains(&"user1"));
        assert!(usernames.contains(&"user2"));

        // Cleanup keyring
        let _ = delete_credentials("https://miniflux1.example.com", "user1").await;
        let _ = delete_credentials("https://miniflux2.example.com", "user2").await;
    }

    #[tokio::test]
    async fn test_get_accounts_correct_order() {
        let pool = setup_test_db().await;

        // Create accounts with explicit timing
        let config1 = AuthConfig {
            server_url: "https://miniflux1.example.com".to_string(),
            auth_token: Some("token1".to_string()),
            username: Some("user_oldest".to_string()),
            password: None,
        };

        save_miniflux_account_test(&pool, config1.clone())
            .await
            .expect("Failed to save first account");

        // Small delay to ensure different timestamps
        tokio::time::sleep(tokio::time::Duration::from_millis(10)).await;

        let config2 = AuthConfig {
            server_url: "https://miniflux2.example.com".to_string(),
            auth_token: Some("token2".to_string()),
            username: Some("user_newest".to_string()),
            password: None,
        };

        save_miniflux_account_test(&pool, config2.clone())
            .await
            .expect("Failed to save second account");

        // Get all accounts
        let accounts = get_miniflux_accounts_test(&pool)
            .await
            .expect("Failed to get accounts");

        assert_eq!(accounts.len(), 2);

        // Verify order (newest first)
        assert_eq!(
            accounts[0].username, "user_newest",
            "First account should be newest"
        );
        assert_eq!(
            accounts[1].username, "user_oldest",
            "Second account should be oldest"
        );

        // Cleanup keyring
        let _ = delete_credentials("https://miniflux1.example.com", "user_oldest").await;
        let _ = delete_credentials("https://miniflux2.example.com", "user_newest").await;
    }

    #[tokio::test]
    async fn test_get_accounts_empty_database() {
        let pool = setup_test_db().await;

        // Get accounts from empty database
        let accounts = get_miniflux_accounts_test(&pool)
            .await
            .expect("Failed to get accounts");

        assert_eq!(accounts.len(), 0, "Should return empty vector");
    }

    async fn delete_miniflux_account_test(
        pool: &SqlitePool,
        id: i64,
    ) -> Result<(), AccountError> {
        use super::super::delete_miniflux_account_impl;
        delete_miniflux_account_impl(pool, id).await
    }

    #[tokio::test]
    async fn test_delete_account_removes_from_database() {
        let pool = setup_test_db().await;

        // Create account
        let config = AuthConfig {
            server_url: "https://miniflux.example.com".to_string(),
            auth_token: Some("test_token".to_string()),
            username: Some("delete_test_user".to_string()),
            password: None,
        };

        let account_id = save_miniflux_account_test(&pool, config.clone())
            .await
            .expect("Failed to save account");

        // Delete account
        let result = delete_miniflux_account_test(&pool, account_id).await;
        assert!(result.is_ok(), "Failed to delete account: {:?}", result.err());

        // Verify account is deleted from database
        let count: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM miniflux_accounts WHERE id = ?")
            .bind(account_id)
            .fetch_one(&pool)
            .await
            .expect("Failed to count accounts");

        assert_eq!(count, 0, "Account should be deleted from database");

        // Verify credentials are deleted from keyring
        let token_result = get_token("https://miniflux.example.com", "delete_test_user").await;
        assert!(
            matches!(token_result, Err(AccountError::NotFound)),
            "Credentials should be deleted from keyring"
        );
    }

    #[tokio::test]
    async fn test_delete_account_removes_credentials_from_keyring() {
        let pool = setup_test_db().await;

        // Create account with password
        let config = AuthConfig {
            server_url: "https://miniflux.example.com".to_string(),
            auth_token: None,
            username: Some("delete_test_user2".to_string()),
            password: Some("test_password".to_string()),
        };

        let account_id = save_miniflux_account_test(&pool, config.clone())
            .await
            .expect("Failed to save account");

        // Verify password is in keyring
        let password_result = get_password("https://miniflux.example.com", "delete_test_user2").await;
        assert!(password_result.is_ok(), "Password should be in keyring");

        // Delete account
        let result = delete_miniflux_account_test(&pool, account_id).await;
        assert!(result.is_ok(), "Failed to delete account: {:?}", result.err());

        // Verify credentials are deleted from keyring
        let password_result = get_password("https://miniflux.example.com", "delete_test_user2").await;
        assert!(
            matches!(password_result, Err(AccountError::NotFound)),
            "Password should be deleted from keyring"
        );
    }

    #[tokio::test]
    async fn test_delete_account_cascade_deletes_from_users() {
        let pool = setup_test_db().await;

        // Create account
        let config = AuthConfig {
            server_url: "https://miniflux.example.com".to_string(),
            auth_token: Some("test_token".to_string()),
            username: Some("delete_test_user3".to_string()),
            password: None,
        };

        let account_id = save_miniflux_account_test(&pool, config.clone())
            .await
            .expect("Failed to save account");

        // Insert user in users table
        let now = chrono::Utc::now().to_rfc3339();
        sqlx::query(
            r#"
            INSERT INTO users (id, server_url, username, is_admin, theme, language, timezone, 
                entry_sorting_direction, entries_per_page, display_mode, 
                show_reading_time, entry_swipe, created_at, updated_at) 
            VALUES (1, ?, ?, 0, 'system', 'en', 'UTC', 'asc', 100, 'standalone', 1, 1, ?, ?)
            "#,
        )
        .bind("https://miniflux.example.com")
        .bind("delete_test_user3")
        .bind(&now)
        .bind(&now)
        .execute(&pool)
        .await
        .expect("Failed to insert user");

        // Verify user exists
        let count: i64 = sqlx::query_scalar(
            "SELECT COUNT(*) FROM users WHERE server_url = ? AND username = ?",
        )
        .bind("https://miniflux.example.com")
        .bind("delete_test_user3")
        .fetch_one(&pool)
        .await
        .expect("Failed to count users");

        assert_eq!(count, 1, "User should exist before deletion");

        // Delete account
        let result = delete_miniflux_account_test(&pool, account_id).await;
        assert!(result.is_ok(), "Failed to delete account: {:?}", result.err());

        // Verify user is cascade deleted
        let count: i64 = sqlx::query_scalar(
            "SELECT COUNT(*) FROM users WHERE server_url = ? AND username = ?",
        )
        .bind("https://miniflux.example.com")
        .bind("delete_test_user3")
        .fetch_one(&pool)
        .await
        .expect("Failed to count users");

        assert_eq!(count, 0, "User should be cascade deleted");

        // Cleanup keyring
        let _ = delete_credentials("https://miniflux.example.com", "delete_test_user3").await;
    }

    #[tokio::test]
    async fn test_delete_nonexistent_account_returns_error() {
        let pool = setup_test_db().await;

        // Try to delete non-existent account
        let result = delete_miniflux_account_test(&pool, 99999).await;
        assert!(result.is_err(), "Should fail to delete non-existent account");

        match result.unwrap_err() {
            AccountError::NotFound => {}
            err => panic!("Expected NotFound, got {:?}", err),
        }
    }

    #[tokio::test]
    async fn test_delete_active_account_is_allowed() {
        let pool = setup_test_db().await;

        // Create active account
        let config = AuthConfig {
            server_url: "https://miniflux.example.com".to_string(),
            auth_token: Some("test_token".to_string()),
            username: Some("active_delete_user".to_string()),
            password: None,
        };

        let account_id = save_miniflux_account_test(&pool, config.clone())
            .await
            .expect("Failed to save account");

        // Verify account is active
        let is_active: i64 =
            sqlx::query_scalar("SELECT is_active FROM miniflux_accounts WHERE id = ?")
                .bind(account_id)
                .fetch_one(&pool)
                .await
                .expect("Failed to fetch is_active");

        assert_eq!(is_active, 1, "Account should be active");

        // Delete active account should succeed
        let result = delete_miniflux_account_test(&pool, account_id).await;
        assert!(result.is_ok(), "Should be able to delete active account");

        // Verify account is deleted
        let count: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM miniflux_accounts WHERE id = ?")
            .bind(account_id)
            .fetch_one(&pool)
            .await
            .expect("Failed to count accounts");

        assert_eq!(count, 0, "Account should be deleted");

        // Cleanup keyring
        let _ = delete_credentials("https://miniflux.example.com", "active_delete_user").await;
    }
}
