# Download Manager UI/UX Enhancement Design

## Goal

Elevate the download manager dialog from basic functionality to a polished Safari-inspired experience with proper progress feedback, keyboard navigation, right-click context menus, and pause/resume support.

## Visual Design

### Progress Bar

Add a thin (2px) accent-colored linear progress bar spanning the full width underneath each downloading row. The existing circular ring on the icon stays for at-a-glance status. Paused downloads show a muted/striped bar pattern.

### Row Layout

```
┌─────────────────────────────────────────────────────┐
│ [Icon+Ring]  Episode Title.mp3              [actions]│
│              128.4 MB / 256.8 MB · 2.1 MB/s · ~1min │
│ ════════════════════════░░░░░░░░░░░░░░░░░░░░░░░░░░░ │
└─────────────────────────────────────────────────────┘
```

- Speed shown inline using EMA smoothing
- ETA computed from `remaining_bytes / smoothedSpeed`
- Completed: subtle green-tinted left border (2px)
- Failed: red-tinted left border (2px)
- Cancelled/Paused: muted left border

### Empty State

More descriptive message with keyboard shortcut hint for triggering downloads.

## Progress Feedback

### Speed Calculation

Replace the `-1` sentinel with exponential moving average:

```
newSpeed = 0.3 * instantSpeed + 0.7 * previousSpeed
```

Store `smoothedSpeed` per download in the component state.

### ETA Display

- `< 60s` → "< 1 min"
- `1-59 min` → "~3 min"
- `≥ 60 min` → "~1h 12m"
- Unknown (no content-length from server) → animated dots

### Stale Download Detection

Downloads loaded from DB with `status: 'downloading'` from a previous session get auto-marked as `failed` with error "Interrupted — app was closed" on initial load. Prevents zombie "downloading" rows.

## Interactions

### Right-Click Context Menu

Using Radix `ContextMenu` on each download row:

| Status | Menu Items |
|--------|-----------|
| Downloading | Pause, Cancel, Copy URL |
| Paused | Resume, Cancel, Copy URL |
| Completed | Open File, Show in Folder, Play (audio only), Copy URL, Remove |
| Failed/Cancelled | Retry, Copy URL, Remove |

### Keyboard Navigation

- `↑`/`↓` — move focus between rows (roving tabindex)
- `Enter` — open completed file / retry failed
- `Delete`/`Backspace` — remove row
- `Escape` — close dialog
- `Space` — pause/resume active download

### Pause/Resume

**Backend (`downloads.rs`):**

- `pause_download(url)` — triggers cancellation token, saves `downloaded_bytes`, marks status as `paused`
- `resume_download(url)` — re-issues HTTP GET with `Range: bytes={downloaded_bytes}-` header
- On initial response, check and store `Accept-Ranges` header support
- If server doesn't support Range, resume restarts from zero with a toast warning

**New `DownloadState` variant:**

```rust
Paused {
    id: usize,
    url: String,
    progress: i32,
    downloaded_bytes: i64,
    total_bytes: i64,
    supports_range: bool,
    paused_at: SystemTime,
}
```

**DB:** Add `paused` as valid status value. No schema change needed (status is TEXT).

## Information Density

### Compact Mode Toggle

Small toggle button (list icon) in dialog header switches between:

- **Default:** Current row height with full metadata line (size, speed, ETA)
- **Compact:** Single-line rows showing filename + progress percentage + primary action button

Preference stored in Zustand UI store (session-only, not persisted).

## Dependencies on Bug Fix Plan

This design depends on the fixes in `2026-03-05-download-manager-fixes.md`:

- Task 1 (CancellationToken) is required for pause/resume
- Task 2 (delete/clear commands) is required for keyboard Delete and context menu Remove
- Task 4 (throttled events) prevents the EMA speed calculation from being overwhelmed

Implementation order: bug fixes first, then UI/UX enhancements.
