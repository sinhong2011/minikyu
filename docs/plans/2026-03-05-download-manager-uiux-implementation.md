# Download Manager UI/UX Enhancement Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Enhance the download manager with Safari-style visual polish, EMA speed/ETA, pause/resume, right-click context menus, keyboard navigation, and compact mode.

**Architecture:** Builds on the bug fix plan (`2026-03-05-download-manager-fixes.md`). Tasks 1-6 of that plan must be completed first. This plan adds 6 UI/UX tasks on top.

**Tech Stack:** Rust (Tauri v2, tokio, reqwest), React 19, TypeScript, Radix ContextMenu (via shadcn/ui), Tailwind v4, Lingui i18n, motion/react

---

### Task 7: Add linear progress bar and status left-border to rows

**Prerequisite:** Bug fix Tasks 1-6 completed.

**Files:**
- Modify: `src/components/downloads/DownloadManagerDialog.tsx`

**Step 1: Add progress bar to DownloadRow**

After the actions `div` and before the closing `</motion.div>` of each row, add a full-width progress bar for active downloads:

```tsx
{/* Linear progress bar for active downloads */}
{item.status === 'downloading' && (
  <div className="absolute inset-x-0 bottom-0 h-0.5 overflow-hidden rounded-full bg-foreground/5">
    <div
      className="h-full bg-foreground/40 transition-[width] duration-500 ease-out"
      style={{ width: `${item.progress}%` }}
    />
  </div>
)}
{item.status === 'paused' && (
  <div className="absolute inset-x-0 bottom-0 h-0.5 overflow-hidden rounded-full bg-foreground/5">
    <div
      className="h-full bg-foreground/20"
      style={{
        width: `${item.progress}%`,
        backgroundImage: 'repeating-linear-gradient(135deg, transparent, transparent 2px, rgba(0,0,0,0.05) 2px, rgba(0,0,0,0.05) 4px)',
      }}
    />
  </div>
)}
```

**Step 2: Add left border for status indication**

On the `motion.div` wrapper, add a left border class based on status:

```tsx
className={cn(
  'relative flex items-center gap-3 rounded-xl px-3 py-2.5 transition-colors',
  'hover:bg-foreground/[0.03]',
  item.status === 'downloading' && 'bg-accent/30',
  item.status === 'completed' && 'border-l-2 border-l-emerald-500/30',
  item.status === 'failed' && 'border-l-2 border-l-destructive/30',
  item.status === 'paused' && 'border-l-2 border-l-amber-500/30',
)}
```

**Step 3: Update `DownloadStatus` type to include `'paused'`**

```typescript
type DownloadStatus = 'downloading' | 'completed' | 'failed' | 'cancelled' | 'paused';
```

**Step 4: Verify typecheck passes**

Run: `bun run typecheck`

**Step 5: Commit**

```bash
git add src/components/downloads/DownloadManagerDialog.tsx
git commit -m "feat(downloads): Add linear progress bar and status left-border to rows"
```

---

### Task 8: Implement EMA speed calculation and ETA display

**Files:**
- Modify: `src/components/downloads/DownloadManagerDialog.tsx`

**Step 1: Replace speed calculation with EMA**

Replace the `lastUpdateRef` + `-1` sentinel pattern. Change the ref type and speed calculation in the event listener:

```typescript
const speedRef = useRef<Record<number, { bytes: number; time: number; ema: number }>>({});
```

In the event listener, replace the speed block:

```typescript
const now = Date.now();
const prev = speedRef.current[enclosure_id];
let speed = 0;
if (prev && status === 'downloading') {
  const timeDiff = (now - prev.time) / 1000;
  if (timeDiff > 0.3) {
    const instant = (downloaded_bytes - prev.bytes) / timeDiff;
    const alpha = 0.3;
    speed = prev.ema > 0 ? alpha * instant + (1 - alpha) * prev.ema : instant;
    speedRef.current[enclosure_id] = { bytes: downloaded_bytes, time: now, ema: speed };
  } else {
    speed = prev.ema; // Keep previous EMA value
  }
} else {
  speedRef.current[enclosure_id] = { bytes: downloaded_bytes, time: now, ema: 0 };
}
```

Remove `lastUpdateRef` entirely.

**Step 2: Add ETA formatting helper**

```typescript
function formatEta(remainingBytes: number, speed: number): string {
  if (speed <= 0 || remainingBytes <= 0) return '';
  const seconds = remainingBytes / speed;
  if (seconds < 60) return '< 1 min';
  if (seconds < 3600) return `~${Math.ceil(seconds / 60)} min`;
  const h = Math.floor(seconds / 3600);
  const m = Math.ceil((seconds % 3600) / 60);
  return `~${h}h ${m}m`;
}
```

**Step 3: Display ETA in the meta row**

In `DownloadRow`, after the speed display, add ETA:

```tsx
{item.speed !== undefined && item.speed > 0 && item.totalBytes > 0 && (
  <>
    <span className="text-muted-foreground/30">·</span>
    <span className="tabular-nums text-foreground/50">
      {formatEta(item.totalBytes - item.downloadedBytes, item.speed)}
    </span>
  </>
)}
```

**Step 4: Extract i18n strings**

Run: `bun run i18n:extract`

**Step 5: Commit**

```bash
git add src/components/downloads/DownloadManagerDialog.tsx src/locales/
git commit -m "feat(downloads): Add EMA speed smoothing and ETA display"
```

---

### Task 9: Add stale download detection

**Files:**
- Modify: `src/components/downloads/DownloadManagerDialog.tsx`

**Step 1: Auto-mark stale downloads on initial load**

In the `setup()` function inside useEffect, after loading from DB, mark any `downloading` items as `failed`:

```typescript
const result = await commands.getDownloadsFromDb();
if (result.status === 'ok') {
  const mapped = result.data.map((h) => {
    // ... existing mapping logic ...
  });

  // Mark stale "downloading" items as failed (from previous session)
  const cleaned = mapped.map((item) =>
    item.status === 'downloading'
      ? { ...item, status: 'failed' as DownloadStatus, error: 'Interrupted — app was closed' }
      : item
  );

  setDownloads(cleaned);
}
```

**Step 2: Commit**

```bash
git add src/components/downloads/DownloadManagerDialog.tsx
git commit -m "fix(downloads): Auto-mark stale downloading items as failed on load"
```

---

### Task 10: Add pause/resume backend commands

**Prerequisite:** Task 1 (CancellationToken) from bug fix plan completed.

**Files:**
- Modify: `src-tauri/src/commands/downloads.rs`
- Modify: `src-tauri/src/bindings.rs`
- Modify: `src-tauri/src/miniflux/types.rs` (DownloadProgress — add `paused` status)

**Step 1: Add `Paused` variant to `DownloadState`**

In `src-tauri/src/commands/downloads.rs`:

```rust
/// Download is paused
Paused {
    id: usize,
    url: String,
    progress: i32,
    downloaded_bytes: i64,
    total_bytes: i64,
    supports_range: bool,
    paused_at: SystemTime,
},
```

**Step 2: Add `pause_download` command**

```rust
/// Pause an active download
#[tauri::command]
#[specta::specta]
pub async fn pause_download(app: tauri::AppHandle, url: String) -> Result<(), String> {
    log::info!("Pausing download: {url}");

    let mut id_opt = None;
    let mut bytes_opt = None;
    let mut total_opt = None;
    let mut progress_opt = None;
    {
        let downloads = get_download_manager().active_downloads.lock().unwrap();
        if let Some(dl) = downloads.iter().find(|d| matches!(d, DownloadState::Downloading { url: u, .. } if u == &url)) {
            if let DownloadState::Downloading { id, downloaded_bytes, total_bytes, progress, .. } = dl {
                id_opt = Some(*id);
                bytes_opt = Some(*downloaded_bytes);
                total_opt = Some(*total_bytes);
                progress_opt = Some(*progress);
            }
        }
    }

    let id = id_opt.ok_or_else(|| format!("Active download not found for URL: {url}"))?;
    let downloaded_bytes = bytes_opt.unwrap_or(0);
    let total_bytes = total_opt.unwrap_or(0);
    let progress = progress_opt.unwrap_or(0);

    // Cancel the running download task
    get_download_manager().cancel(id);

    // Update in-memory state to Paused
    {
        let mut downloads = get_download_manager().active_downloads.lock().unwrap();
        if let Some(idx) = downloads.iter().position(|d| matches!(d, DownloadState::Downloading { id: did, .. } if *did == id)) {
            downloads[idx] = DownloadState::Paused {
                id,
                url: url.clone(),
                progress,
                downloaded_bytes,
                total_bytes,
                supports_range: true, // optimistic; checked on resume
                paused_at: SystemTime::now(),
            };
        }
    }

    let file_name = extract_filename(&url).unwrap_or_else(|| "download.bin".to_string());

    save_download_to_db(
        &app, id, &url, &file_name,
        DownloadDbParams {
            status: "paused",
            progress,
            downloaded_bytes,
            total_bytes,
            file_path: None,
            error: None,
        },
    ).await;

    emit_download_event_with_id(
        &app, id, file_name, url,
        DownloadEventParams {
            progress,
            downloaded_bytes,
            total_bytes,
            status: "paused".to_string(),
            file_path: None,
        },
    );

    Ok(())
}
```

**Step 3: Add `resume_download` command**

```rust
/// Resume a paused download using HTTP Range
#[tauri::command]
#[specta::specta]
pub async fn resume_download(
    app: tauri::AppHandle,
    url: String,
    file_name: Option<String>,
    media_type: Option<String>,
) -> Result<String, String> {
    log::info!("Resuming download: {url}");

    // Look up paused state
    let mut paused_info = None;
    {
        let downloads = get_download_manager().active_downloads.lock().unwrap();
        if let Some(dl) = downloads.iter().find(|d| matches!(d, DownloadState::Paused { url: u, .. } if u == &url)) {
            if let DownloadState::Paused { id, downloaded_bytes, total_bytes, .. } = dl {
                paused_info = Some((*id, *downloaded_bytes, *total_bytes));
            }
        }
    }

    if let Some((id, downloaded_bytes, total_bytes)) = paused_info {
        let file_name_str = file_name
            .unwrap_or_else(|| extract_filename(&url).unwrap_or_else(|| "download.bin".to_string()));

        let cancel_token = get_download_manager().create_cancellation_token(id);

        // Update state to Downloading
        {
            let mut downloads = get_download_manager().active_downloads.lock().unwrap();
            if let Some(idx) = downloads.iter().position(|d| matches!(d, DownloadState::Paused { id: did, .. } if *did == id)) {
                downloads[idx] = DownloadState::Downloading {
                    id,
                    url: url.clone(),
                    progress: if total_bytes > 0 { (downloaded_bytes * 100 / total_bytes) as i32 } else { 0 },
                    downloaded_bytes,
                    total_bytes,
                    started_at: SystemTime::now(),
                };
            }
        }

        save_download_to_db(
            &app, id, &url, &file_name_str,
            DownloadDbParams {
                status: "downloading",
                progress: if total_bytes > 0 { (downloaded_bytes * 100 / total_bytes) as i32 } else { 0 },
                downloaded_bytes,
                total_bytes,
                file_path: None,
                error: None,
            },
        ).await;

        // Resolve file path from DB (partial file should exist)
        let state: tauri::State<'_, AppState> = app.state();
        let file_path = {
            let pool_lock = state.db_pool.lock().await;
            if let Some(pool) = &*pool_lock {
                let row = sqlx::query("SELECT file_path FROM downloads WHERE id = ?")
                    .bind(id as i64)
                    .fetch_optional(pool)
                    .await
                    .ok()
                    .flatten();
                row.and_then(|r| r.get::<Option<String>, _>("file_path"))
            } else {
                None
            }
        };

        // If we have a partial file, resume with Range header
        // Otherwise fall back to full re-download
        if let Some(ref path) = file_path {
            if std::path::Path::new(path).exists() && downloaded_bytes > 0 {
                let result = perform_download_resume(
                    &app, &url, id, file_name_str.clone(), path, downloaded_bytes, cancel_token,
                ).await;

                get_download_manager().remove_token(id);

                match &result {
                    Ok(fp) => {
                        let total = get_file_size(fp).unwrap_or(0);
                        save_download_to_db(&app, id, &url, &file_name_str, DownloadDbParams {
                            status: "completed", progress: 100,
                            downloaded_bytes: total, total_bytes: total,
                            file_path: Some(fp), error: None,
                        }).await;
                        emit_download_event_with_id(&app, id, file_name_str, url, DownloadEventParams {
                            progress: 100, downloaded_bytes: total, total_bytes: total,
                            status: "completed".to_string(), file_path: Some(fp.clone()),
                        });
                    }
                    Err(e) => {
                        if e == "Download cancelled" {
                            // Paused again, don't mark as failed
                        } else {
                            save_download_to_db(&app, id, &url, &file_name_str, DownloadDbParams {
                                status: "failed", progress: 0,
                                downloaded_bytes: 0, total_bytes: 0,
                                file_path: None, error: Some(e),
                            }).await;
                            emit_download_event_with_id(&app, id, file_name_str, url, DownloadEventParams {
                                progress: 0, downloaded_bytes: 0, total_bytes: 0,
                                status: "failed".to_string(), file_path: None,
                            });
                        }
                    }
                }

                return result;
            }
        }

        // Fallback: restart from scratch
        get_download_manager().remove_token(id);
        download_file(app, url, Some(file_name_str), media_type).await
    } else {
        // Not paused — treat as fresh retry
        download_file(app, url, file_name, media_type).await
    }
}
```

**Step 4: Add `perform_download_resume` function**

Similar to `perform_download` but opens file in append mode and sends `Range` header:

```rust
async fn perform_download_resume(
    app: &tauri::AppHandle,
    url: &str,
    download_id: usize,
    file_name: String,
    file_path: &str,
    start_bytes: i64,
    cancel_token: CancellationToken,
) -> Result<String, String> {
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(30))
        .build()
        .map_err(|e| format!("Failed to create HTTP client: {e}"))?;

    let response = client
        .get(url)
        .header("Range", format!("bytes={start_bytes}-"))
        .send()
        .await
        .map_err(|e| format!("Failed to fetch URL: {e}"))?;

    // Check if server supports Range (206 Partial Content)
    let supports_range = response.status() == reqwest::StatusCode::PARTIAL_CONTENT;
    if !supports_range {
        return Err("Server does not support resume — retry will restart download".to_string());
    }

    let content_length = response.content_length().unwrap_or(0) as i64;
    let total_bytes = start_bytes + content_length;
    let mut downloaded_bytes = start_bytes;
    let mut reader = response.bytes_stream();

    let file_path_buf = std::path::PathBuf::from(file_path);
    let mut file = tokio::fs::OpenOptions::new()
        .append(true)
        .open(&file_path_buf)
        .await
        .map_err(|e| format!("Failed to open file for resume: {e}"))?;

    let mut last_emit_time = std::time::Instant::now();
    let mut last_emit_progress: i32 = 0;

    while let Some(chunk_result) = reader.next().await {
        if cancel_token.is_cancelled() {
            return Err("Download cancelled".to_string());
        }

        let chunk = chunk_result.map_err(|e| format!("Download chunk error: {e}"))?;
        downloaded_bytes += chunk.len() as i64;
        file.write_all(&chunk)
            .await
            .map_err(|e| format!("Failed to write file: {e}"))?;

        let progress = if total_bytes > 0 {
            (downloaded_bytes * 100 / total_bytes) as i32
        } else {
            0
        };

        let now = std::time::Instant::now();
        let elapsed = now.duration_since(last_emit_time);
        let progress_delta = (progress - last_emit_progress).abs();

        if elapsed.as_millis() >= 250 || progress_delta >= 1 || downloaded_bytes == total_bytes {
            last_emit_time = now;
            last_emit_progress = progress;

            if progress % 10 == 0 || downloaded_bytes == total_bytes {
                save_download_to_db(app, download_id, url, &file_name, DownloadDbParams {
                    status: "downloading", progress, downloaded_bytes, total_bytes,
                    file_path: Some(file_path), error: None,
                }).await;
            }

            emit_download_event_with_id(app, download_id, file_name.clone(), url.to_string(), DownloadEventParams {
                progress, downloaded_bytes, total_bytes,
                status: "downloading".to_string(), file_path: None,
            });
        }
    }

    file.flush().await.map_err(|e| format!("Failed to flush file: {e}"))?;
    Ok(file_path.to_string())
}
```

**Step 5: Register new commands in bindings.rs**

Add to `collect_commands!`:

```rust
downloads::pause_download,
downloads::resume_download,
```

**Step 6: Regenerate bindings and verify**

Run: `cd src-tauri && cargo build --lib && cd .. && bun run codegen:tauri`

**Step 7: Commit**

```bash
git add src-tauri/src/commands/downloads.rs src-tauri/src/bindings.rs src/lib/bindings.ts
git commit -m "feat(downloads): Add pause/resume with HTTP Range header support"
```

---

### Task 11: Add right-click context menu

**Files:**
- Modify: `src/components/downloads/DownloadManagerDialog.tsx`

**Step 1: Check if ContextMenu is available from shadcn/ui**

Run: `ls src/components/ui/context-menu.tsx 2>/dev/null || echo "MISSING"`

If missing, add it:

Run: `bunx shadcn@latest add context-menu`

**Step 2: Wrap DownloadRow in ContextMenu**

Import `ContextMenu`, `ContextMenuContent`, `ContextMenuItem`, `ContextMenuTrigger`, `ContextMenuSeparator` from `@/components/ui/context-menu`.

Wrap the `motion.div` in `DownloadRow` with `ContextMenu` + `ContextMenuTrigger`:

```tsx
<ContextMenu>
  <ContextMenuTrigger asChild>
    <motion.div ...>
      {/* existing row content */}
    </motion.div>
  </ContextMenuTrigger>
  <ContextMenuContent className="w-48">
    {item.status === 'downloading' && (
      <>
        <ContextMenuItem onClick={() => onPause(item)}>
          {_(msg`Pause`)}
        </ContextMenuItem>
        <ContextMenuItem onClick={() => onCancel(item)} className="text-destructive">
          {_(msg`Cancel`)}
        </ContextMenuItem>
      </>
    )}
    {item.status === 'paused' && (
      <>
        <ContextMenuItem onClick={() => onResume(item)}>
          {_(msg`Resume`)}
        </ContextMenuItem>
        <ContextMenuItem onClick={() => onCancel(item)} className="text-destructive">
          {_(msg`Cancel`)}
        </ContextMenuItem>
      </>
    )}
    {item.status === 'completed' && (
      <>
        {item.filePath && (
          <>
            <ContextMenuItem onClick={() => onOpenFile(item.filePath!)}>
              {_(msg`Open File`)}
            </ContextMenuItem>
            <ContextMenuItem onClick={() => onOpenFolder(item.filePath!)}>
              {_(msg`Show in folder`)}
            </ContextMenuItem>
          </>
        )}
        {inferMediaType(item.fileName) === 'audio' && (
          <ContextMenuItem onClick={() => onPlay(item)}>
            {_(msg`Play`)}
          </ContextMenuItem>
        )}
        <ContextMenuSeparator />
        <ContextMenuItem onClick={() => onRemove(item.enclosureId)} className="text-destructive">
          {_(msg`Remove`)}
        </ContextMenuItem>
      </>
    )}
    {(item.status === 'failed' || item.status === 'cancelled') && (
      <>
        <ContextMenuItem onClick={() => onRetry(item)}>
          {_(msg`Retry`)}
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem onClick={() => onRemove(item.enclosureId)} className="text-destructive">
          {_(msg`Remove`)}
        </ContextMenuItem>
      </>
    )}
    <ContextMenuSeparator />
    <ContextMenuItem onClick={() => onCopyUrl(item.url)}>
      {_(msg`Copy URL`)}
    </ContextMenuItem>
  </ContextMenuContent>
</ContextMenu>
```

**Step 3: Add `onPause` and `onResume` props to DownloadRow**

Update the prop types and wire them up from the parent.

**Step 4: Add `handlePause` and `handleResume` handlers in parent**

```typescript
const handlePause = async (dl: DownloadItem) => {
  if (dl.status !== 'downloading') return;
  const result = await commands.pauseDownload(dl.url);
  if (result.status === 'error') {
    toast.error(_(msg`Failed to pause download`));
  }
};

const handleResume = async (dl: DownloadItem) => {
  if (dl.status !== 'paused') return;
  const result = await commands.resumeDownload(dl.url, dl.fileName, null);
  if (result.status === 'error') {
    toast.error(_(msg`Failed to resume download`));
  }
};
```

**Step 5: Add pause/resume inline buttons too**

In `DownloadRow` action buttons section, add pause button for downloading items and resume button for paused items (replacing or alongside cancel).

**Step 6: Extract i18n and verify**

Run: `bun run i18n:extract && bun run typecheck`

**Step 7: Commit**

```bash
git add src/components/downloads/DownloadManagerDialog.tsx src/components/ui/context-menu.tsx src/locales/
git commit -m "feat(downloads): Add right-click context menu with pause/resume/remove actions"
```

---

### Task 12: Add keyboard navigation

**Files:**
- Modify: `src/components/downloads/DownloadManagerDialog.tsx`

**Step 1: Add roving tabindex state**

```typescript
const [focusedIndex, setFocusedIndex] = useState(-1);
const rowRefs = useRef<(HTMLDivElement | null)[]>([]);
```

**Step 2: Add keydown handler on the list container**

```typescript
const handleListKeyDown = (e: React.KeyboardEvent) => {
  const maxIndex = filtered.length - 1;

  switch (e.key) {
    case 'ArrowDown': {
      e.preventDefault();
      const next = Math.min(focusedIndex + 1, maxIndex);
      setFocusedIndex(next);
      rowRefs.current[next]?.focus();
      break;
    }
    case 'ArrowUp': {
      e.preventDefault();
      const prev = Math.max(focusedIndex - 1, 0);
      setFocusedIndex(prev);
      rowRefs.current[prev]?.focus();
      break;
    }
    case 'Enter': {
      e.preventDefault();
      const item = filtered[focusedIndex];
      if (!item) break;
      if (item.status === 'completed' && item.filePath) handleOpenFile(item.filePath);
      else if (item.status === 'failed' || item.status === 'cancelled') handleRetry(item);
      break;
    }
    case 'Delete':
    case 'Backspace': {
      e.preventDefault();
      const item = filtered[focusedIndex];
      if (!item) break;
      if (item.status !== 'downloading' && item.status !== 'paused') {
        handleRemove(item.enclosureId);
      }
      break;
    }
    case ' ': {
      e.preventDefault();
      const item = filtered[focusedIndex];
      if (!item) break;
      if (item.status === 'downloading') handlePause(item);
      else if (item.status === 'paused') handleResume(item);
      break;
    }
  }
};
```

**Step 3: Attach handler and refs**

On the list container div, add `onKeyDown={handleListKeyDown}`. On each `DownloadRow`, forward a ref and add `tabIndex={index === focusedIndex ? 0 : -1}`. Add a focused ring style:

```tsx
className={cn(
  // ... existing classes
  'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring'
)}
```

**Step 4: Verify typecheck**

Run: `bun run typecheck`

**Step 5: Commit**

```bash
git add src/components/downloads/DownloadManagerDialog.tsx
git commit -m "feat(downloads): Add keyboard navigation with arrow keys, Enter, Delete, Space"
```

---

### Task 13: Add compact mode toggle

**Files:**
- Modify: `src/components/downloads/DownloadManagerDialog.tsx`
- Modify: `src/store/ui-store.ts`

**Step 1: Add `downloadsCompact` to UI store**

In `src/store/ui-store.ts`, add to the store state:

```typescript
downloadsCompact: boolean;
toggleDownloadsCompact: () => void;
```

With implementation:

```typescript
downloadsCompact: false,
toggleDownloadsCompact: () => set((s) => ({ downloadsCompact: !s.downloadsCompact })),
```

**Step 2: Add toggle button in dialog header**

After the "Downloads" title, add a compact mode toggle button:

```tsx
<button
  type="button"
  onClick={toggleDownloadsCompact}
  className="flex size-7 items-center justify-center rounded-full text-muted-foreground/50 transition-colors hover:bg-foreground/5 hover:text-foreground"
  title={compact ? _(msg`Expanded view`) : _(msg`Compact view`)}
>
  <HugeiconsIcon icon={compact ? Menu01Icon : Menu02Icon} className="size-3.5" />
</button>
```

Import the appropriate icons (use existing Hugeicons).

**Step 3: Conditionally render compact rows**

In `DownloadRow`, check a `compact` prop. When compact:

```tsx
{compact ? (
  <div className="flex items-center gap-2 py-1.5 px-3">
    <DownloadIcon item={item} />
    <span className="flex-1 truncate text-sm">{displayName}</span>
    {item.status === 'downloading' && (
      <span className="text-xs tabular-nums text-muted-foreground">{item.progress}%</span>
    )}
    {/* Single primary action button */}
  </div>
) : (
  /* existing full row */
)}
```

**Step 4: Extract i18n and verify**

Run: `bun run i18n:extract && bun run typecheck`

**Step 5: Commit**

```bash
git add src/components/downloads/DownloadManagerDialog.tsx src/store/ui-store.ts src/locales/
git commit -m "feat(downloads): Add compact mode toggle for download list"
```

---

## Execution Order Summary

| Task | Description | Depends On |
|------|-------------|------------|
| 1-6 | Bug fixes (separate plan) | — |
| 7 | Progress bar + status borders | Task 1 (Paused state) |
| 8 | EMA speed + ETA | — |
| 9 | Stale download detection | — |
| 10 | Pause/resume backend | Task 1 (CancellationToken) |
| 11 | Right-click context menu | Task 10 |
| 12 | Keyboard navigation | Task 10, 11 |
| 13 | Compact mode toggle | — |
