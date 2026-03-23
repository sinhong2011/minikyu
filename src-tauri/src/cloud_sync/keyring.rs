//! Keyring helpers for cloud sync credentials (S3 and WebDAV).

use ::keyring::Entry;
use log::debug;

const SERVICE_NAME: &str = "minikyu";
const CLOUD_SYNC_USER: &str = "cloud-sync";

fn create_entry(suffix: &str) -> Entry {
    let key = format!("{SERVICE_NAME}:{CLOUD_SYNC_USER}:{suffix}");
    Entry::new(SERVICE_NAME, &key).expect("Failed to create keyring entry")
}

pub fn save_access_key(access_key: &str) -> Result<(), String> {
    debug!("Saving cloud sync access key to keyring");
    create_entry("access-key")
        .set_password(access_key)
        .map_err(|e| {
            debug!("Failed to save cloud sync access key: {e}");
            format!("Failed to save access key: {e}")
        })
}

pub fn get_access_key() -> Result<String, String> {
    create_entry("access-key").get_password().map_err(|e| {
        debug!("Failed to get cloud sync access key: {e}");
        format!("Failed to get access key: {e}")
    })
}

pub fn save_secret_key(secret_key: &str) -> Result<(), String> {
    debug!("Saving cloud sync secret key to keyring");
    create_entry("secret-key")
        .set_password(secret_key)
        .map_err(|e| {
            debug!("Failed to save cloud sync secret key: {e}");
            format!("Failed to save secret key: {e}")
        })
}

pub fn get_secret_key() -> Result<String, String> {
    create_entry("secret-key").get_password().map_err(|e| {
        debug!("Failed to get cloud sync secret key: {e}");
        format!("Failed to get secret key: {e}")
    })
}

pub fn save_webdav_password(password: &str) -> Result<(), String> {
    debug!("Saving cloud sync WebDAV password to keyring");
    create_entry("webdav-password")
        .set_password(password)
        .map_err(|e| {
            debug!("Failed to save WebDAV password: {e}");
            format!("Failed to save WebDAV password: {e}")
        })
}

pub fn get_webdav_password() -> Result<String, String> {
    create_entry("webdav-password").get_password().map_err(|e| {
        debug!("Failed to get WebDAV password: {e}");
        format!("Failed to get WebDAV password: {e}")
    })
}

pub fn delete_credentials() -> Result<(), String> {
    let _ = create_entry("access-key").delete_credential();
    let _ = create_entry("secret-key").delete_credential();
    let _ = create_entry("webdav-password").delete_credential();
    Ok(())
}
