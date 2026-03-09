//! S3-compatible storage operations for cloud sync.

use log::{debug, error, info};
use s3::bucket::Bucket;
use s3::creds::Credentials;
use s3::Region;

use super::keyring;

/// Build an S3 bucket client from preferences config.
fn build_bucket(
    endpoint: &str,
    bucket_name: &str,
    region: &str,
    access_key: &str,
    secret_key: &str,
) -> Result<Box<Bucket>, String> {
    let region = Region::Custom {
        region: region.to_string(),
        endpoint: endpoint.to_string(),
    };

    let credentials = Credentials::new(Some(access_key), Some(secret_key), None, None, None)
        .map_err(|e| format!("Invalid credentials: {e}"))?;

    let bucket = Bucket::new(bucket_name, region, credentials)
        .map_err(|e| format!("Failed to create bucket: {e}"))?
        .with_path_style();

    Ok(bucket)
}

/// Get bucket client using keyring credentials.
fn get_bucket(endpoint: &str, bucket_name: &str, region: &str) -> Result<Box<Bucket>, String> {
    let access_key = keyring::get_access_key()?;
    let secret_key = keyring::get_secret_key()?;
    build_bucket(endpoint, bucket_name, region, &access_key, &secret_key)
}

/// Upload JSON data to S3.
pub async fn push(
    endpoint: &str,
    bucket_name: &str,
    region: &str,
    object_key: &str,
    json_data: &str,
) -> Result<(), String> {
    debug!("Cloud sync push to {endpoint}/{bucket_name}/{object_key}");
    let bucket = get_bucket(endpoint, bucket_name, region)?;

    let response = bucket
        .put_object_with_content_type(object_key, json_data.as_bytes(), "application/json")
        .await
        .map_err(|e| {
            error!("Cloud sync push failed: {e}");
            format!("Upload failed: {e}")
        })?;

    if response.status_code() >= 300 {
        return Err(format!(
            "Upload failed with status {}",
            response.status_code()
        ));
    }

    info!("Cloud sync push successful");
    Ok(())
}

/// Download JSON data from S3.
pub async fn pull(
    endpoint: &str,
    bucket_name: &str,
    region: &str,
    object_key: &str,
) -> Result<String, String> {
    debug!("Cloud sync pull from {endpoint}/{bucket_name}/{object_key}");
    let bucket = get_bucket(endpoint, bucket_name, region)?;

    let response = bucket.get_object(object_key).await.map_err(|e| {
        error!("Cloud sync pull failed: {e}");
        format!("Download failed: {e}")
    })?;

    if response.status_code() == 404 {
        return Err("No sync data found on remote".to_string());
    }

    if response.status_code() >= 300 {
        return Err(format!(
            "Download failed with status {}",
            response.status_code()
        ));
    }

    String::from_utf8(response.to_vec()).map_err(|e| format!("Invalid UTF-8 in sync data: {e}"))
}

/// Test S3 connection by listing bucket objects (limited to 1).
pub async fn test_connection(
    endpoint: &str,
    bucket_name: &str,
    region: &str,
    access_key: &str,
    secret_key: &str,
) -> Result<(), String> {
    debug!("Testing cloud sync connection to {endpoint}/{bucket_name}");
    let bucket = build_bucket(endpoint, bucket_name, region, access_key, secret_key)?;

    bucket
        .list("minikyu/".to_string(), Some("/".to_string()))
        .await
        .map_err(|e| {
            error!("Cloud sync connection test failed: {e}");
            format!("Connection test failed: {e}")
        })?;

    info!("Cloud sync connection test successful");
    Ok(())
}
