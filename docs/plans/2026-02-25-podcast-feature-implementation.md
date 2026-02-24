# Podcast Feature Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add podcast-aware playback to Minikyu with inline audio player, persistent mini-player, smart auto-downloads, and per-feed speed memory.

**Architecture:** HTML5 Audio + MediaSession API in React for playback. Rust backend handles progress persistence, auto-download scheduling (delegating to existing download infrastructure), and auto-cleanup. Zustand for transient playback state, TanStack Query for persisted podcast data.

**Tech Stack:** Tauri v2, React 19, Zustand v5, TanStack Query, SQLite (sqlx), tauri-specta, Lingui i18n, Framer Motion

**Design doc:** `docs/plans/2026-02-25-podcast-feature-design.md`

---

## Task 1: Database Migration — podcast_feed_settings table + enclosures column

**Files:**
- Modify: `src-tauri/src/database/migrations.rs`

**Step 1: Add migration 4 — podcast_feed_settings table and duration_seconds column**

Add after the existing migration 3 block in `run_migrations()`:

```rust
if !applied_migrations.contains(&4) {
    apply_podcast_settings_migration(pool).await?;
    record_migration(pool, 4, "podcast_feed_settings_and_duration").await?;
}
```

Add the migration function:

```rust
pub(crate) async fn apply_podcast_settings_migration(pool: &SqlitePool) -> Result<(), sqlx::Error> {
    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS podcast_feed_settings (
            feed_id INTEGER PRIMARY KEY,
            auto_download_count INTEGER DEFAULT 3,
            playback_speed REAL DEFAULT 1.0,
            auto_cleanup_days INTEGER DEFAULT 7,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        )
        "#,
    )
    .execute(pool)
    .await?;

    sqlx::query("ALTER TABLE enclosures ADD COLUMN duration_seconds INTEGER")
        .execute(pool)
        .await
        .ok(); // OK if column already exists

    log::info!("Podcast settings migration applied (version 4)");
    Ok(())
}
```

**Step 2: Verify Rust compilation**

Run: `cd src-tauri && cargo build --lib`
Expected: Compiles successfully

**Step 3: Commit**

```
feat(podcast): Add podcast_feed_settings migration and duration_seconds column
```

---

## Task 2: Rust Types — PodcastFeedSettings and PodcastProgress

**Files:**
- Modify: `src-tauri/src/miniflux/types.rs`

**Step 1: Add PodcastFeedSettings struct**

Add after the `DownloadProgress` struct (around line 448):

```rust
/// Per-feed podcast settings
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub struct PodcastFeedSettings {
    #[serde(
        serialize_with = "serialize_i64_as_string",
        deserialize_with = "deserialize_i64_from_string_or_number"
    )]
    #[specta(type = String)]
    pub feed_id: i64,
    pub auto_download_count: i32,
    pub playback_speed: f64,
    pub auto_cleanup_days: i32,
}
```

**Step 2: Add PodcastProgress struct**

```rust
/// Podcast playback progress
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub struct PodcastProgress {
    #[serde(
        serialize_with = "serialize_i64_as_string",
        deserialize_with = "deserialize_i64_from_string_or_number"
    )]
    #[specta(type = String)]
    pub entry_id: i64,
    pub current_time: i32,
    pub total_time: i32,
    pub completed: bool,
    pub last_played_at: String,
}
```

**Step 3: Add CleanupResult struct**

```rust
/// Result of podcast cleanup operation
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub struct CleanupResult {
    pub deleted_count: i32,
    pub freed_bytes: i64,
}
```

**Step 4: Verify Rust compilation**

Run: `cd src-tauri && cargo build --lib`
Expected: Compiles successfully

**Step 5: Commit**

```
feat(podcast): Add PodcastFeedSettings, PodcastProgress, and CleanupResult types
```

---

## Task 3: Rust Commands — podcast.rs module

**Files:**
- Create: `src-tauri/src/commands/podcast.rs`
- Modify: `src-tauri/src/commands/mod.rs` (add `pub mod podcast;`)
- Modify: `src-tauri/src/bindings.rs` (register commands)

**Step 1: Create podcast.rs with all commands**

Create `src-tauri/src/commands/podcast.rs`. Follow the patterns from `downloads.rs` and `miniflux.rs` for AppState access and error handling:

```rust
//! Podcast playback and feed settings management

use crate::miniflux::types::{CleanupResult, PodcastFeedSettings, PodcastProgress};
use crate::AppState;
use chrono::Utc;
use sqlx::Row;

/// Get podcast settings for a feed. Returns defaults if no settings exist.
#[tauri::command]
#[specta::specta]
pub async fn get_podcast_feed_settings(
    app: tauri::AppHandle,
    feed_id: i64,
) -> Result<PodcastFeedSettings, String> {
    let state: tauri::State<'_, AppState> = app.state();
    let pool_lock = state.db_pool.lock().await;
    let pool = pool_lock.as_ref().ok_or("Database not initialized")?;

    let row = sqlx::query(
        "SELECT feed_id, auto_download_count, playback_speed, auto_cleanup_days FROM podcast_feed_settings WHERE feed_id = ?",
    )
    .bind(feed_id)
    .fetch_optional(pool)
    .await
    .map_err(|e| format!("{e}"))?;

    match row {
        Some(row) => Ok(PodcastFeedSettings {
            feed_id: row.get("feed_id"),
            auto_download_count: row.get("auto_download_count"),
            playback_speed: row.get("playback_speed"),
            auto_cleanup_days: row.get("auto_cleanup_days"),
        }),
        None => Ok(PodcastFeedSettings {
            feed_id,
            auto_download_count: 3,
            playback_speed: 1.0,
            auto_cleanup_days: 7,
        }),
    }
}

/// Update podcast settings for a feed (upsert)
#[tauri::command]
#[specta::specta]
pub async fn update_podcast_feed_settings(
    app: tauri::AppHandle,
    feed_id: i64,
    auto_download_count: i32,
    playback_speed: f64,
    auto_cleanup_days: i32,
) -> Result<(), String> {
    let state: tauri::State<'_, AppState> = app.state();
    let pool_lock = state.db_pool.lock().await;
    let pool = pool_lock.as_ref().ok_or("Database not initialized")?;
    let now = Utc::now().to_rfc3339();

    sqlx::query(
        r#"
        INSERT INTO podcast_feed_settings (feed_id, auto_download_count, playback_speed, auto_cleanup_days, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?)
        ON CONFLICT(feed_id) DO UPDATE SET
            auto_download_count = excluded.auto_download_count,
            playback_speed = excluded.playback_speed,
            auto_cleanup_days = excluded.auto_cleanup_days,
            updated_at = excluded.updated_at
        "#,
    )
    .bind(feed_id)
    .bind(auto_download_count)
    .bind(playback_speed)
    .bind(auto_cleanup_days)
    .bind(&now)
    .bind(&now)
    .execute(pool)
    .await
    .map_err(|e| format!("{e}"))?;

    Ok(())
}

/// Save podcast playback progress (upsert)
#[tauri::command]
#[specta::specta]
pub async fn save_podcast_progress(
    app: tauri::AppHandle,
    entry_id: i64,
    current_time: i32,
    total_time: i32,
) -> Result<(), String> {
    let state: tauri::State<'_, AppState> = app.state();
    let pool_lock = state.db_pool.lock().await;
    let pool = pool_lock.as_ref().ok_or("Database not initialized")?;
    let now = Utc::now().to_rfc3339();

    sqlx::query(
        r#"
        INSERT INTO podcast_progress (entry_id, current_time, total_time, completed, last_played_at)
        VALUES (?, ?, ?, FALSE, ?)
        ON CONFLICT(entry_id) DO UPDATE SET
            current_time = excluded.current_time,
            total_time = excluded.total_time,
            last_played_at = excluded.last_played_at
        "#,
    )
    .bind(entry_id)
    .bind(current_time)
    .bind(total_time)
    .bind(&now)
    .execute(pool)
    .await
    .map_err(|e| format!("{e}"))?;

    Ok(())
}

/// Get podcast progress for a single entry
#[tauri::command]
#[specta::specta]
pub async fn get_podcast_progress(
    app: tauri::AppHandle,
    entry_id: i64,
) -> Result<Option<PodcastProgress>, String> {
    let state: tauri::State<'_, AppState> = app.state();
    let pool_lock = state.db_pool.lock().await;
    let pool = pool_lock.as_ref().ok_or("Database not initialized")?;

    let row = sqlx::query(
        "SELECT entry_id, current_time, total_time, completed, last_played_at FROM podcast_progress WHERE entry_id = ?",
    )
    .bind(entry_id)
    .fetch_optional(pool)
    .await
    .map_err(|e| format!("{e}"))?;

    Ok(row.map(|r| PodcastProgress {
        entry_id: r.get("entry_id"),
        current_time: r.get("current_time"),
        total_time: r.get("total_time"),
        completed: r.get("completed"),
        last_played_at: r.get("last_played_at"),
    }))
}

/// Get podcast progress for multiple entries (batch)
#[tauri::command]
#[specta::specta]
pub async fn get_podcast_progress_batch(
    app: tauri::AppHandle,
    entry_ids: Vec<i64>,
) -> Result<Vec<PodcastProgress>, String> {
    if entry_ids.is_empty() {
        return Ok(vec![]);
    }

    let state: tauri::State<'_, AppState> = app.state();
    let pool_lock = state.db_pool.lock().await;
    let pool = pool_lock.as_ref().ok_or("Database not initialized")?;

    let placeholders: Vec<String> = entry_ids.iter().map(|_| "?".to_string()).collect();
    let query_str = format!(
        "SELECT entry_id, current_time, total_time, completed, last_played_at FROM podcast_progress WHERE entry_id IN ({})",
        placeholders.join(",")
    );

    let mut query = sqlx::query(&query_str);
    for id in &entry_ids {
        query = query.bind(id);
    }

    let rows = query.fetch_all(pool).await.map_err(|e| format!("{e}"))?;

    Ok(rows
        .iter()
        .map(|r| PodcastProgress {
            entry_id: r.get("entry_id"),
            current_time: r.get("current_time"),
            total_time: r.get("total_time"),
            completed: r.get("completed"),
            last_played_at: r.get("last_played_at"),
        })
        .collect())
}

/// Mark an episode as completed
#[tauri::command]
#[specta::specta]
pub async fn mark_episode_completed(
    app: tauri::AppHandle,
    entry_id: i64,
) -> Result<(), String> {
    let state: tauri::State<'_, AppState> = app.state();
    let pool_lock = state.db_pool.lock().await;
    let pool = pool_lock.as_ref().ok_or("Database not initialized")?;
    let now = Utc::now().to_rfc3339();

    sqlx::query(
        "UPDATE podcast_progress SET completed = TRUE, last_played_at = ? WHERE entry_id = ?",
    )
    .bind(&now)
    .bind(entry_id)
    .execute(pool)
    .await
    .map_err(|e| format!("{e}"))?;

    Ok(())
}

/// Clean up played podcast episodes older than auto_cleanup_days
#[tauri::command]
#[specta::specta]
pub async fn cleanup_played_episodes(
    app: tauri::AppHandle,
) -> Result<CleanupResult, String> {
    let state: tauri::State<'_, AppState> = app.state();
    let pool_lock = state.db_pool.lock().await;
    let pool = pool_lock.as_ref().ok_or("Database not initialized")?;

    // Find completed episodes past their cleanup threshold
    let rows = sqlx::query(
        r#"
        SELECT e.local_path, e.entry_id
        FROM enclosures e
        JOIN podcast_progress pp ON e.entry_id = pp.entry_id
        JOIN entries ent ON e.entry_id = ent.id
        LEFT JOIN podcast_feed_settings pfs ON ent.feed_id = pfs.feed_id
        WHERE pp.completed = TRUE
          AND e.downloaded = TRUE
          AND e.local_path IS NOT NULL
          AND pp.last_played_at < datetime('now', '-' || COALESCE(pfs.auto_cleanup_days, 7) || ' days')
          AND e.mime_type LIKE 'audio/%'
        "#,
    )
    .fetch_all(pool)
    .await
    .map_err(|e| format!("{e}"))?;

    let mut deleted_count = 0i32;
    let mut freed_bytes = 0i64;

    for row in &rows {
        let local_path: Option<String> = row.get("local_path");
        let entry_id: i64 = row.get("entry_id");

        if let Some(path) = local_path {
            if let Ok(metadata) = std::fs::metadata(&path) {
                freed_bytes += metadata.len() as i64;
            }
            let _ = std::fs::remove_file(&path);
        }

        let _ = sqlx::query(
            "UPDATE enclosures SET downloaded = FALSE, local_path = NULL, download_progress = 0 WHERE entry_id = ? AND mime_type LIKE 'audio/%'",
        )
        .bind(entry_id)
        .execute(pool)
        .await;

        deleted_count += 1;
    }

    log::info!("Podcast cleanup: deleted {deleted_count} episodes, freed {freed_bytes} bytes");

    Ok(CleanupResult {
        deleted_count,
        freed_bytes,
    })
}
```

**Step 2: Register module in mod.rs**

Add `pub mod podcast;` to `src-tauri/src/commands/mod.rs`.

**Step 3: Register commands in bindings.rs**

Add to the `use` import line:
```rust
use crate::commands::{
    accounts, counters, data, downloads, in_app_browser, miniflux, notifications, podcast,
    preferences, quick_pane, reading_state, recovery, sync, translation, translation_cache, tray,
};
```

Add to `collect_commands!` macro:
```rust
podcast::get_podcast_feed_settings,
podcast::update_podcast_feed_settings,
podcast::save_podcast_progress,
podcast::get_podcast_progress,
podcast::get_podcast_progress_batch,
podcast::mark_episode_completed,
podcast::cleanup_played_episodes,
```

**Step 4: Verify Rust compilation**

Run: `cd src-tauri && cargo build --lib`
Expected: Compiles successfully

**Step 5: Regenerate TypeScript bindings**

Run: `bun run codegen:tauri`
Expected: `src/lib/bindings.ts` updated with new podcast commands and types

**Step 6: Commit**

```
feat(podcast): Add podcast Rust commands for progress, settings, and cleanup
```

---

## Task 4: TypeScript Podcast Utilities

**Files:**
- Create: `src/lib/podcast-utils.ts`

**Step 1: Create podcast detection and helper utilities**

```typescript
import type { Entry, Enclosure } from '@/lib/tauri-bindings';

/**
 * Check if a feed is a podcast feed based on its entries.
 * A feed is a podcast when >50% of recent entries have audio enclosures.
 */
export function isPodcastFeed(entries: Entry[]): boolean {
  const recent = entries.slice(0, 20);
  if (recent.length === 0) return false;
  const audioCount = recent.filter((e) =>
    e.enclosures?.some((enc) => enc.mime_type.startsWith('audio/')),
  ).length;
  return audioCount / recent.length > 0.5;
}

/**
 * Get the first audio enclosure from an entry, if any.
 */
export function getPodcastEnclosure(entry: Entry): Enclosure | null {
  return entry.enclosures?.find((enc) => enc.mime_type.startsWith('audio/')) ?? null;
}

/**
 * Check if an entry has a podcast audio enclosure.
 */
export function isPodcastEntry(entry: Entry): boolean {
  return getPodcastEnclosure(entry) !== null;
}

/**
 * Format seconds into human-readable duration (e.g., "42 min", "1h 23m")
 */
export function formatDuration(seconds: number): string {
  if (seconds <= 0) return '';
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes} min`;
}

/**
 * Format seconds into timestamp (e.g., "1:23:45" or "23:45")
 */
export function formatTimestamp(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) {
    return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }
  return `${m}:${String(s).padStart(2, '0')}`;
}

/** Playback speed presets */
export const SPEED_PRESETS = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2] as const;

/** Speed slider range */
export const SPEED_MIN = 0.5;
export const SPEED_MAX = 3;
export const SPEED_STEP = 0.05;
```

**Step 2: Commit**

```
feat(podcast): Add podcast detection utilities and formatting helpers
```

---

## Task 5: TanStack Query Service — podcast.ts

**Files:**
- Create: `src/services/miniflux/podcast.ts`

**Step 1: Create podcast query service**

Follow the pattern from `src/services/miniflux/entries.ts`:

```typescript
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { commands, type PodcastFeedSettings, type PodcastProgress } from '@/lib/tauri-bindings';

export const podcastQueryKeys = {
  all: ['podcast'] as const,
  progress: (entryId: string) => [...podcastQueryKeys.all, 'progress', entryId] as const,
  progressBatch: (ids: string[]) => [...podcastQueryKeys.all, 'progress', 'batch', ...ids] as const,
  feedSettings: (feedId: string) => [...podcastQueryKeys.all, 'feed-settings', feedId] as const,
};

/** Fetch podcast progress for a single entry */
export function usePodcastProgress(entryId: string | undefined) {
  return useQuery({
    queryKey: podcastQueryKeys.progress(entryId ?? ''),
    queryFn: async () => {
      const result = await commands.getPodcastProgress(Number(entryId));
      if (result.status === 'ok') return result.data;
      throw new Error(result.error);
    },
    enabled: !!entryId,
    staleTime: 30_000,
  });
}

/** Fetch podcast progress for multiple entries */
export function usePodcastProgressBatch(entryIds: string[]) {
  return useQuery({
    queryKey: podcastQueryKeys.progressBatch(entryIds),
    queryFn: async () => {
      if (entryIds.length === 0) return [];
      const result = await commands.getPodcastProgressBatch(entryIds.map(Number));
      if (result.status === 'ok') return result.data;
      throw new Error(result.error);
    },
    enabled: entryIds.length > 0,
    staleTime: 30_000,
  });
}

/** Fetch per-feed podcast settings */
export function usePodcastFeedSettings(feedId: string | undefined) {
  return useQuery({
    queryKey: podcastQueryKeys.feedSettings(feedId ?? ''),
    queryFn: async () => {
      const result = await commands.getPodcastFeedSettings(Number(feedId));
      if (result.status === 'ok') return result.data;
      throw new Error(result.error);
    },
    enabled: !!feedId,
    staleTime: 60_000,
  });
}

/** Save podcast progress mutation (called debounced from player) */
export function useSavePodcastProgress() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (params: { entryId: number; currentTime: number; totalTime: number }) => {
      const result = await commands.savePodcastProgress(
        params.entryId,
        params.currentTime,
        params.totalTime,
      );
      if (result.status === 'error') throw new Error(result.error);
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: podcastQueryKeys.progress(String(variables.entryId)),
      });
    },
  });
}

/** Update per-feed podcast settings */
export function useUpdatePodcastFeedSettings() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (params: {
      feedId: number;
      autoDownloadCount: number;
      playbackSpeed: number;
      autoCleanupDays: number;
    }) => {
      const result = await commands.updatePodcastFeedSettings(
        params.feedId,
        params.autoDownloadCount,
        params.playbackSpeed,
        params.autoCleanupDays,
      );
      if (result.status === 'error') throw new Error(result.error);
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: podcastQueryKeys.feedSettings(String(variables.feedId)),
      });
    },
  });
}

/** Mark episode as completed */
export function useMarkEpisodeCompleted() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (entryId: number) => {
      const result = await commands.markEpisodeCompleted(entryId);
      if (result.status === 'error') throw new Error(result.error);
    },
    onSuccess: (_, entryId) => {
      queryClient.invalidateQueries({
        queryKey: podcastQueryKeys.progress(String(entryId)),
      });
    },
  });
}
```

> **Note:** The exact shape of `commands.*` depends on what tauri-specta generates. After Task 3 step 5, check `src/lib/bindings.ts` to confirm the generated function signatures and Result types. You may need to adjust `Number()` conversions for i64 params per the project's i64 serialization pattern (see AGENTS.md "Type-Safe i64 Serialization").

**Step 2: Commit**

```
feat(podcast): Add TanStack Query service for podcast progress and settings
```

---

## Task 6: Zustand Player Store

**Files:**
- Create: `src/store/player-store.ts`

**Step 1: Create player store**

Follow patterns from `src/store/ui-store.ts` and `src/store/reader-store.ts`:

```typescript
import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { logger } from './logger-middleware';
import type { Entry, Enclosure } from '@/lib/tauri-bindings';

interface PlayerState {
  currentEntry: Entry | null;
  currentEnclosure: Enclosure | null;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  buffered: number;
  playbackSpeed: number;
  volume: number;
  isMuted: boolean;
  stopAfterCurrent: boolean;
  isMinimized: boolean;

  play: (entry: Entry, enclosure: Enclosure) => void;
  pause: () => void;
  resume: () => void;
  seek: (time: number) => void;
  setSpeed: (speed: number) => void;
  setVolume: (volume: number) => void;
  toggleMute: () => void;
  toggleStopAfterCurrent: () => void;
  dismiss: () => void;
  setMinimized: (minimized: boolean) => void;

  _updateTime: (time: number) => void;
  _updateDuration: (duration: number) => void;
  _updateBuffered: (time: number) => void;
  _setPlaying: (playing: boolean) => void;
}

export const usePlayerStore = create<PlayerState>()(
  logger(
    devtools(
      (set) => ({
        currentEntry: null,
        currentEnclosure: null,
        isPlaying: false,
        currentTime: 0,
        duration: 0,
        buffered: 0,
        playbackSpeed: 1.0,
        volume: 1.0,
        isMuted: false,
        stopAfterCurrent: false,
        isMinimized: false,

        play: (entry: Entry, enclosure: Enclosure) =>
          set(
            {
              currentEntry: entry,
              currentEnclosure: enclosure,
              isPlaying: true,
              currentTime: 0,
              duration: 0,
              buffered: 0,
              isMinimized: false,
            },
            undefined,
            'play',
          ),

        pause: () => set({ isPlaying: false }, undefined, 'pause'),

        resume: () => set({ isPlaying: true }, undefined, 'resume'),

        seek: (time: number) => set({ currentTime: time }, undefined, 'seek'),

        setSpeed: (speed: number) => set({ playbackSpeed: speed }, undefined, 'setSpeed'),

        setVolume: (volume: number) => set({ volume }, undefined, 'setVolume'),

        toggleMute: () =>
          set((state) => ({ isMuted: !state.isMuted }), undefined, 'toggleMute'),

        toggleStopAfterCurrent: () =>
          set(
            (state) => ({ stopAfterCurrent: !state.stopAfterCurrent }),
            undefined,
            'toggleStopAfterCurrent',
          ),

        dismiss: () =>
          set(
            {
              currentEntry: null,
              currentEnclosure: null,
              isPlaying: false,
              currentTime: 0,
              duration: 0,
              buffered: 0,
              isMinimized: false,
            },
            undefined,
            'dismiss',
          ),

        setMinimized: (minimized: boolean) =>
          set({ isMinimized: minimized }, undefined, 'setMinimized'),

        _updateTime: (time: number) => set({ currentTime: time }, undefined, '_updateTime'),

        _updateDuration: (duration: number) =>
          set({ duration }, undefined, '_updateDuration'),

        _updateBuffered: (time: number) => set({ buffered: time }, undefined, '_updateBuffered'),

        _setPlaying: (playing: boolean) => set({ isPlaying: playing }, undefined, '_setPlaying'),
      }),
      { name: 'player-store' },
    ),
    'player-store',
  ),
);
```

**Step 2: Commit**

```
feat(podcast): Add Zustand player store for podcast playback state
```

---

## Task 7: Audio Engine Hook

**Files:**
- Create: `src/hooks/use-audio-engine.ts`

**Step 1: Create the audio engine hook**

This hook owns a single persistent `Audio()` object and bridges it to the player store. It also handles debounced progress saving, MediaSession integration, and resume-from-position.

```typescript
import { useEffect, useRef } from 'react';
import { convertFileSrc } from '@tauri-apps/api/core';
import { debounce } from 'es-toolkit';
import { usePlayerStore } from '@/store/player-store';
import { commands } from '@/lib/tauri-bindings';
import { getPodcastEnclosure } from '@/lib/podcast-utils';

// Persistent audio element — lives outside React render cycle
const audio = new Audio();

export function useAudioEngine() {
  const saveProgressRef = useRef(
    debounce((entryId: number, currentTime: number, totalTime: number) => {
      commands.savePodcastProgress(entryId, Math.floor(currentTime), Math.floor(totalTime));
    }, 10_000),
  );

  useEffect(() => {
    const store = usePlayerStore;

    // Subscribe to store changes and sync to audio element
    const unsubscribe = store.subscribe((state, prev) => {
      // Play new track
      if (state.currentEnclosure && state.currentEntry &&
          (state.currentEnclosure !== prev.currentEnclosure || !prev.currentEntry)) {
        const enclosure = state.currentEnclosure;

        // Resolve source: local file or remote URL
        // TODO: Check enclosure downloaded/local_path when download integration is complete
        audio.src = enclosure.url;
        audio.playbackRate = state.playbackSpeed;

        // Resume from saved position
        commands.getPodcastProgress(Number(state.currentEntry.id)).then((result) => {
          if (result.status === 'ok' && result.data) {
            audio.currentTime = result.data.current_time;
          }
          audio.play();
        });

        // Update MediaSession
        if ('mediaSession' in navigator) {
          const entry = state.currentEntry;
          navigator.mediaSession.metadata = new MediaMetadata({
            title: entry.title,
            artist: entry.feed.title,
          });
        }
      }

      // Play/pause
      if (state.isPlaying !== prev.isPlaying) {
        if (state.isPlaying && audio.paused && audio.src) {
          audio.play();
        } else if (!state.isPlaying && !audio.paused) {
          audio.pause();
        }
      }

      // Seek
      if (state.currentTime !== prev.currentTime && Math.abs(audio.currentTime - state.currentTime) > 1.5) {
        audio.currentTime = state.currentTime;
      }

      // Speed
      if (state.playbackSpeed !== prev.playbackSpeed) {
        audio.playbackRate = state.playbackSpeed;
      }

      // Volume
      if (state.volume !== prev.volume) {
        audio.volume = state.volume;
      }
      if (state.isMuted !== prev.isMuted) {
        audio.muted = state.isMuted;
      }

      // Dismiss — stop and clear
      if (!state.currentEntry && prev.currentEntry) {
        audio.pause();
        audio.src = '';
        // Flush progress on dismiss
        if (prev.currentEntry) {
          commands.savePodcastProgress(
            Number(prev.currentEntry.id),
            Math.floor(prev.currentTime),
            Math.floor(prev.duration),
          );
        }
      }
    });

    // Audio element events → store
    const onTimeUpdate = () => {
      const state = usePlayerStore.getState();
      state._updateTime(audio.currentTime);

      // Debounced save
      if (state.currentEntry) {
        saveProgressRef.current(
          Number(state.currentEntry.id),
          audio.currentTime,
          audio.duration || 0,
        );
      }
    };

    const onDurationChange = () => {
      usePlayerStore.getState()._updateDuration(audio.duration);
    };

    const onProgress = () => {
      if (audio.buffered.length > 0) {
        usePlayerStore.getState()._updateBuffered(audio.buffered.end(audio.buffered.length - 1));
      }
    };

    const onPlay = () => usePlayerStore.getState()._setPlaying(true);
    const onPause = () => usePlayerStore.getState()._setPlaying(false);

    const onEnded = () => {
      const state = usePlayerStore.getState();
      // Mark completed
      if (state.currentEntry) {
        commands.markEpisodeCompleted(Number(state.currentEntry.id));
      }
      // Auto-play next is handled by the component layer (needs entry list context)
      state.dismiss();
    };

    audio.addEventListener('timeupdate', onTimeUpdate);
    audio.addEventListener('durationchange', onDurationChange);
    audio.addEventListener('progress', onProgress);
    audio.addEventListener('play', onPlay);
    audio.addEventListener('pause', onPause);
    audio.addEventListener('ended', onEnded);

    // MediaSession action handlers
    if ('mediaSession' in navigator) {
      navigator.mediaSession.setActionHandler('play', () => usePlayerStore.getState().resume());
      navigator.mediaSession.setActionHandler('pause', () => usePlayerStore.getState().pause());
      navigator.mediaSession.setActionHandler('seekbackward', () => {
        const t = usePlayerStore.getState().currentTime;
        usePlayerStore.getState().seek(Math.max(0, t - 15));
      });
      navigator.mediaSession.setActionHandler('seekforward', () => {
        const { currentTime: t, duration: d } = usePlayerStore.getState();
        usePlayerStore.getState().seek(Math.min(d, t + 30));
      });
    }

    return () => {
      unsubscribe();
      audio.removeEventListener('timeupdate', onTimeUpdate);
      audio.removeEventListener('durationchange', onDurationChange);
      audio.removeEventListener('progress', onProgress);
      audio.removeEventListener('play', onPlay);
      audio.removeEventListener('pause', onPause);
      audio.removeEventListener('ended', onEnded);
    };
  }, []);
}
```

> **Note:** The exact import path for `convertFileSrc` depends on Tauri v2 — verify in `@tauri-apps/api/core`. The local file resolution (checking `enclosure.downloaded` and `enclosure.local_path`) will be wired up in a later task when download integration is added.

**Step 2: Commit**

```
feat(podcast): Add audio engine hook with MediaSession and progress persistence
```

---

## Task 8: Mount Audio Engine in App

**Files:**
- Modify: `src/components/miniflux/MinifluxLayout.tsx` (or wherever app root is)

**Step 1: Find the correct mounting point**

Read `src/components/miniflux/MinifluxLayout.tsx` to find where to add the hook call. The audio engine must be mounted once at a top level that persists.

**Step 2: Add hook call**

At the top of the component body:

```typescript
import { useAudioEngine } from '@/hooks/use-audio-engine';

// Inside MinifluxLayout component:
useAudioEngine();
```

**Step 3: Verify TypeScript compiles**

Run: `bun run typecheck`
Expected: No errors

**Step 4: Commit**

```
feat(podcast): Mount audio engine in MinifluxLayout
```

---

## Task 9: PodcastMiniPlayer Component

**Files:**
- Create: `src/components/podcast/PodcastMiniPlayer.tsx`

**Step 1: Create the mini-player bottom bar**

This is the slim persistent bar (~48px) that shows when audio is playing and user navigates away from the podcast entry. Use Lingui for all text, Framer Motion for enter/exit animation, and the project's Tailwind patterns.

Key behaviors:
- Visible when `currentEntry !== null && isMinimized === true`
- Shows: podcast icon, entry title, feed name, current time, play/pause button, skip forward button, dismiss button
- Tap title area → calls `setSelectedEntryId(currentEntry.id)` and `setMinimized(false)` to navigate to the entry
- `backdrop-blur` glassmorphism styling
- Fixed to bottom of window, spans full width

Use selectors for all store access:
```typescript
const currentEntry = usePlayerStore((s) => s.currentEntry);
const isMinimized = usePlayerStore((s) => s.isMinimized);
const isPlaying = usePlayerStore((s) => s.isPlaying);
const currentTime = usePlayerStore((s) => s.currentTime);
```

**Step 2: Add i18n strings**

Wrap all user-facing text with `_(msg`...`)`:
- "Now playing" label
- Tooltip for play/pause, skip, dismiss buttons

**Step 3: Run i18n extraction**

Run: `bun run i18n:extract`

**Step 4: Commit**

```
feat(podcast): Add PodcastMiniPlayer bottom bar component
```

---

## Task 10: PodcastPlayer Component (Full In-Reader)

**Files:**
- Create: `src/components/podcast/PodcastPlayer.tsx`

**Step 1: Create the full podcast player**

This renders at the top of `EntryReading` when viewing a podcast entry. Full-featured player with:

- Seek bar (range input or custom drag implementation)
- Current time / total time display using `formatTimestamp`
- Skip back 15s / skip forward 30s buttons
- Play/pause button
- Speed control: display current speed, tap to cycle presets, dropdown or popover for custom slider (0.5x-3x, step 0.05)
- Volume slider
- "Stop after this episode" toggle
- Download status badge (integrate with existing download infrastructure later)

Speed persistence: when user changes speed, call `useUpdatePodcastFeedSettings` with the new speed for the current feed.

All Lingui i18n for labels and tooltips.

**Step 2: Run i18n extraction**

Run: `bun run i18n:extract`

**Step 3: Commit**

```
feat(podcast): Add PodcastPlayer full in-reader component
```

---

## Task 11: Wire Player into EntryReading

**Files:**
- Modify: `src/components/miniflux/EntryReading.tsx`

**Step 1: Read the current EntryReading component**

Understand the structure and find where to inject the PodcastPlayer.

**Step 2: Add PodcastPlayer at the top of the reader content area**

- Import `getPodcastEnclosure` from `@/lib/podcast-utils`
- Import `PodcastPlayer` from `@/components/podcast/PodcastPlayer`
- When the current entry has a podcast enclosure, render `<PodcastPlayer entry={entry} enclosure={enclosure} />` above the article content
- This should be inside the scroll area, above `<SafeHtml>`

**Step 3: Wire minimization logic**

- Import `usePlayerStore` and `useUIStore`
- When `selectedEntryId` changes AND the player has a `currentEntry`:
  - If `selectedEntryId === currentEntry.id` → `setMinimized(false)`
  - If `selectedEntryId !== currentEntry.id` → `setMinimized(true)`

**Step 4: Verify TypeScript compiles**

Run: `bun run typecheck`

**Step 5: Commit**

```
feat(podcast): Wire PodcastPlayer into EntryReading with minimization logic
```

---

## Task 12: Mount PodcastMiniPlayer in Layout

**Files:**
- Modify: `src/components/miniflux/MinifluxLayout.tsx` or `src/components/layout/MainWindowContent.tsx`

**Step 1: Read layout components to find the right mounting point**

The mini-player should render as a fixed bottom bar outside the three-column layout.

**Step 2: Add PodcastMiniPlayer**

Import and render `<PodcastMiniPlayer />` as a sibling after the main layout content, positioned with `fixed bottom-0` or as the last child in a flex column.

**Step 3: Verify no layout shift**

The mini-player should not push the main content up. If using fixed positioning, add bottom padding to the main layout when mini-player is visible.

**Step 4: Commit**

```
feat(podcast): Mount PodcastMiniPlayer in app layout
```

---

## Task 13: Entry List Podcast Rendering

**Files:**
- Modify: `src/components/miniflux/EntryList.tsx`
- Create: `src/components/podcast/PodcastEntryItem.tsx` (optional — may be inline)

**Step 1: Read EntryList.tsx to understand current row rendering**

**Step 2: Add podcast detection to entry rows**

For entries where `getPodcastEnclosure(entry)` returns non-null:
- Show duration badge (from `enclosure.length` or `podcast_progress.total_time`)
- Show progress bar if `podcast_progress` exists
- Show download status icon
- Add a play button that calls `usePlayerStore.getState().play(entry, enclosure)`

**Step 3: Batch-fetch progress for visible entries**

Use `usePodcastProgressBatch()` with the IDs of visible podcast entries to show progress bars efficiently.

**Step 4: i18n extraction**

Run: `bun run i18n:extract`

**Step 5: Commit**

```
feat(podcast): Add podcast-aware rendering to entry list
```

---

## Task 14: Sidebar Podcast Feed Icon

**Files:**
- Modify: `src/components/layout/AppSidebar.tsx`

**Step 1: Read AppSidebar to understand feed rendering**

**Step 2: Add podcast icon to detected podcast feeds**

Where feed names are rendered, check if the feed's entries indicate it's a podcast (using cached entry data or a derived flag). If yes, prepend a small podcast/microphone icon.

Keep this minimal — just an icon, no structural changes.

**Step 3: Commit**

```
feat(podcast): Add podcast icon to detected podcast feeds in sidebar
```

---

## Task 15: Auto-Download Post-Sync Integration

**Files:**
- Modify: `src-tauri/src/commands/sync.rs`
- Modify: `src-tauri/src/commands/podcast.rs` (add auto-download function)

**Step 1: Add auto-download orchestration function to podcast.rs**

Create a non-command helper function `run_podcast_auto_downloads` that:
1. Queries all feeds with `podcast_feed_settings`
2. For each, finds the latest N unplayed entries with audio enclosures not yet downloaded
3. Calls `crate::commands::downloads::download_file` for each

**Step 2: Call from sync completion**

At the end of `sync_miniflux` in `sync.rs`, after sync completes successfully, spawn the auto-download + cleanup tasks:

```rust
// Post-sync podcast tasks (fire and forget)
let app_clone = app.clone();
tokio::spawn(async move {
    let _ = crate::commands::podcast::run_podcast_auto_downloads(&app_clone).await;
    let _ = crate::commands::podcast::cleanup_played_episodes(app_clone).await;
});
```

**Step 3: Verify Rust compilation**

Run: `cd src-tauri && cargo build --lib`

**Step 4: Commit**

```
feat(podcast): Add auto-download and cleanup post-sync integration
```

---

## Task 16: Verification & Polish

**Step 1: Run full quality gates**

Run: `bun run check:all`
Expected: All checks pass (typecheck, clippy, cargo test, cargo fmt, biome)

**Step 2: Run i18n extraction one final time**

Run: `bun run i18n:extract && bun run i18n:compile`

**Step 3: Verify app launches**

Run: `bun run dev`
Expected: App starts without errors

**Step 4: Manual testing checklist**

- [ ] Add a podcast feed via Miniflux
- [ ] Sync and verify podcast entries appear with duration badges
- [ ] Tap play on a podcast entry — audio starts
- [ ] Verify seek bar, skip forward/back work
- [ ] Change playback speed — verify audio speed changes
- [ ] Navigate to different entry — verify mini-player appears
- [ ] Tap mini-player title — navigates back to podcast entry
- [ ] Pause, close app, reopen — verify resume from last position
- [ ] Verify macOS media keys (play/pause) work
- [ ] Dismiss player — verify audio stops and player disappears

**Step 5: Final commit**

```
feat(podcast): Polish and verification pass
```
