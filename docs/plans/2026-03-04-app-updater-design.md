# App Update System Design

## Overview

Enhance the existing check-only update system into a full update lifecycle with background checking, auto-download with progress, and user-controlled restart. Modeled after VS Code/1Password patterns.

## Architecture

### Data Flow

```
App Launch → silent check → update found → auto-download (progress toast) → "Restart Now" / "Later"
                                                                              ↓
Periodic check (every 4hrs) → same flow                          Next natural restart applies update
```

### State Machine

```
idle → checking → available → downloading (0-100%) → ready → installing
  ↑                  ↓                                   ↓
  └── up-to-date     └── error                          └── error
```

### Components

| File | Purpose |
|------|---------|
| `src/lib/updater.ts` | Core update service — check, download, install lifecycle |
| `src/store/updater-store.ts` | Zustand store for update state |
| `src/hooks/use-auto-updater.ts` | Hook for app root — auto-check + toast notifications |
| `src/components/preferences/panes/AboutPane.tsx` | Enhanced with progress + install button |

## Update Service (`src/lib/updater.ts`)

Wraps `@tauri-apps/plugin-updater` and `@tauri-apps/plugin-process`:

- `checkForUpdate()` — Returns Update object or null
- `downloadUpdate(update, onProgress)` — Downloads with progress callback
- `installAndRelaunch()` — Calls `relaunch()` from process plugin

No custom Rust commands needed.

## Zustand Store (`src/store/updater-store.ts`)

```typescript
type UpdaterStatus =
  | { status: 'idle' }
  | { status: 'checking' }
  | { status: 'up-to-date' }
  | { status: 'available'; version: string; date: string; body: string }
  | { status: 'downloading'; version: string; progress: number }
  | { status: 'ready'; version: string }
  | { status: 'installing' }
  | { status: 'error'; message: string }
```

Selector-based access per project convention. Holds internal `Update` object reference (not serialized).

## Auto-Updater Hook (`src/hooks/use-auto-updater.ts`)

- Mounted once in app root
- On mount: check for update, start 4-hour interval
- Update found: start background download immediately
- Show progress toast during download (Sonner persistent toast)
- Download complete: show "Restart Now" / "Later" toast
- Error: silent retry after 1 hour (no toast unless manual check)

## Toast UX Flow

1. **Download starts**: Persistent toast — "Downloading update v1.4.0... 45%" with progress bar
2. **Download complete**: Toast transitions — "Update v1.4.0 ready" with [Restart Now] and [Later] buttons
3. **Later**: Toast dismisses, update applies on next natural restart
4. **Restart Now**: App relaunches with update applied
5. **Error**: Brief error toast if user-initiated, otherwise silent retry in 1 hour

## About Pane Changes

- Replace local `UpdateCheckState` with shared Zustand store
- Add progress bar when `status === 'downloading'`
- Add "Restart to Update" button when `status === 'ready'`
- Show version + release date from update metadata
- Manual "Check for Updates" button still works

## Integration Points

- **Menu item** (`Check for Updates...`): Triggers `checkForUpdate()` from store
- **Command palette** (`Check for Updates`): Same behavior
- **App root**: `useAutoUpdater()` hook runs background lifecycle

## Error Handling

- Check failures: silent, retry on next interval
- Download failures: error toast only if user-initiated, otherwise silent retry in 1 hour
- Install failures: show error toast with description

## Migration

- `src/lib/updates.ts` replaced by `src/lib/updater.ts`
- `src/lib/updates.test.ts` replaced by `src/lib/updater.test.ts`
- No Rust changes needed
- Existing `tauri.conf.json` updater config is sufficient
