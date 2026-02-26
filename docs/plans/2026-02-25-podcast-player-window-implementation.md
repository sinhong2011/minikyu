# Podcast Player Window Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the in-window floating podcast overlay with a dedicated always-on-top Tauri NSPanel window that acts as a remote control for the audio engine in the main window.

**Architecture:** The audio engine singleton stays in the main window. A new Tauri window (NSPanel on macOS, always-on-top on other platforms) loads a dedicated HTML entry point (`player-window.html`) with its own React root. The main window broadcasts player state via Tauri events; the player window sends commands back via events. The titlebar pill toggles the player window visibility.

**Tech Stack:** Tauri v2 (NSPanel via tauri_nspanel), React 19, Zustand (main window only), Tauri events (`emit`/`listen`), Vite multi-page build, Lingui i18n, Tailwind v4, shadcn/ui v4, HugeIcons

---

## Reference Files

These files contain patterns you'll follow. Read them before starting each task:

| Pattern | File | Lines |
|---------|------|-------|
| NSPanel window creation | `src-tauri/src/commands/quick_pane.rs` | All |
| Window init at startup | `src-tauri/src/lib.rs` | 250-258 |
| Command registration | `src-tauri/src/bindings.rs` | All |
| Module exports | `src-tauri/src/commands/mod.rs` | All |
| Capability file | `src-tauri/capabilities/quick-pane.json` | All |
| Multi-page Vite config | `vite.config.ts` | 29-36 |
| Secondary HTML entry | `quick-pane.html` | All |
| Secondary React entry | `src/quick-pane-main.tsx` | All |
| Event listen pattern | `src/hooks/use-sync-progress-listener.ts` | 22-96 |
| Event emit pattern | `src-tauri/src/commands/tray.rs` | 227-241 |
| Player store | `src/store/player-store.ts` | All |
| Audio engine | `src/hooks/use-audio-engine.ts` | All |
| Current floating player UI | `src/components/podcast/PodcastMiniPlayer.tsx` | All |
| Titlebar pill | `src/components/titlebar/TitleBarPodcastAnchor.tsx` | All |
| i18n pattern | AGENTS.md → Internationalization section |

---

## Task 1: Create the Rust player_window module

**Files:**
- Create: `src-tauri/src/commands/player_window.rs`
- Modify: `src-tauri/src/commands/mod.rs`
- Modify: `src-tauri/src/bindings.rs`

**Step 1: Create player_window.rs**

Follow `quick_pane.rs` as template. Key differences: always enabled (no feature flag), different dimensions (320×360), different label, resizable within bounds, loads `player-window.html`.

```rust
//! Podcast player window management commands.
//!
//! The player window is a floating panel (NSPanel on macOS, always-on-top window elsewhere)
//! that provides podcast playback controls and queue in a dedicated window.

use tauri::{AppHandle, Manager, WebviewUrl};

// ============================================================================
// Constants
// ============================================================================

/// Window label for the player window
const PLAYER_WINDOW_LABEL: &str = "player-window";

/// Player window dimensions
const PLAYER_WINDOW_WIDTH: f64 = 320.0;
const PLAYER_WINDOW_HEIGHT: f64 = 360.0;
const PLAYER_WINDOW_MIN_WIDTH: f64 = 280.0;
const PLAYER_WINDOW_MIN_HEIGHT: f64 = 300.0;

// ============================================================================
// macOS-specific: NSPanel support
// ============================================================================

#[cfg(target_os = "macos")]
use tauri_nspanel::{
    tauri_panel, CollectionBehavior, ManagerExt, PanelBuilder, PanelLevel, StyleMask,
};

#[cfg(target_os = "macos")]
tauri_panel! {
    panel!(PlayerWindowPanel {
        config: {
            can_become_key_window: true,
            can_become_main_window: false,
            is_floating_panel: true
        }
    })
}

// ============================================================================
// Window Initialization
// ============================================================================

/// Creates the player window at app startup (hidden).
/// Must be called from the main thread (e.g., in setup()).
pub fn init_player_window(app: &AppHandle) -> Result<(), String> {
    #[cfg(target_os = "macos")]
    {
        init_player_window_macos(app)
    }

    #[cfg(not(target_os = "macos"))]
    {
        init_player_window_standard(app)
    }
}

#[cfg(target_os = "macos")]
fn init_player_window_macos(app: &AppHandle) -> Result<(), String> {
    use tauri::{LogicalSize, Size};

    log::debug!("Creating player window as NSPanel (macOS)");

    let panel = PanelBuilder::<_, PlayerWindowPanel>::new(app, PLAYER_WINDOW_LABEL)
        .url(WebviewUrl::App("player-window.html".into()))
        .title("Player")
        .size(Size::Logical(LogicalSize::new(
            PLAYER_WINDOW_WIDTH,
            PLAYER_WINDOW_HEIGHT,
        )))
        .level(PanelLevel::Floating)
        .transparent(true)
        .has_shadow(true)
        .collection_behavior(
            CollectionBehavior::new()
                .full_screen_auxiliary()
                .can_join_all_spaces(),
        )
        .style_mask(StyleMask::empty().nonactivating_panel())
        .hides_on_deactivate(false)
        .works_when_modal(true)
        .with_window(|w| {
            w.decorations(false)
                .transparent(true)
                .skip_taskbar(true)
                .visible(false)
                .resizable(true)
                .min_inner_size(PLAYER_WINDOW_MIN_WIDTH, PLAYER_WINDOW_MIN_HEIGHT)
                .center()
        })
        .build()
        .map_err(|e| format!("Failed to create player window panel: {e}"))?;

    panel.hide();
    log::info!("Player window NSPanel created (hidden)");
    Ok(())
}

#[cfg(not(target_os = "macos"))]
fn init_player_window_standard(app: &AppHandle) -> Result<(), String> {
    use tauri::webview::WebviewWindowBuilder;

    log::debug!("Creating player window as standard window");

    WebviewWindowBuilder::new(
        app,
        PLAYER_WINDOW_LABEL,
        WebviewUrl::App("player-window.html".into()),
    )
    .title("Player")
    .inner_size(PLAYER_WINDOW_WIDTH, PLAYER_WINDOW_HEIGHT)
    .min_inner_size(PLAYER_WINDOW_MIN_WIDTH, PLAYER_WINDOW_MIN_HEIGHT)
    .always_on_top(true)
    .skip_taskbar(true)
    .decorations(false)
    .transparent(true)
    .visible(false)
    .resizable(true)
    .center()
    .build()
    .map_err(|e| format!("Failed to create player window: {e}"))?;

    log::info!("Player window created (hidden)");
    Ok(())
}

// ============================================================================
// Window Visibility
// ============================================================================

fn is_player_window_visible(app: &AppHandle) -> bool {
    #[cfg(target_os = "macos")]
    {
        app.get_webview_panel(PLAYER_WINDOW_LABEL)
            .map(|panel| panel.is_visible())
            .unwrap_or(false)
    }

    #[cfg(not(target_os = "macos"))]
    {
        app.get_webview_window(PLAYER_WINDOW_LABEL)
            .and_then(|window| window.is_visible().ok())
            .unwrap_or(false)
    }
}

#[tauri::command]
#[specta::specta]
pub fn show_player_window(app: AppHandle) -> Result<(), String> {
    log::info!("Showing player window");

    #[cfg(target_os = "macos")]
    {
        let panel = app
            .get_webview_panel(PLAYER_WINDOW_LABEL)
            .map_err(|e| format!("Player window panel not found: {e:?}"))?;
        panel.show_and_make_key();
        log::debug!("Player window panel shown (macOS)");
    }

    #[cfg(not(target_os = "macos"))]
    {
        let window = app
            .get_webview_window(PLAYER_WINDOW_LABEL)
            .ok_or_else(|| {
                "Player window not found - was init_player_window called at startup?".to_string()
            })?;
        window
            .show()
            .map_err(|e| format!("Failed to show window: {e}"))?;
        window
            .set_focus()
            .map_err(|e| format!("Failed to focus window: {e}"))?;
        log::debug!("Player window shown");
    }

    Ok(())
}

#[tauri::command]
#[specta::specta]
pub fn hide_player_window(app: AppHandle) -> Result<(), String> {
    #[cfg(target_os = "macos")]
    {
        if let Ok(panel) = app.get_webview_panel(PLAYER_WINDOW_LABEL) {
            if !panel.is_visible() {
                return Ok(());
            }
            log::info!("Hiding player window");
            panel.resign_key_window();
            panel.hide();
            log::debug!("Player window panel hidden (macOS)");
        }
    }

    #[cfg(not(target_os = "macos"))]
    {
        if let Some(window) = app.get_webview_window(PLAYER_WINDOW_LABEL) {
            let is_visible = window.is_visible().unwrap_or(false);
            if !is_visible {
                return Ok(());
            }
            log::info!("Hiding player window");
            window
                .hide()
                .map_err(|e| format!("Failed to hide window: {e}"))?;
            log::debug!("Player window hidden");
        }
    }

    Ok(())
}

#[tauri::command]
#[specta::specta]
pub fn toggle_player_window(app: AppHandle) -> Result<(), String> {
    log::info!("Toggling player window");

    if is_player_window_visible(&app) {
        hide_player_window(app)
    } else {
        show_player_window(app)
    }
}
```

**Step 2: Register module in `src-tauri/src/commands/mod.rs`**

Add after the `podcast` line:

```rust
pub mod player_window;
```

**Step 3: Register commands in `src-tauri/src/bindings.rs`**

Add `player_window` to the imports at the top, and add these commands to the `collect_commands!` macro:

```rust
player_window::show_player_window,
player_window::hide_player_window,
player_window::toggle_player_window,
```

**Step 4: Initialize window in `src-tauri/src/lib.rs`**

Add after the quick pane init block (after line 258):

```rust
// Create the player window (hidden) - must be done on main thread
if let Err(e) = commands::player_window::init_player_window(app.handle()) {
    log::error!("Failed to create player window: {e}");
    // Non-fatal: app can still run without player window
}
```

**Step 5: Verify Rust compilation**

Run: `cd src-tauri && cargo build --lib`
Expected: Successful compilation with no errors.

**Step 6: Regenerate TypeScript bindings**

Run: `bun run codegen:tauri`
Expected: `src/lib/bindings.ts` updated with `showPlayerWindow`, `hidePlayerWindow`, `togglePlayerWindow`.

**Step 7: Commit**

```bash
git add src-tauri/src/commands/player_window.rs src-tauri/src/commands/mod.rs src-tauri/src/bindings.rs src-tauri/src/lib.rs src/lib/bindings.ts
git commit -m "feat(player): Add player window Rust module with NSPanel support"
```

---

## Task 2: Create capability file and frontend entry point

**Files:**
- Create: `src-tauri/capabilities/player-window.json`
- Create: `player-window.html`
- Create: `src/player-window-main.tsx`
- Create: `src/pages/PlayerWindow.tsx`
- Modify: `vite.config.ts`

**Step 1: Create capability file**

Follow `quick-pane.json` pattern:

```json
{
  "$schema": "../gen/schemas/desktop-schema.json",
  "identifier": "player-window-capability",
  "description": "Capability for the podcast player floating window",
  "windows": ["player-window"],
  "permissions": [
    "core:default",
    "core:window:allow-show",
    "core:window:allow-hide",
    "core:window:allow-set-focus",
    "core:window:allow-is-visible",
    "core:window:allow-start-dragging",
    "core:event:default",
    "core:event:allow-emit",
    "log:default"
  ]
}
```

**Step 2: Create `player-window.html`**

Follow `quick-pane.html` pattern:

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/svg+xml" href="/vite.svg" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Player</title>
  </head>

  <body>
    <div id="root"></div>
    <script type="module" src="/src/player-window-main.tsx"></script>
  </body>
</html>
```

**Step 3: Create `src/player-window-main.tsx`**

Follow `src/quick-pane-main.tsx` pattern:

```tsx
import { i18n } from '@lingui/core';
import { I18nProvider } from '@lingui/react';
import ReactDOM from 'react-dom/client';
import { defaultLocale, loadAndActivate } from '@/i18n/config';
import { PlayerWindow } from '@/pages/PlayerWindow';
import '@/styles/global.css';

loadAndActivate(defaultLocale);

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <I18nProvider i18n={i18n}>
    <PlayerWindow />
  </I18nProvider>
);
```

**Step 4: Create placeholder `src/pages/PlayerWindow.tsx`**

```tsx
export function PlayerWindow() {
  return (
    <div className="flex h-screen items-center justify-center bg-background text-foreground">
      <p className="text-sm text-muted-foreground">Player window loading...</p>
    </div>
  );
}
```

**Step 5: Add to Vite rollupOptions in `vite.config.ts`**

In the `build.rollupOptions.input` object, add:

```typescript
'player-window': resolve(__dirname, 'player-window.html'),
```

**Step 6: Verify build**

Run: `cd src-tauri && cargo build --lib`
Expected: Compiles successfully.

**Step 7: Commit**

```bash
git add src-tauri/capabilities/player-window.json player-window.html src/player-window-main.tsx src/pages/PlayerWindow.tsx vite.config.ts
git commit -m "feat(player): Add player window frontend entry point and capability"
```

---

## Task 3: Add event bridge — main window broadcasts state

**Files:**
- Create: `src/lib/player-events.ts`
- Modify: `src/hooks/use-audio-engine.ts`

**Step 1: Create shared event type definitions**

Create `src/lib/player-events.ts` with the event type constants and payload types shared between both windows:

```typescript
import type { Enclosure, Entry } from '@/lib/tauri-bindings';

// Event names
export const PLAYER_STATE_UPDATE = 'player:state-update';
export const PLAYER_TRACK_CHANGE = 'player:track-change';
export const PLAYER_DISMISSED = 'player:dismissed';
export const PLAYER_CMD = 'player:cmd';

// Payloads
export interface PlayerStatePayload {
  currentTime: number;
  duration: number;
  buffered: number;
  isPlaying: boolean;
  isBuffering: boolean;
  playbackSpeed: number;
  volume: number;
  isMuted: boolean;
}

export interface UpNextEntry {
  id: string;
  title: string;
  duration: number;
  artworkUrl: string | null;
}

export interface PlayerTrackPayload {
  entry: Entry;
  enclosure: Enclosure;
  artworkUrl: string | null;
  queue: UpNextEntry[];
}

export type PlayerCmdAction =
  | 'play'
  | 'pause'
  | 'seek'
  | 'skip-forward'
  | 'skip-back'
  | 'set-speed'
  | 'set-volume'
  | 'toggle-mute'
  | 'play-entry'
  | 'dismiss';

export interface PlayerCmdPayload {
  action: PlayerCmdAction;
  value?: number | string;
}
```

**Step 2: Add state broadcasting to the audio engine**

In `src/hooks/use-audio-engine.ts`, import the event types and `emit` from Tauri, then add a throttled broadcast function inside the `useEffect`. The broadcast is called from the existing `onTimeUpdate` handler and the store subscription.

At the top of the file, add:

```typescript
import { emit } from '@tauri-apps/api/event';
import { throttle } from 'es-toolkit';
import {
  PLAYER_DISMISSED,
  PLAYER_STATE_UPDATE,
  PLAYER_TRACK_CHANGE,
  type PlayerStatePayload,
  type PlayerTrackPayload,
} from '@/lib/player-events';
```

Inside the `useEffect`, after `const audio = runtime.audio;`, add:

```typescript
const broadcastState = throttle(() => {
  const s = usePlayerStore.getState();
  const payload: PlayerStatePayload = {
    currentTime: s.currentTime,
    duration: s.duration,
    buffered: s.buffered,
    isPlaying: s.isPlaying,
    isBuffering: s.isBuffering,
    playbackSpeed: s.playbackSpeed,
    volume: s.volume,
    isMuted: s.isMuted,
  };
  emit(PLAYER_STATE_UPDATE, payload).catch(() => {});
}, 250);

const broadcastTrackChange = (artworkUrl: string | null) => {
  const s = usePlayerStore.getState();
  if (!s.currentEntry || !s.currentEnclosure) return;
  const payload: PlayerTrackPayload = {
    entry: s.currentEntry,
    enclosure: s.currentEnclosure,
    artworkUrl,
    queue: [], // Queue will be populated in a later task
  };
  emit(PLAYER_TRACK_CHANGE, payload).catch(() => {});
};

const broadcastDismiss = () => {
  emit(PLAYER_DISMISSED, {}).catch(() => {});
};
```

Then wire them up:

1. At the end of `onTimeUpdate` (after `saveProgressRef.current(...)` call), add: `broadcastState();`
2. In the store subscription, after `navigator.mediaSession.metadata = ...` (line ~237), add: `broadcastTrackChange(null);` (artwork URL resolved later)
3. In the store subscription dismiss block (after `clearAudioSource(audio)` around line ~286), add: `broadcastDismiss();`
4. In `onPlaying`, `onPause`, `onDurationChange` handlers, add: `broadcastState();`
5. In the teardown function, add: `broadcastState.cancel();`

**Step 3: Verify TypeScript**

Run: `bun run typecheck`
Expected: No errors.

**Step 4: Run tests**

Run: `bun run test`
Expected: All existing tests pass. The emit calls use `.catch(() => {})` so they won't break in test environments where Tauri isn't available.

**Step 5: Commit**

```bash
git add src/lib/player-events.ts src/hooks/use-audio-engine.ts
git commit -m "feat(player): Add event bridge for cross-window state broadcast"
```

---

## Task 4: Add event bridge — main window listens for commands

**Files:**
- Create: `src/hooks/use-player-command-listener.ts`
- Modify: `src/components/layout/MainWindowContent.tsx` (or wherever `useAudioEngine` is mounted)

**Step 1: Create command listener hook**

Create `src/hooks/use-player-command-listener.ts`:

```typescript
import { listen } from '@tauri-apps/api/event';
import { useEffect } from 'react';
import { PLAYER_CMD, type PlayerCmdPayload } from '@/lib/player-events';
import { usePlayerStore } from '@/store/player-store';

export function usePlayerCommandListener() {
  useEffect(() => {
    const unlisten = listen<PlayerCmdPayload>(PLAYER_CMD, (event) => {
      const { action, value } = event.payload;
      const store = usePlayerStore.getState();

      switch (action) {
        case 'play':
          store.resume();
          break;
        case 'pause':
          store.pause();
          break;
        case 'seek':
          if (typeof value === 'number') store.seek(value);
          break;
        case 'skip-forward':
          store.seek(Math.min(store.duration, store.currentTime + 30));
          break;
        case 'skip-back':
          store.seek(Math.max(0, store.currentTime - 15));
          break;
        case 'set-speed':
          if (typeof value === 'number') store.setSpeed(value);
          break;
        case 'set-volume':
          if (typeof value === 'number') store.setVolume(value);
          break;
        case 'toggle-mute':
          store.toggleMute();
          break;
        case 'dismiss':
          store.dismiss();
          break;
        case 'play-entry':
          // Will be implemented when queue support is added
          break;
      }
    });

    return () => {
      unlisten.then((fn) => fn());
    };
  }, []);
}
```

**Step 2: Mount the listener in main window**

Find where `useAudioEngine()` is called (likely `MainWindowContent.tsx` or a parent component). Add `usePlayerCommandListener()` next to it.

```typescript
import { usePlayerCommandListener } from '@/hooks/use-player-command-listener';

// Inside the component:
usePlayerCommandListener();
```

**Step 3: Verify TypeScript**

Run: `bun run typecheck`
Expected: No errors.

**Step 4: Commit**

```bash
git add src/hooks/use-player-command-listener.ts src/components/layout/MainWindowContent.tsx
git commit -m "feat(player): Add command listener for player window remote control"
```

---

## Task 5: Build the player window UI

**Files:**
- Create: `src/components/podcast/PlayerWindowControls.tsx`
- Create: `src/components/podcast/PlayerWindowQueue.tsx`
- Modify: `src/pages/PlayerWindow.tsx`

**Step 1: Create PlayerWindowControls**

This component receives state as props (no Zustand — this runs in the player window which has no store). It emits Tauri events for user actions.

```tsx
import {
  GoBackward15SecIcon,
  GoForward30SecIcon,
  Loading03Icon,
  PauseIcon,
  PlayIcon,
  StopCircleIcon,
} from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react';
import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { emit } from '@tauri-apps/api/event';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { PLAYER_CMD, type PlayerCmdPayload } from '@/lib/player-events';
import { formatTimestamp } from '@/lib/podcast-utils';

interface PlayerWindowControlsProps {
  currentTime: number;
  duration: number;
  buffered: number;
  isPlaying: boolean;
  isBuffering: boolean;
  playbackSpeed: number;
}

function sendCmd(action: PlayerCmdPayload['action'], value?: number | string) {
  emit(PLAYER_CMD, { action, value } satisfies PlayerCmdPayload).catch(() => {});
}

export function PlayerWindowControls({
  currentTime,
  duration,
  buffered,
  isPlaying,
  isBuffering,
  playbackSpeed,
}: PlayerWindowControlsProps) {
  const { _ } = useLingui();
  const [isSeeking, setIsSeeking] = useState(false);
  const [seekValue, setSeekValue] = useState(0);

  const bufferingActive = isBuffering && isPlaying;
  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;
  const bufferedProgress = duration > 0 ? Math.max(0, Math.min(100, (buffered / duration) * 100)) : 0;
  const displayTime = isSeeking && duration > 0 ? (seekValue / 100) * duration : currentTime;
  const currentLabel = duration > 0 ? formatTimestamp(displayTime) : '--:--';
  const remainingLabel = duration > 0 ? `-${formatTimestamp(duration - displayTime)}` : '--:--';

  const handleSeekChange = (value: number | readonly number[]) => {
    const pct = typeof value === 'number' ? value : (value[0] ?? 0);
    setIsSeeking(true);
    setSeekValue(pct);
  };

  const handleSeekCommit = (value: number | readonly number[]) => {
    const pct = typeof value === 'number' ? value : (value[0] ?? 0);
    if (duration > 0) {
      sendCmd('seek', (pct / 100) * duration);
    }
    setIsSeeking(false);
  };

  const handleCycleSpeed = () => {
    const speeds = [1, 1.25, 1.5, 1.75, 2];
    const idx = speeds.findIndex((s) => Math.abs(s - playbackSpeed) < 0.01);
    const next = speeds[(idx + 1) % speeds.length] ?? 1;
    sendCmd('set-speed', next);
  };

  return (
    <div className="space-y-2 px-3 pb-2">
      {/* Progress slider */}
      <div className="space-y-1">
        <div className="relative">
          <span
            aria-hidden
            className="pointer-events-none absolute inset-x-0 top-1/2 h-1 -translate-y-1/2 origin-left rounded-full bg-primary/20 transition-transform duration-300 ease-out"
            style={{ transform: `scaleX(${bufferedProgress / 100})` }}
          />
          <Slider
            className="relative z-[1] [&_[data-slot=slider-track]]:h-1 [&_[data-slot=slider-track]]:bg-transparent [&_[data-slot=slider-thumb]]:z-[2] [&_[data-slot=slider-thumb]]:size-3.5"
            value={[isSeeking ? seekValue : progress]}
            min={0}
            max={100}
            step={0.1}
            onValueChange={handleSeekChange}
            onValueCommitted={handleSeekCommit}
          />
        </div>
        <div className="flex items-center justify-between text-[11px] tabular-nums text-muted-foreground">
          <span>{currentLabel}</span>
          <span>{remainingLabel}</span>
        </div>
      </div>

      {/* Transport controls */}
      <div className="flex items-center justify-center gap-2">
        <Button
          variant="ghost"
          size="icon-xs"
          className="size-8 rounded-full"
          onClick={handleCycleSpeed}
          title={_(msg`Playback speed`)}
        >
          <span className="text-[10px] font-semibold">{playbackSpeed}x</span>
        </Button>

        <Button
          variant="ghost"
          size="icon-xs"
          className="size-8 rounded-full"
          onClick={() => sendCmd('skip-back')}
          title={_(msg`Skip back 15s`)}
        >
          <HugeiconsIcon icon={GoBackward15SecIcon} className="size-4" />
        </Button>

        <Button
          variant={isPlaying ? 'default' : 'secondary'}
          size="icon-sm"
          className="size-11 rounded-full shadow-sm shadow-primary/20"
          onClick={() => sendCmd(isPlaying ? 'pause' : 'play')}
          title={
            bufferingActive
              ? _(msg`Loading...`)
              : isPlaying
                ? _(msg`Pause`)
                : _(msg`Play`)
          }
        >
          <HugeiconsIcon
            icon={bufferingActive ? Loading03Icon : isPlaying ? PauseIcon : PlayIcon}
            className={bufferingActive ? 'size-5 animate-spin' : 'size-5'}
          />
        </Button>

        <Button
          variant="ghost"
          size="icon-xs"
          className="size-8 rounded-full"
          onClick={() => sendCmd('skip-forward')}
          title={_(msg`Skip forward 30s`)}
        >
          <HugeiconsIcon icon={GoForward30SecIcon} className="size-4" />
        </Button>

        <Button
          variant="ghost"
          size="icon-xs"
          className="size-8 rounded-full text-rose-500 hover:bg-rose-100 hover:text-rose-700 dark:text-rose-400 dark:hover:bg-rose-900/35"
          onClick={() => sendCmd('dismiss')}
          title={_(msg`Stop`)}
        >
          <HugeiconsIcon icon={StopCircleIcon} className="size-4" />
        </Button>
      </div>
    </div>
  );
}
```

**Step 2: Create PlayerWindowQueue**

```tsx
import { HeadphonesIcon } from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react';
import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { emit } from '@tauri-apps/api/event';
import { PLAYER_CMD, type PlayerCmdPayload, type UpNextEntry } from '@/lib/player-events';
import { formatTimestamp } from '@/lib/podcast-utils';

interface PlayerWindowQueueProps {
  queue: UpNextEntry[];
  currentEntryId: string | null;
}

function playEntry(entryId: string) {
  emit(PLAYER_CMD, { action: 'play-entry', value: entryId } satisfies PlayerCmdPayload).catch(
    () => {}
  );
}

export function PlayerWindowQueue({ queue, currentEntryId }: PlayerWindowQueueProps) {
  const { _ } = useLingui();

  return (
    <div className="flex min-h-0 flex-1 flex-col border-t border-border/50">
      <p className="shrink-0 px-3 pt-2 pb-1 text-[10px] font-medium uppercase tracking-[0.1em] text-muted-foreground">
        {_(msg`Up Next`)}
      </p>
      <div className="min-h-0 flex-1 overflow-y-auto px-1.5 pb-2">
        {queue.length === 0 ? (
          <p className="px-1.5 py-4 text-center text-[11px] text-muted-foreground/60">
            {_(msg`No more episodes`)}
          </p>
        ) : (
          queue.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`flex w-full items-center gap-2 rounded-lg px-1.5 py-1.5 text-start transition-colors hover:bg-accent/50 ${
                item.id === currentEntryId ? 'bg-accent/30' : ''
              }`}
              onClick={() => playEntry(item.id)}
            >
              {item.artworkUrl ? (
                <img
                  src={item.artworkUrl}
                  alt=""
                  className="size-8 shrink-0 rounded-md object-cover"
                />
              ) : (
                <div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-muted/50">
                  <HugeiconsIcon icon={HeadphonesIcon} className="size-3.5 text-muted-foreground" />
                </div>
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate text-[11px] font-medium leading-tight">{item.title}</p>
                {item.duration > 0 && (
                  <p className="mt-0.5 text-[10px] text-muted-foreground">
                    {formatTimestamp(item.duration)}
                  </p>
                )}
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  );
}
```

**Step 3: Build the full PlayerWindow page**

Replace the placeholder `src/pages/PlayerWindow.tsx`:

```tsx
import { Cancel01Icon, HeadphonesIcon } from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react';
import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { listen } from '@tauri-apps/api/event';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { useEffect, useState } from 'react';
import type { Entry } from '@/lib/tauri-bindings';
import {
  PLAYER_DISMISSED,
  PLAYER_STATE_UPDATE,
  PLAYER_TRACK_CHANGE,
  type PlayerStatePayload,
  type PlayerTrackPayload,
  type UpNextEntry,
} from '@/lib/player-events';
import { PlayerWindowControls } from '@/components/podcast/PlayerWindowControls';
import { PlayerWindowQueue } from '@/components/podcast/PlayerWindowQueue';

export function PlayerWindow() {
  const { _ } = useLingui();

  // Local state from events (no Zustand in this window)
  const [entry, setEntry] = useState<Entry | null>(null);
  const [artworkUrl, setArtworkUrl] = useState<string | null>(null);
  const [queue, setQueue] = useState<UpNextEntry[]>([]);
  const [state, setState] = useState<PlayerStatePayload>({
    currentTime: 0,
    duration: 0,
    buffered: 0,
    isPlaying: false,
    isBuffering: false,
    playbackSpeed: 1,
    volume: 1,
    isMuted: false,
  });

  useEffect(() => {
    const unlisteners = [
      listen<PlayerStatePayload>(PLAYER_STATE_UPDATE, (event) => {
        setState(event.payload);
      }),
      listen<PlayerTrackPayload>(PLAYER_TRACK_CHANGE, (event) => {
        setEntry(event.payload.entry);
        setArtworkUrl(event.payload.artworkUrl);
        setQueue(event.payload.queue);
      }),
      listen(PLAYER_DISMISSED, () => {
        setEntry(null);
        setArtworkUrl(null);
        setQueue([]);
        setState((prev) => ({ ...prev, isPlaying: false, isBuffering: false, currentTime: 0 }));
      }),
    ];

    return () => {
      unlisteners.forEach((p) => p.then((fn) => fn()));
    };
  }, []);

  const handleClose = () => {
    getCurrentWindow().hide();
  };

  const handleStartDrag = () => {
    getCurrentWindow().startDragging();
  };

  if (!entry) {
    return (
      <div
        className="flex h-screen select-none flex-col items-center justify-center bg-background/95 text-muted-foreground backdrop-blur-2xl"
        onPointerDown={handleStartDrag}
      >
        <HugeiconsIcon icon={HeadphonesIcon} className="mb-2 size-8 text-muted-foreground/40" />
        <p className="text-[12px]">{_(msg`No episode playing`)}</p>
      </div>
    );
  }

  return (
    <div className="flex h-screen select-none flex-col overflow-hidden bg-background/95 text-foreground backdrop-blur-2xl">
      {/* Header — drag handle */}
      <div
        className="flex shrink-0 cursor-grab items-center gap-2.5 px-3 pt-3 pb-2 active:cursor-grabbing"
        onPointerDown={handleStartDrag}
      >
        {artworkUrl ? (
          <img
            src={artworkUrl}
            alt=""
            className="size-10 shrink-0 rounded-xl object-cover"
          />
        ) : (
          <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-muted/50">
            <HugeiconsIcon icon={HeadphonesIcon} className="size-5 text-muted-foreground" />
          </div>
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] font-semibold leading-tight">{entry.title}</p>
          <p className="mt-0.5 truncate text-[11px] text-muted-foreground">{entry.feed.title}</p>
        </div>
        <button
          type="button"
          className="inline-flex size-6 shrink-0 items-center justify-center rounded-full transition-colors hover:bg-foreground/10"
          onClick={handleClose}
          onPointerDown={(e) => e.stopPropagation()}
          title={_(msg`Close`)}
        >
          <HugeiconsIcon icon={Cancel01Icon} className="size-3" />
        </button>
      </div>

      {/* Controls */}
      <PlayerWindowControls
        currentTime={state.currentTime}
        duration={state.duration}
        buffered={state.buffered}
        isPlaying={state.isPlaying}
        isBuffering={state.isBuffering}
        playbackSpeed={state.playbackSpeed}
      />

      {/* Queue */}
      <PlayerWindowQueue queue={queue} currentEntryId={entry.id} />
    </div>
  );
}
```

**Step 4: Verify TypeScript**

Run: `bun run typecheck`
Expected: No errors.

**Step 5: Commit**

```bash
git add src/components/podcast/PlayerWindowControls.tsx src/components/podcast/PlayerWindowQueue.tsx src/pages/PlayerWindow.tsx
git commit -m "feat(player): Build player window UI with controls and queue"
```

---

## Task 6: Update titlebar pill to toggle player window

**Files:**
- Modify: `src/components/titlebar/TitleBarPodcastAnchor.tsx`

**Step 1: Replace setDockedToTitlebar with togglePlayerWindow**

In `TitleBarPodcastAnchor.tsx`:

1. Replace the `handleToggleFloatingMode` function to call the Tauri command:

```typescript
const handleToggleFloatingMode = () => {
  commands.togglePlayerWindow();
};
```

2. Update the button `title` to always say "Open player" (remove the docked/floating conditional):

```typescript
title={_(msg`Open player`)}
```

3. Remove the `dockedToTitlebar` subscription (line 22) — it's no longer needed for this component's logic. If it's used elsewhere in the component, verify and remove.

**Step 2: Verify TypeScript**

Run: `bun run typecheck`
Expected: No errors.

**Step 3: Commit**

```bash
git add src/components/titlebar/TitleBarPodcastAnchor.tsx
git commit -m "feat(player): Update titlebar pill to toggle player window"
```

---

## Task 7: Remove old floating overlay player

**Files:**
- Modify: `src/components/podcast/PodcastMiniPlayer.tsx` (remove or repurpose)
- Modify: wherever `PodcastMiniPlayer` is mounted (likely `MainWindowContent.tsx`)
- Modify: `src/store/player-store.ts` (remove `dockedToTitlebar`, `floatingPlayerPosition`, and related actions)

**Step 1: Remove PodcastMiniPlayer from the main window layout**

Find where `<PodcastMiniPlayer />` is rendered and remove it. The player window replaces this overlay.

**Step 2: Clean up player store**

Remove from `PlayerState` interface and implementation:
- `dockedToTitlebar`
- `floatingPlayerPosition`
- `setDockedToTitlebar`
- `setFloatingPlayerPosition`
- `resetFloatingPlayerPosition`
- `isMinimized` and `setMinimized` (if no longer used)

Remove the `FloatingPlayerPosition` interface, `loadFloatingPlayerPosition`, `saveFloatingPlayerPosition`, `normalizeFloatingPosition` functions, and the localStorage constant.

In the `play` action, remove `dockedToTitlebar: true` from the set call.
In the `dismiss` action, remove `dockedToTitlebar: false` from the set call.

**Step 3: Update TitleBarPodcastAnchor if it still references removed state**

Remove any remaining `dockedToTitlebar` subscription.

**Step 4: Verify TypeScript**

Run: `bun run typecheck`
Expected: No errors after cleaning up all references.

**Step 5: Run tests**

Run: `bun run test`
Expected: All tests pass. Fix any test files that reference removed state.

**Step 6: Commit**

```bash
git add src/components/podcast/PodcastMiniPlayer.tsx src/store/player-store.ts src/components/titlebar/TitleBarPodcastAnchor.tsx src/components/layout/MainWindowContent.tsx
git commit -m "refactor(player): Remove old floating overlay in favor of player window"
```

---

## Task 8: Integration test — verify full flow

**Step 1: Verify Rust compiles**

Run: `cd src-tauri && cargo build --lib`
Expected: Clean compilation.

**Step 2: Regenerate bindings**

Run: `bun run codegen:tauri`
Expected: Bindings updated.

**Step 3: Verify TypeScript**

Run: `bun run typecheck`
Expected: No errors.

**Step 4: Run all tests**

Run: `bun run test`
Expected: All pass.

**Step 5: Run quality gates**

Run: `bun run check:all`
Expected: All pass (typecheck, clippy, cargo test, cargo fmt).

**Step 6: Manual verification**

Run: `bun run dev`
Expected:
- App launches, main window loads
- Play a podcast episode
- Titlebar pill appears with artwork, title, time, play/pause
- Click titlebar pill → player window appears (always-on-top, decorationless, NSPanel on macOS)
- Player window shows header (artwork, title, feed), controls (slider, transport), queue (empty initially)
- Play/pause/seek/skip controls in player window work
- Close button hides player window
- Click titlebar pill again → player window re-shows
- Audio continues when player window is hidden

**Step 7: Commit (if any fixes needed)**

```bash
git commit -m "fix(player): Integration fixes for player window"
```
