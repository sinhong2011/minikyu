# Download Manager Fixes Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix critical bugs in the download manager: broken cancel, non-persistent remove/clear, wrong retry media type, and progress event flooding.

**Architecture:** Six independent fix tasks targeting both Rust backend (`downloads.rs`) and React frontend (`DownloadManagerDialog.tsx`). Each task is self-contained. Tasks 1-3 are critical bug fixes. Task 4 adds missing backend commands. Task 5 throttles events. Task 6 fixes smaller UI/code quality issues.

**Tech Stack:** Rust (Tauri v2, tokio, reqwest, sqlx), React 19, TypeScript, Lingui i18n

---

### Task 1: Fix broken cancel — add CancellationToken

**Problem:** `cancel_download` marks in-memory state as cancelled but the Tokio download task continues streaming. No cancellation mechanism exists.

**Files:**
- Modify: `src-tauri/src/commands/downloads.rs`
- Modify: `Cargo.toml` (add `tokio-util` if not present)

**Step 1: Check if `tokio-util` is already a dependency**

Run: `grep tokio-util src-tauri/Cargo.toml`

If not present, add it:

```toml
tokio-util = { version = "0.7", features = ["rt"] }
```

**Step 2: Add cancellation infrastructure to DownloadManager**

In `src-tauri/src/commands/downloads.rs`, replace the `DownloadManager` struct and related code:

```rust
use std::collections::HashMap;
use tokio_util::sync::CancellationToken;

/// Download manager with active download tracking and cancellation
#[derive(Debug)]
pub struct DownloadManager {
    active_downloads: Arc<Mutex<Vec<DownloadState>>>,
    cancellation_tokens: Arc<Mutex<HashMap<usize, CancellationToken>>>,
}

impl DownloadManager {
    pub fn new() -> Self {
        Self {
            active_downloads: Arc::new(Mutex::new(Vec::new())),
            cancellation_tokens: Arc::new(Mutex::new(HashMap::new())),
        }
    }

    pub fn get_active_downloads(&self) -> Vec<DownloadState> {
        self.active_downloads.lock().unwrap().clone()
    }

    pub fn create_cancellation_token(&self, id: usize) -> CancellationToken {
        let token = CancellationToken::new();
        self.cancellation_tokens.lock().unwrap().insert(id, token.clone());
        token
    }

    pub fn cancel(&self, id: usize) {
        if let Some(token) = self.cancellation_tokens.lock().unwrap().remove(&id) {
            token.cancel();
        }
    }

    pub fn remove_token(&self, id: usize) {
        self.cancellation_tokens.lock().unwrap().remove(&id);
    }
}
```

**Step 3: Pass cancellation token into `perform_download`**

Update `perform_download` signature to accept a `CancellationToken`:

```rust
async fn perform_download(
    app: &tauri::AppHandle,
    url: &str,
    download_id: usize,
    file_name: String,
    default_path: Option<&str>,
    cancel_token: CancellationToken,
) -> Result<String, String> {
```

In the chunk loop, check for cancellation:

```rust
while let Some(chunk_result) = reader.next().await {
    // Check cancellation before processing chunk
    if cancel_token.is_cancelled() {
        // Clean up partial file
        drop(file);
        let _ = tokio::fs::remove_file(&file_path_buf).await;
        return Err("Download cancelled".to_string());
    }

    let chunk = chunk_result.map_err(|e| format!("Download chunk error: {e}"))?;
    // ... rest of chunk processing
}
```

**Step 4: Update `download_file` to create and pass token**

In `download_file`, before calling `perform_download`:

```rust
let cancel_token = get_download_manager().create_cancellation_token(download_id);
```

Pass it to `perform_download`. After the download completes (success or failure), clean up:

```rust
get_download_manager().remove_token(download_id);
```

**Step 5: Update `cancel_download` to use the token**

In `cancel_download`, after finding the download ID, call:

```rust
get_download_manager().cancel(id);
```

This triggers the token, which causes the download loop to exit and clean up the partial file.

**Step 6: Verify Rust compiles**

Run: `cd src-tauri && cargo build --lib`
Expected: Successful compilation

**Step 7: Commit**

```bash
git add src-tauri/src/commands/downloads.rs src-tauri/Cargo.toml src-tauri/Cargo.lock
git commit -m "fix(downloads): Add CancellationToken to actually stop cancelled downloads"
```

---

### Task 2: Add `delete_download` and `clear_downloads` backend commands

**Problem:** `handleRemove` and `handleClearTab` only clear local React state. Items reappear on dialog reopen because no backend deletion exists.

**Files:**
- Modify: `src-tauri/src/commands/downloads.rs`
- Modify: `src-tauri/src/bindings.rs`
- Modify: `src/components/downloads/DownloadManagerDialog.tsx`

**Step 1: Add `delete_download` Tauri command**

In `src-tauri/src/commands/downloads.rs`, add after `retry_download`:

```rust
/// Delete a download record from the database
#[tauri::command]
#[specta::specta]
pub async fn delete_download(app: tauri::AppHandle, id: i64) -> Result<(), String> {
    let state: tauri::State<'_, AppState> = app.state();
    let pool_lock = state.db_pool.lock().await;
    if let Some(pool) = &*pool_lock {
        sqlx::query("DELETE FROM downloads WHERE id = ?")
            .bind(id)
            .execute(pool)
            .await
            .map_err(|e| e.to_string())?;

        // Also remove from in-memory state
        let mut downloads = get_download_manager().active_downloads.lock().unwrap();
        downloads.retain(|d| {
            let dl_id = match d {
                DownloadState::Downloading { id, .. } => *id,
                DownloadState::Completed { id, .. } => *id,
                DownloadState::Failed { id, .. } => *id,
                DownloadState::Cancelled { id, .. } => *id,
            };
            dl_id != id as usize
        });

        Ok(())
    } else {
        Err("Database pool not initialized".to_string())
    }
}

/// Clear downloads from database by status filter
#[tauri::command]
#[specta::specta]
pub async fn clear_downloads(
    app: tauri::AppHandle,
    status: Option<String>,
) -> Result<i64, String> {
    let state: tauri::State<'_, AppState> = app.state();
    let pool_lock = state.db_pool.lock().await;
    if let Some(pool) = &*pool_lock {
        let result = if let Some(status) = &status {
            sqlx::query("DELETE FROM downloads WHERE status = ?")
                .bind(status)
                .execute(pool)
                .await
        } else {
            sqlx::query("DELETE FROM downloads WHERE status != 'downloading'")
                .execute(pool)
                .await
        };

        let rows = result.map_err(|e| e.to_string())?.rows_affected() as i64;

        // Clean in-memory state too
        let mut downloads = get_download_manager().active_downloads.lock().unwrap();
        if let Some(status_filter) = &status {
            downloads.retain(|d| {
                let s = match d {
                    DownloadState::Downloading { .. } => "downloading",
                    DownloadState::Completed { .. } => "completed",
                    DownloadState::Failed { .. } => "failed",
                    DownloadState::Cancelled { .. } => "cancelled",
                };
                s != status_filter
            });
        } else {
            downloads.retain(|d| matches!(d, DownloadState::Downloading { .. }));
        }

        Ok(rows)
    } else {
        Err("Database pool not initialized".to_string())
    }
}
```

**Step 2: Register in bindings.rs**

In `src-tauri/src/bindings.rs`, add to `collect_commands!`:

```rust
downloads::delete_download,
downloads::clear_downloads,
```

**Step 3: Regenerate TypeScript bindings**

Run: `bun run codegen:tauri`

**Step 4: Update `handleRemove` in DownloadManagerDialog.tsx**

```typescript
const handleRemove = async (id: number) => {
  setDownloads((prev) => prev.filter((d) => d.enclosureId !== id));
  const result = await commands.deleteDownload(BigInt(id).toString() as any);
  if (result.status === 'error') {
    console.error('Failed to delete download:', result.error);
  }
};
```

Note: Check the generated binding signature for `deleteDownload` — the `id` parameter may be typed as `number` since it's `i64`. Use the exact type from the generated binding.

**Step 5: Update `handleClearTab` in DownloadManagerDialog.tsx**

```typescript
const handleClearTab = async () => {
  if (activeTab === 'completed') {
    setDownloads((prev) => prev.filter((d) => d.status !== 'completed'));
    await commands.clearDownloads('completed');
  } else if (activeTab === 'failed') {
    setDownloads((prev) => prev.filter((d) => d.status !== 'failed' && d.status !== 'cancelled'));
    await commands.clearDownloads('failed');
    await commands.clearDownloads('cancelled');
  } else {
    setDownloads((prev) => prev.filter((d) => d.status === 'downloading'));
    await commands.clearDownloads(null);
  }
};
```

**Step 6: Verify Rust compiles and bindings regenerate**

Run: `cd src-tauri && cargo build --lib && cd .. && bun run codegen:tauri`

**Step 7: Commit**

```bash
git add src-tauri/src/commands/downloads.rs src-tauri/src/bindings.rs src/lib/bindings.ts src/components/downloads/DownloadManagerDialog.tsx
git commit -m "feat(downloads): Add delete_download and clear_downloads backend commands"
```

---

### Task 3: Fix retry media type inference

**Problem:** `handleRetry` uses `inferMediaType` which coerces video to `'image'` via a ternary. This changes the save path on retry.

**Files:**
- Modify: `src-tauri/src/commands/downloads.rs` (add `media_type` column)
- Modify: `src-tauri/src/database/migrations.rs` (migration to add column)
- Modify: `src/components/downloads/DownloadManagerDialog.tsx`

**Step 1: Add migration to add `media_type` column to downloads table**

In `src-tauri/src/database/migrations.rs`, add a new migration step (find the migration version list and add):

```rust
sqlx::query("ALTER TABLE downloads ADD COLUMN media_type TEXT")
    .execute(pool)
    .await
    .ok(); // ok() because column may already exist on re-run
```

**Step 2: Update `save_download_to_db` to accept and store `media_type`**

Add `media_type: Option<&'a str>` to `DownloadDbParams`. Update the INSERT/UPSERT SQL to include the `media_type` column.

**Step 3: Pass `media_type` through `download_file`**

Store the `media_type` param in the download DB record.

**Step 4: Update `get_downloads_from_db` to return `media_type`**

Add `media_type` field to the `DownloadState` enum variants, OR add a separate `DownloadRecord` struct that wraps `DownloadState` with `media_type` and `file_name`. The simpler approach: add `file_name` and `media_type` fields to each `DownloadState` variant.

**However, that's a large refactor.** A pragmatic approach: add `media_type` to the `DownloadProgress` event struct and to the frontend `DownloadItem` type, and store it in the DB. Then use it on retry instead of inferring.

**Step 5: Update frontend `handleRetry`**

```typescript
const handleRetry = async (dl: DownloadItem) => {
  if (dl.status !== 'failed' && dl.status !== 'cancelled') return;
  const result = await commands.retryDownload(dl.url, dl.fileName, dl.mediaType ?? null);
  if (result.status === 'error') {
    toast.error(_(msg`Retry failed`), { description: result.error });
  }
};
```

**Step 6: Verify compilation**

Run: `cd src-tauri && cargo build --lib && cd .. && bun run codegen:tauri`

**Step 7: Commit**

```bash
git add src-tauri/ src/
git commit -m "fix(downloads): Store and reuse original media_type on retry instead of inferring"
```

---

### Task 4: Throttle progress events

**Problem:** Every HTTP chunk emits a Tauri IPC event, causing dozens/hundreds of React re-renders per second during active downloads.

**Files:**
- Modify: `src-tauri/src/commands/downloads.rs`

**Step 1: Add last-emit tracking to `perform_download`**

Add a `last_emit` timestamp before the chunk loop and only emit when ≥250ms have passed OR progress changed by ≥1%:

```rust
let mut last_emit_time = std::time::Instant::now();
let mut last_emit_progress: i32 = 0;

while let Some(chunk_result) = reader.next().await {
    // ... cancellation check, chunk write ...

    let progress = if total_bytes > 0 {
        (downloaded_bytes * 100 / total_bytes) as i32
    } else {
        0
    };

    let now = std::time::Instant::now();
    let elapsed = now.duration_since(last_emit_time);
    let progress_delta = (progress - last_emit_progress).abs();

    // Emit at most every 250ms or when progress jumps ≥1%
    if elapsed.as_millis() >= 250 || progress_delta >= 1 || downloaded_bytes == total_bytes {
        last_emit_time = now;
        last_emit_progress = progress;

        // DB update every 10%
        if progress % 10 == 0 || downloaded_bytes == total_bytes {
            save_download_to_db(/* ... */).await;
        }

        emit_download_event_with_id(/* ... */);
    }
}
```

**Step 2: Verify Rust compiles**

Run: `cd src-tauri && cargo build --lib`

**Step 3: Commit**

```bash
git add src-tauri/src/commands/downloads.rs
git commit -m "perf(downloads): Throttle progress events to max every 250ms or 1% change"
```

---

### Task 5: Fix useEffect dependency and `any` cast

**Problem:** useEffect depends on `[_]` (Lingui function) causing re-registration on locale change. Data loading uses `any` cast.

**Files:**
- Modify: `src/components/downloads/DownloadManagerDialog.tsx`

**Step 1: Fix useEffect dependency to empty array**

Change line 488:
```typescript
// Before
}, [_]);

// After
}, []);
```

**Step 2: Fix the `any` cast in data loading**

Replace the `result.data.map((h: any) => {` block with properly typed variant checking:

```typescript
result.data.map((h) => {
  if ('Downloading' in h) {
    const d = h.Downloading;
    return {
      enclosureId: d.id,
      url: d.url,
      fileName: d.url.split('/').pop() ?? '',
      status: 'downloading' as DownloadStatus,
      progress: d.progress,
      downloadedBytes: d.downloaded_bytes,
      totalBytes: d.total_bytes,
    };
  }
  if ('Completed' in h) {
    const d = h.Completed;
    return {
      enclosureId: d.id,
      url: d.url,
      fileName: d.file_path?.split(/[/\\]/).pop() ?? '',
      status: 'completed' as DownloadStatus,
      progress: d.progress,
      downloadedBytes: d.total_bytes,
      totalBytes: d.total_bytes,
      filePath: d.file_path,
    };
  }
  if ('Failed' in h) {
    const d = h.Failed;
    return {
      enclosureId: d.id,
      url: d.url,
      fileName: d.url.split('/').pop() ?? '',
      status: 'failed' as DownloadStatus,
      progress: d.progress,
      downloadedBytes: 0,
      totalBytes: 0,
      error: d.error,
    };
  }
  // Cancelled
  const d = h.Cancelled;
  return {
    enclosureId: d.id,
    url: d.url,
    fileName: d.url.split('/').pop() ?? '',
    status: 'cancelled' as DownloadStatus,
    progress: d.progress,
    downloadedBytes: 0,
    totalBytes: 0,
  };
})
```

**Step 3: Fix cancel/retry error handling — show toast instead of console.error**

```typescript
const handleCancel = async (dl: DownloadItem) => {
  if (dl.status !== 'downloading') return;
  const result = await commands.cancelDownload(dl.url);
  if (result.status === 'error') {
    toast.error(_(msg`Failed to cancel download`));
  }
};

const handleRetry = async (dl: DownloadItem) => {
  if (dl.status !== 'failed' && dl.status !== 'cancelled') return;
  const mediaType = inferMediaType(dl.fileName) === 'audio' ? 'audio' : 'image';
  const result = await commands.retryDownload(dl.url, dl.fileName, mediaType);
  if (result.status === 'error') {
    toast.error(_(msg`Failed to retry download`));
  }
};
```

**Step 4: Change "Show in Finder" to "Show in folder"**

```typescript
// Before
title={_(msg`Show in Finder`)}

// After
title={_(msg`Show in folder`)}
```

**Step 5: Verify typecheck passes**

Run: `bun run typecheck`

**Step 6: Extract i18n strings**

Run: `bun run i18n:extract`

**Step 7: Commit**

```bash
git add src/components/downloads/DownloadManagerDialog.tsx src/locales/
git commit -m "fix(downloads): Fix useEffect deps, remove any cast, improve error UX"
```

---

### Task 6: Add duplicate download prevention

**Problem:** Same URL can be downloaded simultaneously with no deduplication.

**Files:**
- Modify: `src-tauri/src/commands/downloads.rs`

**Step 1: Add duplicate check at start of `download_file`**

Before generating a new download ID, check if an active download exists for this URL:

```rust
// Check for active download with same URL
{
    let downloads = get_download_manager().active_downloads.lock().unwrap();
    if downloads.iter().any(|d| matches!(d, DownloadState::Downloading { url: dl_url, .. } if dl_url == &url)) {
        return Err("Download already in progress for this URL".to_string());
    }
}
```

**Step 2: Verify Rust compiles**

Run: `cd src-tauri && cargo build --lib`

**Step 3: Commit**

```bash
git add src-tauri/src/commands/downloads.rs
git commit -m "fix(downloads): Prevent duplicate downloads for the same URL"
```

---

## Out of Scope (noted for future work)

These were identified in the audit but are not included in this plan to keep scope manageable:

- **Migrate to TanStack Query**: Would deduplicate the download state listeners between `DownloadManagerDialog` and `PodcastPlayer`, but is a larger architectural refactor
- **Orphaned `enclosures` columns**: `downloaded`, `local_path`, `download_progress` — never written to, can be cleaned up in a future migration
- **Dead code**: `get_downloads` (in-memory) command is unused by frontend
- **Auto-download feature**: `auto_download_count` setting exists but has no implementation
- **Partial file cleanup on write error**: Currently leaves partial file on disk during error window
- **Component tests**: Zero test coverage for `DownloadManagerDialog` — significant effort to add
