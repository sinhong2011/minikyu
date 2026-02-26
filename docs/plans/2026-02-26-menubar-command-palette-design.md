# Menubar & Command Palette Enhancement Design

**Date:** 2026-02-26
**Status:** Approved

## Problem

The macOS menubar only has App and View menus, missing standard macOS conventions and app-specific actions. The command palette (Cmd+K) only has 9 commands despite the app having 110+ backend commands and dozens of UI actions.

## Approach

**Layered design:** Menubar has standard macOS menus with common actions. Command palette has everything — all menubar items plus power-user actions, contextual commands, and quick navigation. Menubar for discoverability, palette for speed.

## macOS Menubar Structure

### Minikyu (existing — no changes)

| Item | Shortcut |
|------|----------|
| About Minikyu | |
| Check for Updates... | |
| Preferences... | ⌘, |
| Hide / Hide Others / Show All | (predefined) |
| Quit Minikyu | ⌘Q |

### File (new)

| Item | Shortcut |
|------|----------|
| New Feed... | ⌘N |
| New Category... | ⌘⇧N |
| --- | |
| Import OPML... | |
| Export OPML... | |
| --- | |
| Sync Now | ⌘R |
| Refresh All Feeds | ⌘⇧R |
| --- | |
| Close Window | ⌘W |

### Edit (new)

| Item | Shortcut |
|------|----------|
| Undo | ⌘Z |
| Redo | ⌘⇧Z |
| --- | |
| Cut | ⌘X |
| Copy | ⌘C |
| Paste | ⌘V |
| Select All | ⌘A |

### View (enhanced — currently only has Toggle Left Sidebar)

| Item | Shortcut |
|------|----------|
| Toggle Left Sidebar | ⌘1 |
| Toggle Downloads | ⌘D |
| Zen Mode | ⌘⇧Z |
| --- | |
| Increase Font Size | ⌘+ |
| Decrease Font Size | ⌘- |
| Reset Font Size | ⌘0 |
| --- | |
| Reader Theme > Default, Paper, Sepia, Slate, OLED | |
| --- | |
| Enter Fullscreen | F11 |

### Article (new — contextual, enabled when reading)

| Item | Shortcut |
|------|----------|
| Mark as Read/Unread | ⌘⇧U |
| Toggle Star | ⌘⇧S |
| --- | |
| Fetch Original Content | ⌘⇧F |
| Translate Article | ⌘⇧T |
| --- | |
| Open in Browser | ⌘⇧O |
| Open in App Browser | |
| Copy Link | ⌘⇧C |
| Share... | ⌘⇧I |
| --- | |
| Previous Article | ⌘[ |
| Next Article | ⌘] |

### Podcast (new — contextual, enabled when episode loaded)

| Item | Shortcut |
|------|----------|
| Play / Pause | Space |
| Skip Forward 30s | → |
| Skip Back 15s | ← |
| --- | |
| Increase Speed | ] |
| Decrease Speed | [ |
| --- | |
| Mute / Unmute | M |
| Stop After Current | |
| Show Player Window | |

### Window (new)

| Item | Shortcut |
|------|----------|
| Minimize | ⌘M |
| Zoom | |
| --- | |
| Enter Full Screen | |
| --- | |
| Bring All to Front | |

### Help (new)

| Item | Shortcut |
|------|----------|
| Minikyu Help | |
| Keyboard Shortcuts | ⌘⇧/ |
| Report an Issue... | |

## Command Palette Additions

All menubar commands are included in the command palette, plus the following power-user actions organized by group.

### Feed Management

- Add New Feed
- Edit Feed
- Delete Feed
- Add New Category
- Edit Category
- Delete Category
- Discover Subscriptions from URL
- Refresh Current Feed

### Reading

- Fetch Original Content
- Toggle Bionic Reading
- Toggle Status Bar
- Set Font: Sans-serif / Serif / Monospace / Humanist / Georgia / Book Serif
- Set Theme: Default / Paper / Sepia / Slate / OLED
- Set Chinese Conversion Mode

### Translation

- Translate Article
- Toggle Translation Display (bilingual / translated-only)
- Change Translation Provider
- Open Translation Settings

### Podcast

- Play / Pause
- Skip Forward / Skip Back
- Set Playback Speed (0.5x, 1x, 1.5x, 2x)
- Add to Queue
- Clear Queue
- Shuffle Queue
- Open Podcast Settings

### Navigation

- Go to All Entries
- Go to Unread
- Go to Starred
- Go to Category... (lists all categories)
- Go to Feed... (lists all feeds)

### Account

- Switch Account...
- Sync Now
- Connection Status

### Data

- Clear Local Data
- Import OPML
- Export OPML

### Help

- Show Keyboard Shortcuts
- Check for Updates
- About Minikyu

## Implementation Notes

### Menubar (`src/lib/menu.ts`)

- Built dynamically using Tauri's `@tauri-apps/api/menu` API
- All text uses Lingui `msg` macro for i18n
- Menu rebuilds on language change via `setupMenuLanguageListener()`
- Contextual menus (Article, Podcast) need state-aware enable/disable
- Submenus (Reader Theme) use `Submenu.new()`

### Command Palette (`src/lib/commands/`)

- Uses existing `AppCommand` interface with `id`, `label`, `icon`, `group`, `keywords`, `shortcut`, `execute`, `isAvailable`
- New command files per group (e.g., `feed-commands.ts`, `reading-commands.ts`)
- Registered via `registerCommands()` in `initializeCommandSystem()`
- `isAvailable` for contextual commands (Article commands only when entry selected, Podcast only when episode loaded)
- `CommandContext` interface may need extending for new action types

### Keyboard Shortcuts

- Menubar shortcuts are handled by Tauri's accelerator system
- Command palette shortcuts are display-only (shown in UI)
- `use-keyboard-shortcuts.ts` handles global bindings not covered by menus
- Avoid conflicts between menubar accelerators and existing shortcuts

### Shortcut Conflicts to Resolve

- ⌘R: Currently unused → Sync Now
- ⌘D: Currently Toggle Downloads → keep
- ⌘⇧Z: Could conflict with Redo in Edit menu vs Zen Mode in View → resolve by changing Zen Mode shortcut
