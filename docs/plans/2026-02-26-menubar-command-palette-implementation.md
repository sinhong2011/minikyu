# Menubar & Command Palette Enhancement Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add full macOS menubar (File, Edit, View, Article, Podcast, Window, Help) and expand the command palette from 9 commands to 40+ covering all app actions.

**Architecture:** Extend the existing `buildAppMenu()` in `src/lib/menu.ts` with new Submenu entries. Add new command files per group in `src/lib/commands/`. Extend `CommandContext` to support new action types. Update `CommandPalette.tsx` group labels.

**Tech Stack:** Tauri v2 menu API (`@tauri-apps/api/menu`), Lingui i18n (`msg` macro), Zustand stores, cmdk command palette, Vitest

---

### Task 1: Extend CommandContext with new action types

The `CommandContext` interface needs new methods so commands can trigger actions beyond `openPreferences` and `showToast`.

**Files:**
- Modify: `src/lib/commands/types.ts`
- Modify: `src/hooks/use-command-context.ts`

**Step 1: Update CommandContext interface**

In `src/lib/commands/types.ts`, extend the interface:

```typescript
export interface CommandContext {
  openPreferences: () => void;
  openPreferencesPane: (pane: string) => void;
  showToast: (message: string, type?: 'success' | 'error' | 'info') => void;
  getSelectedEntryId: () => string | undefined;
  isConnected: () => boolean;
  hasPodcast: () => boolean;
}
```

**Step 2: Update the context implementation**

In `src/hooks/use-command-context.ts`, wire the new methods:

```typescript
import type { CommandContext } from '@/lib/commands/types';
import { notify } from '@/lib/notifications';
import { usePlayerStore } from '@/store/player-store';
import { useUIStore } from '@/store/ui-store';

const commandContext: CommandContext = {
  openPreferences: () => useUIStore.getState().togglePreferences(),
  openPreferencesPane: (pane: string) =>
    useUIStore.getState().openPreferencesToPane(pane as any),
  showToast: (message, type = 'info') => void notify(message, undefined, { type }),
  getSelectedEntryId: () => useUIStore.getState().selectedEntryId,
  isConnected: () => true, // Will be enhanced later if needed
  hasPodcast: () => usePlayerStore.getState().currentEntry !== null,
};

export function useCommandContext(): CommandContext {
  return commandContext;
}
```

**Step 3: Run typecheck**

Run: `bun run typecheck`
Expected: PASS (existing commands still match interface since we only added optional-use methods)

**Step 4: Commit**

```
feat(commands): Extend CommandContext with new action types
```

---

### Task 2: Fix existing navigation commands (they're stubs)

The current `show-left-sidebar` and `hide-left-sidebar` commands say "Not implemented yet". Fix them.

**Files:**
- Modify: `src/lib/commands/navigation-commands.ts`

**Step 1: Replace stub implementations**

```typescript
import { msg } from '@lingui/core/macro';
import { useUIStore } from '@/store/ui-store';
import type { AppCommand } from './types';

export const navigationCommands: AppCommand[] = [
  {
    id: 'show-left-sidebar',
    label: msg`Show Left Sidebar`,
    description: msg`Show the left sidebar`,
    group: 'navigation',
    shortcut: '⌘1',
    execute: () => {
      useUIStore.getState().setLeftSidebarVisible(true);
    },
    isAvailable: () => !useUIStore.getState().leftSidebarVisible,
  },
  {
    id: 'hide-left-sidebar',
    label: msg`Hide Left Sidebar`,
    description: msg`Hide the left sidebar`,
    group: 'navigation',
    shortcut: '⌘1',
    execute: () => {
      useUIStore.getState().setLeftSidebarVisible(false);
    },
    isAvailable: () => useUIStore.getState().leftSidebarVisible,
  },
  {
    id: 'open-preferences',
    label: msg`Open Preferences`,
    description: msg`Open the application preferences`,
    group: 'navigation',
    shortcut: '⌘,',
    execute: (context) => {
      context.openPreferences();
    },
  },
  {
    id: 'toggle-downloads',
    label: msg`Toggle Downloads`,
    description: msg`Show or hide the downloads panel`,
    group: 'navigation',
    shortcut: '⌘D',
    execute: () => {
      useUIStore.getState().toggleDownloads();
    },
  },
  {
    id: 'toggle-zen-mode',
    label: msg`Toggle Zen Mode`,
    description: msg`Enter or exit distraction-free reading mode`,
    group: 'navigation',
    execute: () => {
      useUIStore.getState().toggleZenMode();
    },
  },
  {
    id: 'toggle-search-filters',
    label: msg`Toggle Search Filters`,
    description: msg`Show or hide the search filter bar`,
    group: 'navigation',
    execute: () => {
      useUIStore.getState().toggleSearchFilters();
    },
  },
];
```

**Step 2: Run typecheck**

Run: `bun run typecheck`
Expected: PASS

**Step 3: Run existing tests**

Run: `bun run test -- src/lib/commands/commands.test.ts`
Expected: PASS (tests use mock commands, not real ones)

**Step 4: Commit**

```
fix(commands): Wire up navigation command implementations
```

---

### Task 3: Add feed management commands

**Files:**
- Create: `src/lib/commands/feed-commands.ts`
- Modify: `src/lib/commands/index.ts`

**Step 1: Create feed-commands.ts**

```typescript
import { msg } from '@lingui/core/macro';
import i18n from '@/i18n/config';
import { commands } from '@/lib/tauri-bindings';
import { notifications } from '@/lib/notifications';
import { useUIStore } from '@/store/ui-store';
import type { AppCommand } from './types';

export const feedCommands: AppCommand[] = [
  {
    id: 'feed-add',
    label: msg`Add New Feed...`,
    description: msg`Subscribe to a new RSS feed`,
    group: 'feed',
    shortcut: '⌘N',
    keywords: ['subscribe', 'rss', 'add', 'new'],
    execute: (context) => {
      useUIStore.getState().openPreferencesToPane('feeds');
    },
  },
  {
    id: 'category-add',
    label: msg`Add New Category...`,
    description: msg`Create a new feed category`,
    group: 'feed',
    shortcut: '⌘⇧N',
    keywords: ['category', 'folder', 'group', 'new'],
    execute: (context) => {
      useUIStore.getState().openPreferencesToPane('categories');
    },
  },
  {
    id: 'sync-now',
    label: msg`Sync Now`,
    description: msg`Synchronize with Miniflux server`,
    group: 'feed',
    shortcut: '⌘R',
    keywords: ['sync', 'refresh', 'update', 'fetch'],
    execute: async (context) => {
      const _ = i18n._.bind(i18n);
      try {
        const result = await commands.syncMiniflux();
        if (result.status === 'ok') {
          context.showToast(_(msg`Sync completed`), 'success');
        } else {
          context.showToast(_(msg`Sync failed: ${result.error}`), 'error');
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        context.showToast(_(msg`Sync failed: ${message}`), 'error');
      }
    },
  },
  {
    id: 'refresh-all-feeds',
    label: msg`Refresh All Feeds`,
    description: msg`Fetch new articles from all feeds`,
    group: 'feed',
    shortcut: '⌘⇧R',
    keywords: ['refresh', 'update', 'fetch', 'all'],
    execute: async (context) => {
      const _ = i18n._.bind(i18n);
      try {
        const result = await commands.refreshAllFeeds();
        if (result.status === 'ok') {
          context.showToast(_(msg`All feeds refreshed`), 'success');
        } else {
          context.showToast(_(msg`Refresh failed: ${result.error}`), 'error');
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        context.showToast(_(msg`Refresh failed: ${message}`), 'error');
      }
    },
  },
  {
    id: 'import-opml',
    label: msg`Import OPML...`,
    description: msg`Import feeds from an OPML file`,
    group: 'feed',
    keywords: ['import', 'opml', 'backup', 'restore'],
    execute: (context) => {
      useUIStore.getState().openPreferencesToPane('feeds');
    },
  },
  {
    id: 'export-opml',
    label: msg`Export OPML...`,
    description: msg`Export feeds to an OPML file`,
    group: 'feed',
    keywords: ['export', 'opml', 'backup', 'save'],
    execute: (context) => {
      useUIStore.getState().openPreferencesToPane('feeds');
    },
  },
];
```

**Step 2: Register in index.ts**

Add to `src/lib/commands/index.ts`:

```typescript
import { feedCommands } from './feed-commands';

// In initializeCommandSystem():
registerCommands(feedCommands);

// In exports:
export { navigationCommands, windowCommands, notificationCommands, feedCommands };
```

**Step 3: Run typecheck**

Run: `bun run typecheck`
Expected: PASS

**Step 4: Commit**

```
feat(commands): Add feed management commands
```

---

### Task 4: Add article/reading commands

**Files:**
- Create: `src/lib/commands/article-commands.ts`
- Modify: `src/lib/commands/index.ts`

**Step 1: Create article-commands.ts**

```typescript
import { msg } from '@lingui/core/macro';
import i18n from '@/i18n/config';
import { commands } from '@/lib/tauri-bindings';
import { useUIStore } from '@/store/ui-store';
import type { AppCommand } from './types';

export const articleCommands: AppCommand[] = [
  {
    id: 'article-mark-read',
    label: msg`Mark as Read/Unread`,
    description: msg`Toggle the read status of the current article`,
    group: 'article',
    shortcut: '⌘⇧U',
    keywords: ['read', 'unread', 'mark', 'status'],
    isAvailable: (context) => context.getSelectedEntryId() !== undefined,
    execute: async (context) => {
      const entryId = context.getSelectedEntryId();
      if (!entryId) return;
      const _ = i18n._.bind(i18n);
      try {
        const result = await commands.toggleEntryRead(entryId);
        if (result.status === 'error') {
          context.showToast(_(msg`Failed to toggle read status`), 'error');
        }
      } catch (error) {
        context.showToast(_(msg`Failed to toggle read status`), 'error');
      }
    },
  },
  {
    id: 'article-toggle-star',
    label: msg`Toggle Star`,
    description: msg`Star or unstar the current article`,
    group: 'article',
    shortcut: '⌘⇧S',
    keywords: ['star', 'favorite', 'bookmark', 'save'],
    isAvailable: (context) => context.getSelectedEntryId() !== undefined,
    execute: async (context) => {
      const entryId = context.getSelectedEntryId();
      if (!entryId) return;
      const _ = i18n._.bind(i18n);
      try {
        const result = await commands.toggleEntryStar(entryId);
        if (result.status === 'error') {
          context.showToast(_(msg`Failed to toggle star`), 'error');
        }
      } catch (error) {
        context.showToast(_(msg`Failed to toggle star`), 'error');
      }
    },
  },
  {
    id: 'article-fetch-content',
    label: msg`Fetch Original Content`,
    description: msg`Download the full article from the original source`,
    group: 'article',
    shortcut: '⌘⇧F',
    keywords: ['fetch', 'original', 'content', 'full'],
    isAvailable: (context) => context.getSelectedEntryId() !== undefined,
    execute: async (context) => {
      const entryId = context.getSelectedEntryId();
      if (!entryId) return;
      const _ = i18n._.bind(i18n);
      try {
        const result = await commands.fetchEntryContent(entryId);
        if (result.status === 'ok') {
          context.showToast(_(msg`Original content fetched`), 'success');
        } else {
          context.showToast(_(msg`Failed to fetch content`), 'error');
        }
      } catch (error) {
        context.showToast(_(msg`Failed to fetch content`), 'error');
      }
    },
  },
  {
    id: 'article-open-browser',
    label: msg`Open in Browser`,
    description: msg`Open the article in an external browser`,
    group: 'article',
    shortcut: '⌘⇧O',
    keywords: ['browser', 'external', 'open', 'web'],
    isAvailable: (context) => context.getSelectedEntryId() !== undefined,
    execute: () => {
      // Dispatched via event — the reading component handles the actual URL opening
      document.dispatchEvent(new CustomEvent('command:open-in-browser'));
    },
  },
  {
    id: 'article-open-in-app-browser',
    label: msg`Open in App Browser`,
    description: msg`Open the article in the built-in browser`,
    group: 'article',
    keywords: ['browser', 'in-app', 'internal', 'web'],
    isAvailable: (context) => context.getSelectedEntryId() !== undefined,
    execute: () => {
      document.dispatchEvent(new CustomEvent('command:open-in-app-browser'));
    },
  },
  {
    id: 'article-copy-link',
    label: msg`Copy Link`,
    description: msg`Copy the article link to clipboard`,
    group: 'article',
    shortcut: '⌘⇧C',
    keywords: ['copy', 'link', 'url', 'clipboard'],
    isAvailable: (context) => context.getSelectedEntryId() !== undefined,
    execute: () => {
      document.dispatchEvent(new CustomEvent('command:copy-link'));
    },
  },
];
```

**Step 2: Register in index.ts**

Add to `src/lib/commands/index.ts`:

```typescript
import { articleCommands } from './article-commands';

// In initializeCommandSystem():
registerCommands(articleCommands);
```

**Step 3: Run typecheck**

Run: `bun run typecheck`
Expected: PASS

**Step 4: Commit**

```
feat(commands): Add article/reading commands
```

---

### Task 5: Add podcast commands

**Files:**
- Create: `src/lib/commands/podcast-commands.ts`
- Modify: `src/lib/commands/index.ts`

**Step 1: Create podcast-commands.ts**

```typescript
import { msg } from '@lingui/core/macro';
import { usePlayerStore } from '@/store/player-store';
import type { AppCommand } from './types';

export const podcastCommands: AppCommand[] = [
  {
    id: 'podcast-play-pause',
    label: msg`Play / Pause`,
    description: msg`Toggle podcast playback`,
    group: 'podcast',
    shortcut: 'Space',
    keywords: ['play', 'pause', 'podcast', 'audio'],
    isAvailable: (context) => context.hasPodcast(),
    execute: () => {
      const player = usePlayerStore.getState();
      if (player.isPlaying) player.pause();
      else player.resume();
    },
  },
  {
    id: 'podcast-skip-forward',
    label: msg`Skip Forward 30s`,
    description: msg`Skip forward 30 seconds`,
    group: 'podcast',
    shortcut: '→',
    keywords: ['skip', 'forward', 'seek'],
    isAvailable: (context) => context.hasPodcast(),
    execute: () => {
      const player = usePlayerStore.getState();
      player.seek(Math.min(player.duration, player.currentTime + 30));
    },
  },
  {
    id: 'podcast-skip-back',
    label: msg`Skip Back 15s`,
    description: msg`Skip back 15 seconds`,
    group: 'podcast',
    shortcut: '←',
    keywords: ['skip', 'back', 'rewind', 'seek'],
    isAvailable: (context) => context.hasPodcast(),
    execute: () => {
      const player = usePlayerStore.getState();
      player.seek(Math.max(0, player.currentTime - 15));
    },
  },
  {
    id: 'podcast-speed-increase',
    label: msg`Increase Playback Speed`,
    description: msg`Increase speed by 0.25x`,
    group: 'podcast',
    shortcut: ']',
    keywords: ['speed', 'faster', 'rate'],
    isAvailable: (context) => context.hasPodcast(),
    execute: () => {
      const player = usePlayerStore.getState();
      const nextSpeed = Math.min(3, Math.round((player.playbackSpeed + 0.25) * 100) / 100);
      player.setSpeed(nextSpeed);
    },
  },
  {
    id: 'podcast-speed-decrease',
    label: msg`Decrease Playback Speed`,
    description: msg`Decrease speed by 0.25x`,
    group: 'podcast',
    shortcut: '[',
    keywords: ['speed', 'slower', 'rate'],
    isAvailable: (context) => context.hasPodcast(),
    execute: () => {
      const player = usePlayerStore.getState();
      const nextSpeed = Math.max(0.5, Math.round((player.playbackSpeed - 0.25) * 100) / 100);
      player.setSpeed(nextSpeed);
    },
  },
  {
    id: 'podcast-toggle-mute',
    label: msg`Mute / Unmute`,
    description: msg`Toggle audio mute`,
    group: 'podcast',
    shortcut: 'M',
    keywords: ['mute', 'unmute', 'volume', 'sound'],
    isAvailable: (context) => context.hasPodcast(),
    execute: () => {
      usePlayerStore.getState().toggleMute();
    },
  },
  {
    id: 'podcast-stop-after-current',
    label: msg`Stop After Current`,
    description: msg`Stop playback after the current episode finishes`,
    group: 'podcast',
    shortcut: '⇧S',
    keywords: ['stop', 'after', 'current', 'queue'],
    isAvailable: (context) => context.hasPodcast(),
    execute: () => {
      usePlayerStore.getState().toggleStopAfterCurrent();
    },
  },
  {
    id: 'podcast-clear-queue',
    label: msg`Clear Queue`,
    description: msg`Remove all episodes from the playback queue`,
    group: 'podcast',
    keywords: ['clear', 'queue', 'playlist', 'empty'],
    isAvailable: (context) => context.hasPodcast(),
    execute: () => {
      usePlayerStore.getState().clearQueue();
    },
  },
  {
    id: 'podcast-shuffle-queue',
    label: msg`Shuffle Queue`,
    description: msg`Randomize the playback queue order`,
    group: 'podcast',
    keywords: ['shuffle', 'random', 'queue', 'playlist'],
    isAvailable: (context) => context.hasPodcast(),
    execute: () => {
      usePlayerStore.getState().shuffleQueue();
    },
  },
];
```

**Step 2: Register in index.ts**

Add to `src/lib/commands/index.ts`:

```typescript
import { podcastCommands } from './podcast-commands';

// In initializeCommandSystem():
registerCommands(podcastCommands);
```

**Step 3: Run typecheck**

Run: `bun run typecheck`
Expected: PASS

**Step 4: Commit**

```
feat(commands): Add podcast playback commands
```

---

### Task 6: Add view/appearance commands

**Files:**
- Create: `src/lib/commands/view-commands.ts`
- Modify: `src/lib/commands/index.ts`

**Step 1: Create view-commands.ts**

Commands for font size, reader theme, and other view toggles that aren't already in navigation or window commands.

```typescript
import { msg } from '@lingui/core/macro';
import type { AppCommand } from './types';

export const viewCommands: AppCommand[] = [
  {
    id: 'view-increase-font',
    label: msg`Increase Font Size`,
    description: msg`Make text larger`,
    group: 'view',
    shortcut: '⌘+',
    keywords: ['font', 'size', 'larger', 'bigger', 'zoom'],
    execute: () => {
      document.dispatchEvent(new CustomEvent('command:font-size-increase'));
    },
  },
  {
    id: 'view-decrease-font',
    label: msg`Decrease Font Size`,
    description: msg`Make text smaller`,
    group: 'view',
    shortcut: '⌘-',
    keywords: ['font', 'size', 'smaller', 'zoom'],
    execute: () => {
      document.dispatchEvent(new CustomEvent('command:font-size-decrease'));
    },
  },
  {
    id: 'view-reset-font',
    label: msg`Reset Font Size`,
    description: msg`Reset text to default size`,
    group: 'view',
    shortcut: '⌘0',
    keywords: ['font', 'size', 'reset', 'default'],
    execute: () => {
      document.dispatchEvent(new CustomEvent('command:font-size-reset'));
    },
  },
  {
    id: 'view-theme-default',
    label: msg`Reader Theme: Default`,
    group: 'view',
    keywords: ['theme', 'default', 'reader'],
    execute: () => {
      document.dispatchEvent(new CustomEvent('command:set-reader-theme', { detail: 'default' }));
    },
  },
  {
    id: 'view-theme-paper',
    label: msg`Reader Theme: Paper`,
    group: 'view',
    keywords: ['theme', 'paper', 'reader'],
    execute: () => {
      document.dispatchEvent(new CustomEvent('command:set-reader-theme', { detail: 'paper' }));
    },
  },
  {
    id: 'view-theme-sepia',
    label: msg`Reader Theme: Sepia`,
    group: 'view',
    keywords: ['theme', 'sepia', 'reader', 'warm'],
    execute: () => {
      document.dispatchEvent(new CustomEvent('command:set-reader-theme', { detail: 'sepia' }));
    },
  },
  {
    id: 'view-theme-slate',
    label: msg`Reader Theme: Slate`,
    group: 'view',
    keywords: ['theme', 'slate', 'dark', 'reader'],
    execute: () => {
      document.dispatchEvent(new CustomEvent('command:set-reader-theme', { detail: 'slate' }));
    },
  },
  {
    id: 'view-theme-oled',
    label: msg`Reader Theme: OLED`,
    group: 'view',
    keywords: ['theme', 'oled', 'black', 'dark', 'reader'],
    execute: () => {
      document.dispatchEvent(new CustomEvent('command:set-reader-theme', { detail: 'oled' }));
    },
  },
  {
    id: 'open-appearance-settings',
    label: msg`Appearance Settings`,
    description: msg`Open appearance preferences`,
    group: 'view',
    keywords: ['appearance', 'settings', 'look', 'customize'],
    execute: (context) => {
      context.openPreferencesPane('appearance');
    },
  },
  {
    id: 'open-translation-settings',
    label: msg`Translation Settings`,
    description: msg`Open translation preferences`,
    group: 'view',
    keywords: ['translation', 'language', 'settings', 'translate'],
    execute: (context) => {
      context.openPreferencesPane('translation');
    },
  },
];
```

**Step 2: Register in index.ts**

Add to `src/lib/commands/index.ts`:

```typescript
import { viewCommands } from './view-commands';

// In initializeCommandSystem():
registerCommands(viewCommands);
```

**Step 3: Run typecheck**

Run: `bun run typecheck`
Expected: PASS

**Step 4: Commit**

```
feat(commands): Add view and appearance commands
```

---

### Task 7: Add help commands

**Files:**
- Create: `src/lib/commands/help-commands.ts`
- Modify: `src/lib/commands/index.ts`

**Step 1: Create help-commands.ts**

```typescript
import { msg } from '@lingui/core/macro';
import { checkLatestVersion } from '@/lib/updates';
import { notifications } from '@/lib/notifications';
import i18n from '@/i18n/config';
import type { AppCommand } from './types';

export const helpCommands: AppCommand[] = [
  {
    id: 'help-check-updates',
    label: msg`Check for Updates`,
    description: msg`Check if a newer version is available`,
    group: 'help',
    keywords: ['update', 'version', 'upgrade', 'new'],
    execute: async () => {
      const _ = i18n._.bind(i18n);
      try {
        const latestVersion = await checkLatestVersion();
        if (latestVersion.status === 'available') {
          notifications.info(
            _(msg`Update Available`),
            _(msg`Version ${latestVersion.version} is available`)
          );
        } else {
          notifications.success(_(msg`Up to Date`), _(msg`You are running the latest version`));
        }
      } catch {
        notifications.error(_(msg`Update Check Failed`), _(msg`Could not check for updates`));
      }
    },
  },
  {
    id: 'help-about',
    label: msg`About Minikyu`,
    description: msg`View app version and information`,
    group: 'help',
    keywords: ['about', 'version', 'info'],
    execute: (context) => {
      context.openPreferencesPane('about');
    },
  },
  {
    id: 'help-report-issue',
    label: msg`Report an Issue`,
    description: msg`Open the issue tracker to report a bug`,
    group: 'help',
    keywords: ['report', 'bug', 'issue', 'feedback'],
    execute: () => {
      window.open('https://github.com/sinhong2011/minikyu/issues', '_blank');
    },
  },
];
```

**Step 2: Register in index.ts**

Add to `src/lib/commands/index.ts`.

**Step 3: Run typecheck**

Run: `bun run typecheck`
Expected: PASS

**Step 4: Commit**

```
feat(commands): Add help commands
```

---

### Task 8: Update CommandPalette group labels

**Files:**
- Modify: `src/components/command-palette/CommandPalette.tsx`

**Step 1: Add new group labels**

In `getGroupLabel()`, add cases for the new groups:

```typescript
case 'feed':
  return _(msg`Feed Management`);
case 'article':
  return _(msg`Article`);
case 'podcast':
  return _(msg`Podcast`);
case 'view':
  return _(msg`View`);
case 'help':
  return _(msg`Help`);
```

**Step 2: Run typecheck**

Run: `bun run typecheck`
Expected: PASS

**Step 3: Commit**

```
feat(command-palette): Add group labels for new command categories
```

---

### Task 9: Build the full macOS menubar

This is the largest task — expanding `buildAppMenu()` with File, Edit, View (enhanced), Article, Podcast, Window, and Help submenus.

**Files:**
- Modify: `src/lib/menu.ts`

**Step 1: Add handler functions**

Add new handler functions at the bottom of menu.ts for the actions that aren't already handled:

```typescript
function handleSyncNow(): void {
  executeCommand('sync-now', getCommandContext());
}

function handleRefreshAllFeeds(): void {
  executeCommand('refresh-all-feeds', getCommandContext());
}

function handleAddFeed(): void {
  useUIStore.getState().openPreferencesToPane('feeds');
}

function handleAddCategory(): void {
  useUIStore.getState().openPreferencesToPane('categories');
}

function handleImportOpml(): void {
  useUIStore.getState().openPreferencesToPane('feeds');
}

function handleExportOpml(): void {
  useUIStore.getState().openPreferencesToPane('feeds');
}

function handleToggleDownloads(): void {
  useUIStore.getState().toggleDownloads();
}

function handleZenMode(): void {
  useUIStore.getState().toggleZenMode();
}

function handleFontSizeIncrease(): void {
  document.dispatchEvent(new CustomEvent('command:font-size-increase'));
}

function handleFontSizeDecrease(): void {
  document.dispatchEvent(new CustomEvent('command:font-size-decrease'));
}

function handleFontSizeReset(): void {
  document.dispatchEvent(new CustomEvent('command:font-size-reset'));
}

function handleSetReaderTheme(theme: string): void {
  document.dispatchEvent(new CustomEvent('command:set-reader-theme', { detail: theme }));
}
```

**Step 2: Build the full menu structure**

Replace the menu construction in `buildAppMenu()` with the full structure. Keep the existing `appSubmenu` as-is. Add new submenus:

```typescript
// File menu
const fileSubmenu = await Submenu.new({
  text: _(msg`File`),
  items: [
    await MenuItem.new({ id: 'add-feed', text: _(msg`New Feed...`), accelerator: 'CmdOrCtrl+N', action: handleAddFeed }),
    await MenuItem.new({ id: 'add-category', text: _(msg`New Category...`), accelerator: 'CmdOrCtrl+Shift+N', action: handleAddCategory }),
    await PredefinedMenuItem.new({ item: 'Separator' }),
    await MenuItem.new({ id: 'import-opml', text: _(msg`Import OPML...`), action: handleImportOpml }),
    await MenuItem.new({ id: 'export-opml', text: _(msg`Export OPML...`), action: handleExportOpml }),
    await PredefinedMenuItem.new({ item: 'Separator' }),
    await MenuItem.new({ id: 'sync-now', text: _(msg`Sync Now`), accelerator: 'CmdOrCtrl+R', action: handleSyncNow }),
    await MenuItem.new({ id: 'refresh-all', text: _(msg`Refresh All Feeds`), accelerator: 'CmdOrCtrl+Shift+R', action: handleRefreshAllFeeds }),
    await PredefinedMenuItem.new({ item: 'Separator' }),
    await PredefinedMenuItem.new({ item: 'CloseWindow' }),
  ],
});

// Edit menu (standard macOS items)
const editSubmenu = await Submenu.new({
  text: _(msg`Edit`),
  items: [
    await PredefinedMenuItem.new({ item: 'Undo' }),
    await PredefinedMenuItem.new({ item: 'Redo' }),
    await PredefinedMenuItem.new({ item: 'Separator' }),
    await PredefinedMenuItem.new({ item: 'Cut' }),
    await PredefinedMenuItem.new({ item: 'Copy' }),
    await PredefinedMenuItem.new({ item: 'Paste' }),
    await PredefinedMenuItem.new({ item: 'SelectAll' }),
  ],
});

// Enhanced View menu
const readerThemeSubmenu = await Submenu.new({
  text: _(msg`Reader Theme`),
  items: [
    await MenuItem.new({ id: 'theme-default', text: _(msg`Default`), action: () => handleSetReaderTheme('default') }),
    await MenuItem.new({ id: 'theme-paper', text: _(msg`Paper`), action: () => handleSetReaderTheme('paper') }),
    await MenuItem.new({ id: 'theme-sepia', text: _(msg`Sepia`), action: () => handleSetReaderTheme('sepia') }),
    await MenuItem.new({ id: 'theme-slate', text: _(msg`Slate`), action: () => handleSetReaderTheme('slate') }),
    await MenuItem.new({ id: 'theme-oled', text: _(msg`OLED`), action: () => handleSetReaderTheme('oled') }),
  ],
});

const viewSubmenu = await Submenu.new({
  text: _(msg`View`),
  items: [
    await MenuItem.new({ id: 'toggle-left-sidebar', text: _(msg`Toggle Left Sidebar`), accelerator: 'CmdOrCtrl+1', action: handleToggleLeftSidebar }),
    await MenuItem.new({ id: 'toggle-downloads', text: _(msg`Toggle Downloads`), accelerator: 'CmdOrCtrl+D', action: handleToggleDownloads }),
    await MenuItem.new({ id: 'zen-mode', text: _(msg`Zen Mode`), action: handleZenMode }),
    await PredefinedMenuItem.new({ item: 'Separator' }),
    await MenuItem.new({ id: 'font-increase', text: _(msg`Increase Font Size`), accelerator: 'CmdOrCtrl+Plus', action: handleFontSizeIncrease }),
    await MenuItem.new({ id: 'font-decrease', text: _(msg`Decrease Font Size`), accelerator: 'CmdOrCtrl+-', action: handleFontSizeDecrease }),
    await MenuItem.new({ id: 'font-reset', text: _(msg`Reset Font Size`), accelerator: 'CmdOrCtrl+0', action: handleFontSizeReset }),
    await PredefinedMenuItem.new({ item: 'Separator' }),
    readerThemeSubmenu,
    await PredefinedMenuItem.new({ item: 'Separator' }),
    await PredefinedMenuItem.new({ item: 'EnterFullScreen' }),
  ],
});

// Article menu
const articleSubmenu = await Submenu.new({
  text: _(msg`Article`),
  items: [
    await MenuItem.new({ id: 'article-read', text: _(msg`Mark as Read/Unread`), accelerator: 'CmdOrCtrl+Shift+U', action: () => document.dispatchEvent(new CustomEvent('command:toggle-read')) }),
    await MenuItem.new({ id: 'article-star', text: _(msg`Toggle Star`), accelerator: 'CmdOrCtrl+Shift+S', action: () => document.dispatchEvent(new CustomEvent('command:toggle-star')) }),
    await PredefinedMenuItem.new({ item: 'Separator' }),
    await MenuItem.new({ id: 'article-fetch', text: _(msg`Fetch Original Content`), accelerator: 'CmdOrCtrl+Shift+F', action: () => document.dispatchEvent(new CustomEvent('command:fetch-content')) }),
    await MenuItem.new({ id: 'article-translate', text: _(msg`Translate Article`), accelerator: 'CmdOrCtrl+Shift+T', action: () => document.dispatchEvent(new CustomEvent('command:translate')) }),
    await PredefinedMenuItem.new({ item: 'Separator' }),
    await MenuItem.new({ id: 'article-browser', text: _(msg`Open in Browser`), accelerator: 'CmdOrCtrl+Shift+O', action: () => document.dispatchEvent(new CustomEvent('command:open-in-browser')) }),
    await MenuItem.new({ id: 'article-app-browser', text: _(msg`Open in App Browser`), action: () => document.dispatchEvent(new CustomEvent('command:open-in-app-browser')) }),
    await MenuItem.new({ id: 'article-copy-link', text: _(msg`Copy Link`), accelerator: 'CmdOrCtrl+Shift+C', action: () => document.dispatchEvent(new CustomEvent('command:copy-link')) }),
    await PredefinedMenuItem.new({ item: 'Separator' }),
    await MenuItem.new({ id: 'article-prev', text: _(msg`Previous Article`), accelerator: 'CmdOrCtrl+[', action: () => document.dispatchEvent(new CustomEvent('command:prev-article')) }),
    await MenuItem.new({ id: 'article-next', text: _(msg`Next Article`), accelerator: 'CmdOrCtrl+]', action: () => document.dispatchEvent(new CustomEvent('command:next-article')) }),
  ],
});

// Window menu
const windowSubmenu = await Submenu.new({
  text: _(msg`Window`),
  items: [
    await PredefinedMenuItem.new({ item: 'Minimize' }),
    await PredefinedMenuItem.new({ item: 'Zoom' }),
    await PredefinedMenuItem.new({ item: 'Separator' }),
    await PredefinedMenuItem.new({ item: 'EnterFullScreen' }),
    await PredefinedMenuItem.new({ item: 'Separator' }),
    await PredefinedMenuItem.new({ item: 'BringAllToFront' }),
  ],
});

// Help menu
const helpSubmenu = await Submenu.new({
  text: _(msg`Help`),
  items: [
    await MenuItem.new({ id: 'help-report', text: _(msg`Report an Issue...`), action: () => window.open('https://github.com/sinhong2011/minikyu/issues', '_blank') }),
  ],
});

const menu = await Menu.new({
  items: [appSubmenu, fileSubmenu, editSubmenu, viewSubmenu, articleSubmenu, windowSubmenu, helpSubmenu],
});
```

**Step 3: Run typecheck**

Run: `bun run typecheck`
Expected: PASS

**Step 4: Commit**

```
feat(menu): Build full macOS menubar with File, Edit, View, Article, Window, Help
```

---

### Task 10: Extract i18n strings and verify

**Files:**
- Modified: `src/locales/*/messages.po`

**Step 1: Extract translations**

Run: `bun run i18n:extract`
Expected: New strings added to `.po` files

**Step 2: Compile translations**

Run: `bun run i18n:compile`
Expected: PASS

**Step 3: Run full check**

Run: `bun run typecheck`
Expected: PASS

**Step 4: Commit**

```
chore(i18n): Extract new menu and command strings
```

---

### Task 11: Run full quality check and verify app

**Step 1: Run quality gates**

Run: `bun run check:all`
Expected: All checks pass

**Step 2: Run app**

Run: `bun run dev`
Expected:
- App launches without errors
- macOS menubar shows: Minikyu, File, Edit, View, Article, Window, Help
- Cmd+K opens command palette with all new command groups
- Menu items trigger correct actions

**Step 3: Fix any issues found**

If any quality gate or visual issue, fix and re-run.

**Step 4: Commit any fixes**

```
fix: Address quality gate findings
```
