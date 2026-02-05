//! Download Manager - Handles file downloads with progress tracking and state management

use crate::miniflux::types::DownloadProgress;
use crate::AppState;
use chrono::Utc;
use futures_util::StreamExt;
use serde::{Deserialize, Serialize};
use specta::Type;
use sqlx::Row;
use std::sync::{Arc, Mutex, OnceLock};
use std::time::SystemTime;
use tauri::{Emitter, Manager};
use tokio::io::AsyncWriteExt;

/// Download state managed by download manager
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub enum DownloadState {
    /// Download is in progress
    Downloading {
        id: usize,
        url: String,
        progress: i32,
        downloaded_bytes: i64,
        total_bytes: i64,
        started_at: SystemTime,
    },
    /// Download completed successfully
    Completed {
        id: usize,
        url: String,
        file_path: String,
        total_bytes: i64,
        progress: i32,
        completed_at: SystemTime,
    },
    /// Download failed
    Failed {
        id: usize,
        url: String,
        error: String,
        progress: i32,
        failed_at: SystemTime,
    },
    /// Download was cancelled
    Cancelled {
        id: usize,
        url: String,
        progress: i32,
        cancelled_at: SystemTime,
    },
}

/// Download manager with active download tracking
#[derive(Debug)]
pub struct DownloadManager {
    active_downloads: Arc<Mutex<Vec<DownloadState>>>,
}

impl DownloadManager {
    /// Create a new download manager
    pub fn new() -> Self {
        Self {
            active_downloads: Arc::new(Mutex::new(Vec::new())),
        }
    }

    /// Get all active downloads
    pub fn get_active_downloads(&self) -> Vec<DownloadState> {
        self.active_downloads.lock().unwrap().clone()
    }
}

/// Global download manager instance
static DOWNLOAD_MANAGER: OnceLock<DownloadManager> = OnceLock::new();

/// Atomic counter for generating unique download IDs
static DOWNLOAD_ID_COUNTER: OnceLock<std::sync::atomic::AtomicUsize> = OnceLock::new();

/// Get or initialize global download manager
fn get_download_manager() -> &'static DownloadManager {
    DOWNLOAD_MANAGER.get_or_init(DownloadManager::new)
}

/// Get next unique download ID
fn get_next_download_id() -> usize {
    let counter = DOWNLOAD_ID_COUNTER.get_or_init(|| std::sync::atomic::AtomicUsize::new(0));
    counter.fetch_add(1, std::sync::atomic::Ordering::SeqCst)
}

/// Save or update download in database
struct DownloadDbParams<'a> {
    status: &'a str,
    progress: i32,
    downloaded_bytes: i64,
    total_bytes: i64,
    file_path: Option<&'a str>,
    error: Option<&'a str>,
}

async fn save_download_to_db(
    app: &tauri::AppHandle,
    download_id: usize,
    url: &str,
    file_name: &str,
    params: DownloadDbParams<'_>,
) {
    let state: tauri::State<'_, AppState> = app.state();
    let pool_lock = state.db_pool.lock().await;
    if let Some(pool) = &*pool_lock {
        let now = Utc::now().to_rfc3339();
        let _ = sqlx::query(
            r#"
            INSERT INTO downloads (id, url, file_name, status, progress, downloaded_bytes, total_bytes, file_path, error, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET
                status = excluded.status,
                progress = excluded.progress,
                downloaded_bytes = excluded.downloaded_bytes,
                total_bytes = excluded.total_bytes,
                file_path = COALESCE(excluded.file_path, downloads.file_path),
                error = excluded.error,
                updated_at = excluded.updated_at
            "#,
        )
        .bind(download_id as i64)
        .bind(url)
        .bind(file_name)
        .bind(params.status)
        .bind(params.progress)
        .bind(params.downloaded_bytes)
        .bind(params.total_bytes)
        .bind(params.file_path)
        .bind(params.error)
        .bind(&now)
        .bind(&now)
        .execute(pool)
        .await;
    }
}

/// Initialize download ID counter from database
pub async fn init_download_manager(app: &tauri::AppHandle) {
    let state: tauri::State<'_, AppState> = app.state();
    let pool_lock = state.db_pool.lock().await;
    if let Some(pool) = &*pool_lock {
        let max_id: Option<i64> = sqlx::query_scalar("SELECT MAX(id) FROM downloads")
            .fetch_one(pool)
            .await
            .unwrap_or(None);

        if let Some(id) = max_id {
            let counter = DOWNLOAD_ID_COUNTER
                .get_or_init(|| std::sync::atomic::AtomicUsize::new((id + 1) as usize));
            counter.store((id + 1) as usize, std::sync::atomic::Ordering::SeqCst);
        }
    }
}

/// Get all downloads from database
#[tauri::command]
#[specta::specta]
pub async fn get_downloads_from_db(app: tauri::AppHandle) -> Result<Vec<DownloadState>, String> {
    let state: tauri::State<'_, AppState> = app.state();
    let pool_lock = state.db_pool.lock().await;
    if let Some(pool) = &*pool_lock {
        let rows = sqlx::query("SELECT * FROM downloads ORDER BY created_at DESC")
            .fetch_all(pool)
            .await
            .map_err(|e| e.to_string())?;

        let mut downloads = Vec::new();
        for row in rows {
            let id: i64 = row.get("id");
            let url: String = row.get("url");
            let _file_name: String = row.get("file_name");
            let status: String = row.get("status");
            let progress: i32 = row.get("progress");
            let downloaded_bytes: i64 = row.get("downloaded_bytes");
            let total_bytes: i64 = row.get("total_bytes");
            let file_path: Option<String> = row.get("file_path");
            let error: Option<String> = row.get("error");

            let dummy_time = SystemTime::now();

            let state = match status.as_str() {
                "downloading" => DownloadState::Downloading {
                    id: id as usize,
                    url,
                    progress,
                    downloaded_bytes,
                    total_bytes,
                    started_at: dummy_time,
                },
                "completed" => DownloadState::Completed {
                    id: id as usize,
                    url,
                    file_path: file_path.unwrap_or_default(),
                    total_bytes,
                    progress,
                    completed_at: dummy_time,
                },
                "failed" => DownloadState::Failed {
                    id: id as usize,
                    url,
                    error: error.unwrap_or_default(),
                    progress,
                    failed_at: dummy_time,
                },
                "cancelled" => DownloadState::Cancelled {
                    id: id as usize,
                    url,
                    progress,
                    cancelled_at: dummy_time,
                },
                _ => DownloadState::Cancelled {
                    id: id as usize,
                    url,
                    progress,
                    cancelled_at: dummy_time,
                },
            };
            downloads.push(state);
        }
        Ok(downloads)
    } else {
        Err("Database pool not initialized".to_string())
    }
}

/// Emit download progress event to frontend with enclosure_id
struct DownloadEventParams {
    progress: i32,
    downloaded_bytes: i64,
    total_bytes: i64,
    status: String,
    file_path: Option<String>,
}

fn emit_download_event_with_id(
    app: &tauri::AppHandle,
    download_id: usize,
    file_name: String,
    url: String,
    params: DownloadEventParams,
) {
    let _ = app.emit(
        "download-progress",
        DownloadProgress {
            enclosure_id: download_id as i64,
            file_name,
            url,
            progress: params.progress,
            downloaded_bytes: params.downloaded_bytes,
            total_bytes: params.total_bytes,
            status: params.status,
            file_path: params.file_path,
        },
    );
}

/// Get file size in bytes
fn get_file_size(path: &str) -> Option<i64> {
    std::fs::metadata(path).ok().map(|m| m.len() as i64)
}

fn extract_filename(url: &str) -> Option<String> {
    url.split('/')
        .next_back()
        .filter(|s| !s.is_empty())
        .map(String::from)
}

/// Download a file from URL to local disk
#[tauri::command]
#[specta::specta]
pub async fn download_file(
    app: tauri::AppHandle,
    url: String,
    file_name: Option<String>,
    media_type: Option<String>,
) -> Result<String, String> {
    log::info!("Starting download from: {}", url);

    let download_id = get_next_download_id();
    let file_name_str = file_name
        .clone()
        .unwrap_or_else(|| extract_filename(&url).unwrap_or_else(|| "download.bin".to_string()));

    let preferences = crate::commands::preferences::load_preferences_sync(&app);
    let default_path = match media_type.as_deref() {
        Some("image") => preferences
            .as_ref()
            .and_then(|p| p.image_download_path.as_ref()),
        Some("video") => preferences
            .as_ref()
            .and_then(|p| p.video_download_path.as_ref()),
        _ => None,
    };

    save_download_to_db(
        &app,
        download_id,
        &url,
        &file_name_str,
        DownloadDbParams {
            status: "downloading",
            progress: 0,
            downloaded_bytes: 0,
            total_bytes: 0,
            file_path: None,
            error: None,
        },
    )
    .await;

    let download_state = DownloadState::Downloading {
        id: download_id,
        url: url.clone(),
        progress: 0,
        downloaded_bytes: 0,
        total_bytes: 0,
        started_at: SystemTime::now(),
    };

    get_download_manager()
        .active_downloads
        .lock()
        .unwrap()
        .push(download_state);

    emit_download_event_with_id(
        &app,
        download_id,
        file_name_str.clone(),
        url.clone(),
        DownloadEventParams {
            progress: 0,
            downloaded_bytes: 0,
            total_bytes: 0,
            status: "downloading".to_string(),
            file_path: None,
        },
    );

    let result = perform_download(
        &app,
        &url,
        download_id,
        file_name_str.clone(),
        default_path.as_ref().map(|x| x.as_str()),
    )
    .await;

    match &result {
        Ok(file_path) => {
            let total_bytes = get_file_size(file_path).unwrap_or(0);
            save_download_to_db(
                &app,
                download_id,
                &url,
                &file_name_str,
                DownloadDbParams {
                    status: "completed",
                    progress: 100,
                    downloaded_bytes: total_bytes,
                    total_bytes,
                    file_path: Some(file_path),
                    error: None,
                },
            )
            .await;

            let mut downloads = get_download_manager().active_downloads.lock().unwrap();
            let completed_state = DownloadState::Completed {
                id: download_id,
                url: url.clone(),
                file_path: file_path.clone(),
                total_bytes,
                progress: 100,
                completed_at: SystemTime::now(),
            };
            downloads.push(completed_state);
            drop(downloads);

            emit_download_event_with_id(
                &app,
                download_id,
                file_name_str,
                url,
                DownloadEventParams {
                    progress: 100,
                    downloaded_bytes: total_bytes,
                    total_bytes,
                    status: "completed".to_string(),
                    file_path: Some(file_path.clone()),
                },
            );
        }
        Err(error) => {
            save_download_to_db(
                &app,
                download_id,
                &url,
                &file_name_str,
                DownloadDbParams {
                    status: "failed",
                    progress: 0,
                    downloaded_bytes: 0,
                    total_bytes: 0,
                    file_path: None,
                    error: Some(error),
                },
            )
            .await;

            let mut downloads = get_download_manager().active_downloads.lock().unwrap();
            let failed_state = DownloadState::Failed {
                id: download_id,
                url: url.clone(),
                error: error.clone(),
                progress: 0,
                failed_at: SystemTime::now(),
            };
            downloads.push(failed_state);
            drop(downloads);

            emit_download_event_with_id(
                &app,
                download_id,
                file_name_str,
                url,
                DownloadEventParams {
                    progress: 0,
                    downloaded_bytes: 0,
                    total_bytes: 0,
                    status: "failed".to_string(),
                    file_path: None,
                },
            );
        }
    }

    result
}

/// Get all active downloads
#[tauri::command]
#[specta::specta]
pub fn get_downloads() -> Vec<DownloadState> {
    get_download_manager().get_active_downloads()
}

/// Cancel an active download by URL
#[tauri::command]
#[specta::specta]
pub async fn cancel_download(app: tauri::AppHandle, url: String) -> Result<(), String> {
    log::info!("Cancelling download: {}", url);

    let mut id_opt = None;
    {
        let downloads = get_download_manager().active_downloads.lock().unwrap();
        if let Some(index) = downloads.iter().position(|d| match d {
            DownloadState::Downloading { url: dl_url, .. } => dl_url == &url,
            _ => false,
        }) {
            if let DownloadState::Downloading { id, .. } = downloads[index] {
                id_opt = Some(id);
            }
        }
    }

    if let Some(id) = id_opt {
        {
            let mut downloads = get_download_manager().active_downloads.lock().unwrap();
            if let Some(index) = downloads.iter().position(|d| match d {
                DownloadState::Downloading { id: dl_id, .. } => *dl_id == id,
                _ => false,
            }) {
                downloads[index] = DownloadState::Cancelled {
                    id,
                    url: url.clone(),
                    progress: 0,
                    cancelled_at: SystemTime::now(),
                };
            }
        }

        let file_name = extract_filename(&url).unwrap_or_else(|| "download.bin".to_string());

        save_download_to_db(
            &app,
            id,
            &url,
            &file_name,
            DownloadDbParams {
                status: "cancelled",
                progress: 0,
                downloaded_bytes: 0,
                total_bytes: 0,
                file_path: None,
                error: None,
            },
        )
        .await;

        let _ = app.emit(
            "download-progress",
            DownloadProgress {
                enclosure_id: id as i64,
                file_name,
                url: url.clone(),
                progress: 0,
                downloaded_bytes: 0,
                total_bytes: 0,
                status: "cancelled".to_string(),
                file_path: None,
            },
        );

        log::info!("Download cancelled: {}", url);
        Ok(())
    } else {
        Err(format!("Download with URL {} not found", url))
    }
}

/// Retry a failed download
#[tauri::command]
#[specta::specta]
pub async fn retry_download(
    app: tauri::AppHandle,
    url: String,
    file_name: Option<String>,
    media_type: Option<String>,
) -> Result<String, String> {
    log::info!("Retrying download: {}", url);
    download_file(app, url, file_name, media_type).await
}

/// Perform actual download operation
async fn perform_download(
    app: &tauri::AppHandle,
    url: &str,
    download_id: usize,
    file_name: String,
    default_path: Option<&str>,
) -> Result<String, String> {
    let file_path = if let Some(path) = default_path {
        let mut full_path = std::path::PathBuf::from(path);
        full_path.push(&file_name);

        if let Some(parent) = full_path.parent() {
            std::fs::create_dir_all(parent)
                .map_err(|e| format!("Failed to create directory: {}", e))?;
        }

        full_path
            .to_str()
            .ok_or_else(|| "Invalid UTF-8 path".to_string())?
            .to_string()
    } else {
        use tauri_plugin_dialog::DialogExt;
        let path = app
            .dialog()
            .file()
            .set_file_name(&file_name)
            .blocking_save_file()
            .ok_or_else(|| "Save dialog was cancelled".to_string())?
            .into_path()
            .map_err(|e| format!("Invalid file path: {}", e))?;

        path.to_str()
            .ok_or_else(|| "Invalid UTF-8 path".to_string())?
            .to_string()
    };

    let file_path_buf = std::path::PathBuf::from(&file_path);
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(30))
        .build()
        .map_err(|e| format!("Failed to create HTTP client: {}", e))?;

    let response = client
        .get(url)
        .send()
        .await
        .map_err(|e| format!("Failed to fetch URL: {}", e))?;

    if !response.status().is_success() {
        return Err(format!("HTTP error: {}", response.status().as_str()));
    }

    let total_bytes = response.content_length().unwrap_or(0) as i64;
    let mut downloaded_bytes = 0i64;
    let mut reader = response.bytes_stream();
    let mut file = tokio::fs::File::create(&file_path_buf)
        .await
        .map_err(|e| format!("Failed to create file: {}", e))?;

    while let Some(chunk_result) = reader.next().await {
        let chunk = chunk_result.map_err(|e| format!("Download chunk error: {}", e))?;
        downloaded_bytes += chunk.len() as i64;
        file.write_all(&chunk)
            .await
            .map_err(|e| format!("Failed to write file: {}", e))?;

        let progress = if total_bytes > 0 {
            (downloaded_bytes * 100 / total_bytes) as i32
        } else {
            0
        };

        // Update DB periodically (every 10%) or at specific intervals
        if progress % 10 == 0 || downloaded_bytes == total_bytes {
            save_download_to_db(
                app,
                download_id,
                url,
                &file_name,
                DownloadDbParams {
                    status: "downloading",
                    progress,
                    downloaded_bytes,
                    total_bytes,
                    file_path: None,
                    error: None,
                },
            )
            .await;
        }

        emit_download_event_with_id(
            app,
            download_id,
            file_name.clone(),
            url.to_string(),
            DownloadEventParams {
                progress,
                downloaded_bytes,
                total_bytes,
                status: "downloading".to_string(),
                file_path: None,
            },
        );
    }

    file.flush()
        .await
        .map_err(|e| format!("Failed to flush file: {}", e))?;

    Ok(file_path)
}
