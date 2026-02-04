use sqlx::sqlite::SqlitePool;
use std::path::PathBuf;
use tauri::{AppHandle, Manager};

use super::migrations::run_migrations;

pub fn get_db_path(app_handle: &AppHandle) -> Result<PathBuf, String> {
    let app_dir = app_handle.path().app_data_dir().map_err(|e| {
        log::error!("Failed to get app data directory: {}", e);
        format!("Failed to get app data directory: {}", e)
    })?;

    if let Err(e) = std::fs::create_dir_all(&app_dir) {
        log::error!(
            "Failed to create app data directory at {:?}: {}",
            app_dir,
            e
        );
        return Err(format!("Failed to create app data directory: {}", e));
    }

    let db_path = app_dir.join("minikyu.db");

    log::debug!("App data directory ready at: {:?}", app_dir);

    Ok(db_path)
}

pub async fn init_database_pool(app_handle: &AppHandle) -> Result<SqlitePool, sqlx::Error> {
    let db_path = match get_db_path(app_handle) {
        Ok(path) => path,
        Err(e) => {
            log::error!("Failed to get database path: {}", e);
            return Err(sqlx::Error::Io(std::io::Error::other(e)));
        }
    };

    let db_url = format!("sqlite://{}?mode=rwc", db_path.display());
    log::info!("Initializing database at: {}", db_url);

    let pool = match SqlitePool::connect(&db_url).await {
        Ok(p) => p,
        Err(e) => {
            log::error!(
                "Failed to connect to SQLite database at {:?}: {}",
                db_path,
                e
            );
            return Err(e);
        }
    };

    sqlx::query(
        r#"
        PRAGMA journal_mode = WAL;
        PRAGMA foreign_keys = ON;
        PRAGMA synchronous = NORMAL;
        "#,
    )
    .execute(&pool)
    .await?;

    run_migrations(&pool).await?;
    log::info!("Database initialized successfully at {:?}", db_path);

    Ok(pool)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_in_memory_db() {
        let pool = SqlitePool::connect("sqlite::memory:").await.unwrap();
        run_migrations(&pool).await.unwrap();

        let tables: Vec<String> =
            sqlx::query_scalar("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
                .fetch_all(&pool)
                .await
                .unwrap();

        assert!(tables.contains(&"categories".to_string()));
        assert!(tables.contains(&"feeds".to_string()));
        assert!(tables.contains(&"entries".to_string()));
        assert!(tables.contains(&"enclosures".to_string()));
        assert!(tables.contains(&"tags".to_string()));
        assert!(tables.contains(&"users".to_string()));
        assert!(tables.contains(&"sync_state".to_string()));
        assert!(tables.contains(&"sync_queue".to_string()));
        assert!(tables.contains(&"podcast_progress".to_string()));
    }
}
