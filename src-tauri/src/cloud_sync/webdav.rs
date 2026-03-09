//! WebDAV storage operations for cloud sync.

use log::{debug, error, info};
use reqwest_dav::{Auth, ClientBuilder, Depth};

use super::keyring;

/// Upload JSON data to WebDAV.
pub async fn push(
    url: &str,
    username: &str,
    file_path: &str,
    json_data: &str,
) -> Result<(), String> {
    debug!("Cloud sync WebDAV push to {url}{file_path}");
    let password = keyring::get_webdav_password()?;

    let client = ClientBuilder::new()
        .set_host(url.to_string())
        .set_auth(Auth::Basic(username.to_string(), password))
        .build()
        .map_err(|e| format!("Failed to create WebDAV client: {e}"))?;

    // Ensure parent directory exists (MKCOL is idempotent — 405 if already exists)
    if let Some(parent) = file_path.rsplit_once('/').map(|(p, _)| p) {
        if !parent.is_empty() {
            let _ = client.mkcol(parent).await;
        }
    }

    client
        .put(file_path, json_data.as_bytes().to_vec())
        .await
        .map_err(|e| {
            error!("Cloud sync WebDAV push failed: {e}");
            format!("Upload failed: {e}")
        })?;

    info!("Cloud sync WebDAV push successful");
    Ok(())
}

/// Download JSON data from WebDAV.
pub async fn pull(url: &str, username: &str, file_path: &str) -> Result<String, String> {
    debug!("Cloud sync WebDAV pull from {url}{file_path}");
    let password = keyring::get_webdav_password()?;

    let client = ClientBuilder::new()
        .set_host(url.to_string())
        .set_auth(Auth::Basic(username.to_string(), password))
        .build()
        .map_err(|e| format!("Failed to create WebDAV client: {e}"))?;

    let response = client.get(file_path).await.map_err(|e| {
        error!("Cloud sync WebDAV pull failed: {e}");
        format!("Download failed: {e}")
    })?;

    response
        .text()
        .await
        .map_err(|e| format!("Failed to read response: {e}"))
}

/// Test WebDAV connection by listing root.
pub async fn test_connection(
    url: &str,
    username: &str,
    password: &str,
) -> Result<(), String> {
    debug!("Testing cloud sync WebDAV connection to {url}");

    let client = ClientBuilder::new()
        .set_host(url.to_string())
        .set_auth(Auth::Basic(username.to_string(), password.to_string()))
        .build()
        .map_err(|e| format!("Failed to create WebDAV client: {e}"))?;

    client
        .list("/", Depth::Number(0))
        .await
        .map_err(|e| {
            error!("Cloud sync WebDAV connection test failed: {e}");
            format!("Connection test failed: {e}")
        })?;

    info!("Cloud sync WebDAV connection test successful");
    Ok(())
}
