#[cfg(test)]
mod tests {
    use crate::accounts::error::AccountError;
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

    #[tokio::test]
    async fn test_full_account_lifecycle() {
        let pool = setup_test_db().await;

        let config1 = AuthConfig {
            server_url: "https://account1.example.com".to_string(),
            auth_token: Some("token1".to_string()),
            username: Some("user1".to_string()),
            password: None,
        };

        let result = crate::commands::accounts::save_miniflux_account_impl(&pool, config1.clone())
            .await
            .expect("Failed to save account 1");
        let account_id1 = result;
        assert!(account_id1 > 0);

        let account1: MinifluxAccount = sqlx::query_as(
            "SELECT id, username, server_url, auth_method, is_active FROM miniflux_connections WHERE id = ?"
        )
        .bind(account_id1)
        .fetch_one(&pool)
        .await
        .expect("Failed to fetch account 1");
        assert_eq!(account1.username, "user1");
        assert_eq!(account1.server_url, "https://account1.example.com");
        assert_eq!(account1.auth_method, "token");
        assert!(account1.is_active);

        let config2 = AuthConfig {
            server_url: "https://account2.example.com".to_string(),
            auth_token: Some("token2".to_string()),
            username: Some("user2".to_string()),
            password: None,
        };

        let result = crate::commands::accounts::save_miniflux_account_impl(&pool, config2.clone())
            .await
            .expect("Failed to save account 2");
        let account_id2 = result;
        assert!(account_id2 > 0);

        let account1_after: MinifluxAccount = sqlx::query_as(
            "SELECT id, is_active FROM miniflux_connections WHERE id = ?"
        )
        .bind(account_id1)
        .fetch_one(&pool)
        .await
        .expect("Failed to fetch account 1");
        assert!(!account1_after.is_active);

        let account2: MinifluxAccount = sqlx::query_as(
            "SELECT id, is_active FROM miniflux_connections WHERE id = ?"
        )
        .bind(account_id2)
        .fetch_one(&pool)
        .await
        .expect("Failed to fetch account 2");
        assert!(account2.is_active);

        let result = crate::commands::accounts::switch_miniflux_account_impl(&pool, account_id1, account_id2)
            .await;
        assert!(result.is_ok());

        let account1_after_switch: MinifluxAccount = sqlx::query_as(
            "SELECT id, is_active FROM miniflux_connections WHERE id = ?"
        )
        .bind(account_id1)
        .fetch_one(&pool)
        .await
        .expect("Failed to fetch account 1");
        assert!(account1_after_switch.is_active);

        let account2_after_switch: MinifluxAccount = sqlx::query_as(
            "SELECT id, is_active FROM miniflux_connections WHERE id = ?"
        )
        .bind(account_id2)
        .fetch_one(&pool)
        .await
        .expect("Failed to fetch account 2");
        assert!(!account2_after_switch.is_active);

        let result = crate::commands::accounts::delete_miniflux_account_impl(&pool, account_id1)
            .await;
        assert!(result.is_ok());

        let deleted_account: Option<(i64,)> = sqlx::query_as(
            "SELECT id FROM miniflux_connections WHERE id = ?"
        )
        .bind(account_id1)
        .fetch_optional(&pool)
        .await
        .expect("Failed to check account 1 deletion");
        assert!(deleted_account.is_none());

        let account2_final: MinifluxAccount = sqlx::query_as(
            "SELECT id, is_active FROM miniflux_connections WHERE id = ?"
        )
        .bind(account_id2)
        .fetch_one(&pool)
        .await
        .expect("Failed to fetch account 2");
        assert!(account2_final.is_active);
    }

    #[tokio::test]
    async fn test_multi_account_scenario() {
        let pool = setup_test_db().await;

        let configs = vec![
            AuthConfig {
                server_url: "https://server1.example.com".to_string(),
                auth_token: Some("token1".to_string()),
                username: Some("user1".to_string()),
                password: None,
            },
            AuthConfig {
                server_url: "https://server2.example.com".to_string(),
                auth_token: Some("token2".to_string()),
                username: Some("user2".to_string()),
                password: None,
            },
            AuthConfig {
                server_url: "https://server3.example.com".to_string(),
                auth_token: Some("token3".to_string()),
                username: Some("user3".to_string()),
                password: None,
            },
        ];

        let mut account_ids = Vec::new();
        for config in &configs {
            let result =
                crate::commands::accounts::save_miniflux_account_impl(&pool, config.clone())
                    .await
                    .expect("Failed to save account");
            account_ids.push(result);
        }

        let accounts: Vec<MinifluxAccount> = sqlx::query_as(
            "SELECT id, username, server_url FROM miniflux_connections ORDER BY id"
        )
        .fetch_all(&pool)
        .await
        .expect("Failed to fetch accounts");
        assert_eq!(accounts.len(), 3);

        for (i, &account_id) in account_ids.iter().enumerate() {
            let result =
                crate::commands::accounts::switch_miniflux_account_impl(&pool, account_id, account_id)
                    .await;
            assert!(result.is_ok(), "Failed to switch to account {}", i + 1);
        }

        let accounts: Vec<MinifluxAccount> = sqlx::query_as(
            "SELECT id, is_active FROM miniflux_connections ORDER BY id"
        )
        .fetch_all(&pool)
        .await
        .expect("Failed to fetch accounts");
        let active_count = accounts.iter().filter(|a| a.is_active).count();
        assert_eq!(active_count, 1);

        let last_account = accounts.last().expect("No accounts");
        assert!(last_account.is_active);
    }

    #[tokio::test]
    async fn test_keyring_isolation() {
        let pool = setup_test_db().await;

        let config1 = AuthConfig {
            server_url: "https://server1.example.com".to_string(),
            auth_token: Some("token1".to_string()),
            username: Some("user1".to_string()),
            password: None,
        };

        crate::commands::accounts::save_miniflux_account_impl(&pool, config1.clone())
            .await
            .expect("Failed to save account 1");

        let config2 = AuthConfig {
            server_url: "https://server2.example.com".to_string(),
            auth_token: Some("token2".to_string()),
            username: Some("user1".to_string()),
            password: None,
        };

        crate::commands::accounts::save_miniflux_account_impl(&pool, config2.clone())
            .await
            .expect("Failed to save account 2");

        use crate::accounts::keyring::{get_token, save_token};

        let token1 =
            get_token("https://server1.example.com", "user1").await;
        assert!(token1.is_ok());
        assert_eq!(token1.unwrap(), "token1");

        let token2 =
            get_token("https://server2.example.com", "user1").await;
        assert!(token2.is_ok());
        assert_eq!(token2.unwrap(), "token2");
    }

    #[tokio::test]
    async fn test_database_unique_constraint() {
        let pool = setup_test_db().await;

        let config1 = AuthConfig {
            server_url: "https://server1.example.com".to_string(),
            auth_token: Some("token1".to_string()),
            username: Some("user1".to_string()),
            password: None,
        };

        crate::commands::accounts::save_miniflux_account_impl(&pool, config1.clone())
            .await
            .expect("Failed to save account 1");

        let result =         crate::commands::accounts::save_miniflux_account_impl(&pool, config1.clone())
            .await;
        assert!(result.is_ok(), "Should allow updating existing account with same username");
    }
}

