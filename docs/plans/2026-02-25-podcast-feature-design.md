# Podcast Feature Design

## Overview

Add production-grade podcast support to Minikyu — a podcast-aware RSS reader with inline audio playback, persistent mini-player, smart auto-downloads, and playback speed controls.

## Requirements

| Feature | Decision |
|---------|----------|
| Player UI | Full controls in-reader, slim bottom bar when navigating away |
| Sidebar/list | Smart detection in existing categories, podcast entries get duration/progress/download |
| Downloads | Smart auto-download per-feed (latest N), auto-cleanup played episodes, manual fallback |
| Playback continuity | Auto-play next in feed, "stop after current" toggle |
| Speed controls | Presets (0.5x-2x) + custom slider (0.5x-3x, 0.05 step), per-feed memory |
| Audio engine | HTML5 Audio + MediaSession API for OS media key integration |

## Architecture: HTML5 Audio + MediaSession API

Audio playback runs via the browser's `<audio>` element in React. The Web MediaSession API provides OS-level media key integration (play/pause/next from keyboard, Touch Bar, AirPods). Rust backend handles downloads, progress persistence, and auto-download scheduling.

**Separation of concerns:**
- React owns playback, UI, MediaSession
- Rust owns file I/O, SQLite, background scheduling

## Section 1: Data Model & Podcast Detection

### Smart Detection

A feed is a "podcast feed" when >50% of its recent entries (last 20) contain audio enclosures (`audio/*` MIME type). Evaluated client-side from cached data.

```typescript
// src/lib/podcast-utils.ts
function isPodcastFeed(entries: Entry[]): boolean {
  const recent = entries.slice(0, 20)
  const audioCount = recent.filter(e =>
    e.enclosures?.some(enc => enc.mime_type.startsWith("audio/"))
  ).length
  return audioCount / recent.length > 0.5
}

function getPodcastEnclosure(entry: Entry): Enclosure | null {
  return entry.enclosures?.find(enc => enc.mime_type.startsWith("audio/")) ?? null
}
```

### Database Changes

Existing `podcast_progress` and `enclosures` tables are already defined.

```sql
-- New table: per-feed podcast settings
CREATE TABLE podcast_feed_settings (
  feed_id INTEGER PRIMARY KEY,
  auto_download_count INTEGER DEFAULT 3,
  playback_speed REAL DEFAULT 1.0,
  auto_cleanup_days INTEGER DEFAULT 7,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- New column on existing enclosures table
ALTER TABLE enclosures ADD COLUMN duration_seconds INTEGER;
```

### Rust Types

```rust
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub struct PodcastFeedSettings {
    #[serde(serialize_with = "serialize_i64_as_string", deserialize_with = "deserialize_i64_from_string_or_number")]
    #[specta(type = String)]
    pub feed_id: i64,
    pub auto_download_count: i32,
    pub playback_speed: f64,
    pub auto_cleanup_days: i32,
}
```

## Section 2: Rust Backend

### New Command Module: `src-tauri/src/commands/podcast.rs`

```
get_podcast_feed_settings(feed_id)           → PodcastFeedSettings
update_podcast_feed_settings(feed_id, ...)   → ()
save_podcast_progress(entry_id, current_time, total_time) → ()
get_podcast_progress(entry_id)               → Option<PodcastProgress>
get_podcast_progress_batch(entry_ids)        → Vec<PodcastProgress>
mark_episode_completed(entry_id)             → ()
cleanup_played_episodes()                    → CleanupResult
get_auto_download_queue()                    → Vec<Enclosure>
```

### Progress Persistence

Debounced — React player fires progress events every second, but `save_podcast_progress` is called every 10 seconds + on pause/stop/navigate-away.

### Auto-Download Scheduler

Triggered after each sync (not a persistent timer):

1. Read `podcast_feed_settings.auto_download_count` per podcast feed
2. Get latest N unplayed episodes with audio enclosures
3. Filter out already-downloaded
4. Queue downloads via existing download infrastructure
5. Emit `"podcast-downloads-queued"` event

### Auto-Cleanup

Triggered alongside auto-download (post-sync):

1. Read `podcast_feed_settings.auto_cleanup_days`
2. Find completed episodes older than cleanup threshold
3. Delete local files, reset `enclosures.downloaded = false`
4. Emit `"podcast-cleanup-complete"` event

### Download Manager Integration

The podcast auto-download scheduler is a thin orchestration layer that calls existing `download_file` command. No duplication of download infrastructure:

```
Auto-download scheduler (new)
  └── calls existing download_file() command
        └── uses existing download infrastructure
              └── emits existing progress events
                    └── updates existing downloads table
```

`DownloadManagerDialog` enhanced with a podcast filter/tab to distinguish podcast downloads.

### New Events (Rust to React)

- `"podcast-downloads-queued"` — `{ feed_id, count }`
- `"podcast-cleanup-complete"` — `{ feed_id, deleted_count, freed_bytes }`

## Section 3: Frontend State Management

### Zustand Store: `src/store/player-store.ts`

```typescript
interface PlayerState {
  // Current playback
  currentEntry: Entry | null
  currentEnclosure: Enclosure | null
  isPlaying: boolean
  currentTime: number
  duration: number
  buffered: number

  // Controls
  playbackSpeed: number
  volume: number
  isMuted: boolean
  stopAfterCurrent: boolean

  // Mini-player visibility
  isMinimized: boolean

  // Actions
  play: (entry: Entry, enclosure: Enclosure) => void
  pause: () => void
  resume: () => void
  seek: (time: number) => void
  setSpeed: (speed: number) => void
  setVolume: (volume: number) => void
  toggleMute: () => void
  toggleStopAfterCurrent: () => void
  playNext: () => void
  dismiss: () => void

  // Internal
  _updateTime: (time: number) => void
  _updateDuration: (duration: number) => void
  _updateBuffered: (time: number) => void
  _onEnded: () => void
}
```

All access via selector pattern: `usePlayerStore((s) => s.isPlaying)`.

### Auto-Play Next Logic

On episode end: if `stopAfterCurrent` is false, fetch next unplayed episode from same feed and play. If none found or toggle is on, dismiss player.

### TanStack Query: `src/services/miniflux/podcast.ts`

```
Query keys:
  ['podcast', 'progress', entryId]
  ['podcast', 'progress', 'batch', ids]
  ['podcast', 'feed-settings', feedId]

Mutations:
  useSavePodcastProgress()
  useUpdateFeedSettings()
  useMarkEpisodeCompleted()
```

### State Responsibility

| Data | Layer | Reason |
|------|-------|--------|
| isPlaying, currentTime, volume, speed | Zustand | Transient, updates 1x/sec |
| currentEntry, currentEnclosure | Zustand | Drives UI, changes on track change |
| podcast_progress (persisted) | TanStack Query + SQLite | Survives restart |
| podcast_feed_settings | TanStack Query + SQLite | User preferences |
| entry/enclosure data | TanStack Query (existing) | Already cached |

## Section 4: UI Components

### Component Tree

```
MinifluxLayout (existing)
├── AppSidebar (existing — podcast feeds get icon via detection)
├── EntryList (existing — enhanced)
│   └── PodcastEntryItem (new — specialized row)
├── EntryReading (existing — enhanced)
│   └── PodcastPlayer (new — full inline player)
└── PodcastMiniPlayer (new — slim bottom bar)
```

### PodcastEntryItem

Entry list row variant for entries with audio enclosures:
- Duration display (e.g., "42 min")
- Progress bar from `podcast_progress`
- Download status icon (not downloaded / downloading / ready)

### PodcastPlayer (Full In-Reader)

Renders at top of `EntryReading` when viewing a podcast entry:
- Seek bar with drag + tap-to-seek
- Skip back 15s / skip forward 30s
- Speed: tap to cycle presets, dropdown for custom slider (0.5x-3x, 0.05 step)
- Volume control
- Download status + trigger
- "Stop after this episode" toggle
- Show notes / article content renders below

### PodcastMiniPlayer (Bottom Bar)

Fixed bottom bar (~48px), visible when `currentEntry !== null && isMinimized`:
- Artwork thumbnail, title, feed name, current time
- Play/pause, skip forward, dismiss buttons
- Tap title to navigate back to episode in reader
- `backdrop-blur` glassmorphism consistent with app style

### Minimization Logic

- Viewing playing podcast entry → `isMinimized = false` → PodcastPlayer in reader
- Navigate to different entry → `isMinimized = true` → PodcastMiniPlayer at bottom
- Tap mini-player title → navigate to entry → `isMinimized = false`
- Dismiss (x) → playback stops, player hidden

### Sidebar Enhancement

Minimal: podcast-detected feeds get a small podcast icon next to name. No structural changes.

## Section 5: Playback Engine

### Audio Engine Hook: `src/hooks/use-audio-engine.ts`

Mounted once at app root. Owns a persistent `Audio()` object.

- Subscribes to player store actions, translates to `audioRef` operations
- Pushes audio events (`timeupdate`, `ended`, `durationchange`) back to store
- `Audio()` created outside React render cycle — persists across mounts

### Source Resolution

1. Local file exists → `convertFileSrc()` (Tauri asset protocol)
2. No local file → stream from remote `enclosure.url`

### Resume on Play

1. Set currentEntry/Enclosure in store
2. Load speed from feed settings cache
3. Fetch podcast_progress for entry
4. Set `audioRef.src` (local or remote)
5. Set `audioRef.playbackRate`
6. Set `audioRef.currentTime` to saved position
7. `audioRef.play()`

### MediaSession Integration

```typescript
navigator.mediaSession.metadata = new MediaMetadata({
  title: entry.title,
  artist: entry.feed.title,
  artwork: [{ src: feedIconUrl }]
})

navigator.mediaSession.setActionHandler('play', () => store.resume())
navigator.mediaSession.setActionHandler('pause', () => store.pause())
navigator.mediaSession.setActionHandler('seekbackward', () => store.seek(time - 15))
navigator.mediaSession.setActionHandler('seekforward', () => store.seek(time + 30))
navigator.mediaSession.setActionHandler('nexttrack', () => store.playNext())
```

Provides macOS media key support, Touch Bar, AirPods controls, Now Playing widget.

### Speed Persistence

Speed changes are applied to `audioRef.playbackRate` immediately and persisted to `podcast_feed_settings` via mutation. Next episode from same feed auto-loads the saved speed.

## Existing Infrastructure Leveraged

- `podcast_progress` table (already in migrations)
- `enclosures` table with `downloaded`, `local_path`, `download_progress`
- Download manager commands and events
- `DownloadManagerDialog` component
- Feed `no_media_player` flag
- Entry/enclosure sync from Miniflux
