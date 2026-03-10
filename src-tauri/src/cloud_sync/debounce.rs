//! Debounced cloud sync push worker.
//!
//! Waits 5 seconds after the last notification before pushing. Each new
//! notification resets the timer, so rapid preference changes are batched.

use std::time::Duration;

use log::{debug, warn};
use tauri::{AppHandle, Manager};
use tokio::time::sleep;

use crate::AppState;

const DEBOUNCE_DELAY: Duration = Duration::from_secs(5);

/// Background task: waits for notifications, debounces, then pushes.
pub async fn run_debounce_worker(app: AppHandle) {
    let state: tauri::State<'_, AppState> = app.state();
    let notify = state.cloud_sync_notify.clone();

    loop {
        // Wait for at least one notification
        notify.notified().await;
        debug!("Cloud sync debounce: change detected, waiting {DEBOUNCE_DELAY:?}");

        // Drain any notifications that arrive within the debounce window
        loop {
            tokio::select! {
                () = notify.notified() => {
                    debug!("Cloud sync debounce: another change, resetting timer");
                    continue;
                }
                () = sleep(DEBOUNCE_DELAY) => {
                    break;
                }
            }
        }

        // Debounce window elapsed — push
        debug!("Cloud sync debounce: pushing");
        if let Err(e) = crate::commands::cloud_sync::cloud_sync_push(app.clone()).await {
            warn!("Cloud sync debounced push failed: {e}");
        }
    }
}
