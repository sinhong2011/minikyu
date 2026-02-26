# Podcast Player Window Design

## Overview

Replace the current in-window floating overlay (PodcastMiniPlayer.tsx) with a dedicated always-on-top Tauri window using the NSPanel pattern. The player window acts as a remote control — the audio engine stays in the main window and communicates via Tauri events.

## Architecture

### Window Management

- New `player_window.rs` module following `quick_pane.rs` pattern
- NSPanel on macOS (non-activating, always-on-top, vibrancy)
- Always-on-top regular window on Linux/Windows
- Window size: ~320×360px, decorationless, resizable within bounds
- Tauri commands: `show_player_window()`, `hide_player_window()`, `toggle_player_window()`
- Closing the window hides it (not destroyed) — re-shown instantly
- Window position persisted via localStorage in the player window

### Titlebar Pill Integration

- `TitleBarPodcastAnchor` click calls `commands.togglePlayerWindow()` instead of `setDockedToTitlebar`
- Pill continues to show artwork, title, time, play/pause inline

## State Synchronization

### Main Window → Player Window (State Broadcast)

Events emitted by audio engine on state changes:

- `player:state-update` — batched payload every ~250ms:
  ```typescript
  { currentTime, duration, buffered, isPlaying, isBuffering, playbackSpeed, volume, isMuted }
  ```
- `player:track-change` — on track load:
  ```typescript
  { entry, enclosure, artworkUrl, queue: UpNextEntry[] }
  ```
- `player:dismissed` — playback ended or stopped

### Player Window → Main Window (Commands)

Single event type with action discriminator:

- `player:cmd` with payload:
  ```typescript
  { action: 'play' | 'pause' | 'seek' | 'skip-forward' | 'skip-back' | 'set-speed' | 'set-volume' | 'toggle-mute' | 'play-entry', value?: number | string }
  ```

### Queue Data

- On track change, main window resolves next N podcast entries from same feed
- Included in `player:track-change` event payload
- Player window renders scrollable queue list
- Queue item click sends `player:cmd { action: 'play-entry', value: entryId }`

## Player Window UI

Layout: three stacked zones in ~320×360px window.

### Header (~60px)
- Drag handle area (entire header is draggable)
- Artwork thumbnail (40×40 rounded)
- Track title (truncated), feed name
- Close button (hides window)

### Controls (~100px)
- Full-width progress slider with current/remaining time
- Transport: skip back 15s, play/pause (large), skip forward 30s
- Speed selector, volume slider

### Up-Next Queue (~200px, scrollable)
- "Up Next" section label
- Episode rows: thumbnail, title, duration
- Click to play, currently-playing highlight
- Empty state: "No more episodes"

### Styling
- App theme (dark/light via CSS variables)
- Semi-transparent background with blur (macOS vibrancy)
- Compact typography (11-12px)

## Component Structure

- `src/pages/PlayerWindow.tsx` — Root page at `/player` route
- `src/components/podcast/PlayerWindowControls.tsx` — Transport controls
- `src/components/podcast/PlayerWindowQueue.tsx` — Up-next list
- `src-tauri/src/commands/player_window.rs` — Window create/show/hide/toggle

## Decisions

- Audio engine stays in main window (no Rust-side audio)
- Player window is a pure remote control (local React state from events, no Zustand)
- NSPanel pattern reused from quick-pane for macOS
- Hybrid lifecycle: player window independent but main window pill toggles visibility
