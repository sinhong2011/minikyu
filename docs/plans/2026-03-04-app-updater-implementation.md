# App Update System Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the current `confirm()`/`alert()` updater with a polished Sonner-toast-based update system featuring background auto-check, download with progress, and user-controlled restart.

**Architecture:** Zustand store holds update lifecycle state. A hook in App.tsx runs background checks on launch + 4-hour intervals. Sonner toasts provide non-modal UX with progress bar during download and "Restart Now"/"Later" actions when ready. AboutPane reads the shared store for settings-page display.

**Tech Stack:** `@tauri-apps/plugin-updater`, `@tauri-apps/plugin-process` (relaunch), Zustand, Sonner, Lingui i18n

---

### Task 1: Create Updater Zustand Store

**Files:**
- Create: `src/store/updater-store.ts`
- Test: `src/store/updater-store.test.ts`

**Step 1: Write the failing test**

```typescript
// src/store/updater-store.test.ts
import { beforeEach, describe, expect, it } from 'vitest';
import { useUpdaterStore } from './updater-store';

describe('updater-store', () => {
  beforeEach(() => {
    useUpdaterStore.setState({ status: 'idle' });
  });

  it('starts in idle state', () => {
    expect(useUpdaterStore.getState().status).toBe('idle');
  });

  it('transitions to checking', () => {
    useUpdaterStore.getState().setChecking();
    expect(useUpdaterStore.getState().status).toBe('checking');
  });

  it('transitions to available with metadata', () => {
    useUpdaterStore.getState().setAvailable('1.4.0', '2026-03-04', 'Bug fixes');
    const state = useUpdaterStore.getState();
    expect(state.status).toBe('available');
    if (state.status === 'available') {
      expect(state.version).toBe('1.4.0');
      expect(state.date).toBe('2026-03-04');
      expect(state.body).toBe('Bug fixes');
    }
  });

  it('transitions to downloading with progress', () => {
    useUpdaterStore.getState().setDownloading('1.4.0', 45);
    const state = useUpdaterStore.getState();
    expect(state.status).toBe('downloading');
    if (state.status === 'downloading') {
      expect(state.version).toBe('1.4.0');
      expect(state.progress).toBe(45);
    }
  });

  it('transitions to ready', () => {
    useUpdaterStore.getState().setReady('1.4.0');
    const state = useUpdaterStore.getState();
    expect(state.status).toBe('ready');
    if (state.status === 'ready') {
      expect(state.version).toBe('1.4.0');
    }
  });

  it('transitions to error', () => {
    useUpdaterStore.getState().setError('Network failed');
    const state = useUpdaterStore.getState();
    expect(state.status).toBe('error');
    if (state.status === 'error') {
      expect(state.message).toBe('Network failed');
    }
  });

  it('resets to idle', () => {
    useUpdaterStore.getState().setError('err');
    useUpdaterStore.getState().reset();
    expect(useUpdaterStore.getState().status).toBe('idle');
  });

  it('transitions to up-to-date', () => {
    useUpdaterStore.getState().setUpToDate();
    expect(useUpdaterStore.getState().status).toBe('up-to-date');
  });

  it('transitions to installing', () => {
    useUpdaterStore.getState().setInstalling();
    expect(useUpdaterStore.getState().status).toBe('installing');
  });
});
```

**Step 2: Run test to verify it fails**

Run: `bun run test -- src/store/updater-store.test.ts`
Expected: FAIL — module not found

**Step 3: Write minimal implementation**

```typescript
// src/store/updater-store.ts
import type { Update } from '@tauri-apps/plugin-updater';
import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { logger } from './logger-middleware';

type UpdaterState =
  | { status: 'idle' }
  | { status: 'checking' }
  | { status: 'up-to-date' }
  | { status: 'available'; version: string; date: string; body: string }
  | { status: 'downloading'; version: string; progress: number }
  | { status: 'ready'; version: string }
  | { status: 'installing' }
  | { status: 'error'; message: string };

interface UpdaterActions {
  setChecking: () => void;
  setUpToDate: () => void;
  setAvailable: (version: string, date: string, body: string) => void;
  setDownloading: (version: string, progress: number) => void;
  setReady: (version: string) => void;
  setInstalling: () => void;
  setError: (message: string) => void;
  reset: () => void;
  /** Internal — holds the Update object for download/install calls */
  _update: Update | null;
  _setUpdate: (update: Update | null) => void;
}

type UpdaterStore = UpdaterState & UpdaterActions;

export const useUpdaterStore = create<UpdaterStore>()(
  logger(
    devtools(
      (set) => ({
        status: 'idle' as const,
        _update: null,

        setChecking: () => set({ status: 'checking' }, undefined, 'setChecking'),
        setUpToDate: () => set({ status: 'up-to-date' }, undefined, 'setUpToDate'),
        setAvailable: (version: string, date: string, body: string) =>
          set({ status: 'available', version, date, body }, undefined, 'setAvailable'),
        setDownloading: (version: string, progress: number) =>
          set({ status: 'downloading', version, progress }, undefined, 'setDownloading'),
        setReady: (version: string) => set({ status: 'ready', version }, undefined, 'setReady'),
        setInstalling: () => set({ status: 'installing' }, undefined, 'setInstalling'),
        setError: (message: string) =>
          set({ status: 'error', message }, undefined, 'setError'),
        reset: () => set({ status: 'idle', _update: null }, undefined, 'reset'),
        _setUpdate: (update: Update | null) => set({ _update: update }, undefined, '_setUpdate'),
      }),
      { name: 'updater-store' }
    ),
    'updater-store'
  )
);
```

**Step 4: Run test to verify it passes**

Run: `bun run test -- src/store/updater-store.test.ts`
Expected: PASS

**Step 5: Commit**

```
feat(updater): Add Zustand updater store with lifecycle state machine
```

---

### Task 2: Create Updater Service

**Files:**
- Create: `src/lib/updater.ts`
- Test: `src/lib/updater.test.ts`

**Step 1: Write the failing test**

```typescript
// src/lib/updater.test.ts
import { check } from '@tauri-apps/plugin-updater';
import { relaunch } from '@tauri-apps/plugin-process';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useUpdaterStore } from '@/store/updater-store';
import { checkForUpdate, downloadUpdate, installAndRelaunch } from './updater';

vi.mock('@tauri-apps/plugin-updater', () => ({
  check: vi.fn(),
}));

vi.mock('@tauri-apps/plugin-process', () => ({
  relaunch: vi.fn(),
}));

describe('updater service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useUpdaterStore.setState({ status: 'idle', _update: null });
  });

  describe('checkForUpdate', () => {
    it('sets store to available when update exists', async () => {
      const mockUpdate = {
        version: '1.4.0',
        date: '2026-03-04',
        body: 'Bug fixes',
        download: vi.fn(),
        install: vi.fn(),
        downloadAndInstall: vi.fn(),
        close: vi.fn(),
      };
      vi.mocked(check).mockResolvedValue(mockUpdate as any);

      const result = await checkForUpdate();

      expect(result).toBe(true);
      expect(useUpdaterStore.getState().status).toBe('available');
    });

    it('sets store to up-to-date when no update', async () => {
      vi.mocked(check).mockResolvedValue(null);

      const result = await checkForUpdate();

      expect(result).toBe(false);
      expect(useUpdaterStore.getState().status).toBe('up-to-date');
    });

    it('sets store to error on failure', async () => {
      vi.mocked(check).mockRejectedValue(new Error('Network error'));

      const result = await checkForUpdate();

      expect(result).toBe(false);
      expect(useUpdaterStore.getState().status).toBe('error');
    });
  });

  describe('downloadUpdate', () => {
    it('downloads and transitions to ready', async () => {
      const mockUpdate = {
        version: '1.4.0',
        downloadAndInstall: vi.fn().mockResolvedValue(undefined),
      };
      useUpdaterStore.setState({ status: 'available', version: '1.4.0', date: '', body: '' });
      useUpdaterStore.getState()._setUpdate(mockUpdate as any);

      await downloadUpdate();

      expect(mockUpdate.downloadAndInstall).toHaveBeenCalled();
      expect(useUpdaterStore.getState().status).toBe('ready');
    });

    it('sets error when no update object available', async () => {
      useUpdaterStore.setState({ status: 'available', version: '1.4.0', date: '', body: '' });

      await downloadUpdate();

      expect(useUpdaterStore.getState().status).toBe('error');
    });
  });

  describe('installAndRelaunch', () => {
    it('calls relaunch', async () => {
      await installAndRelaunch();

      expect(relaunch).toHaveBeenCalled();
    });
  });
});
```

**Step 2: Run test to verify it fails**

Run: `bun run test -- src/lib/updater.test.ts`
Expected: FAIL — module not found

**Step 3: Write minimal implementation**

```typescript
// src/lib/updater.ts
import { check } from '@tauri-apps/plugin-updater';
import { relaunch } from '@tauri-apps/plugin-process';
import { logger } from '@/lib/logger';
import { useUpdaterStore } from '@/store/updater-store';

/**
 * Check for available updates. Updates the store with result.
 * Returns true if an update is available.
 */
export async function checkForUpdate(): Promise<boolean> {
  const store = useUpdaterStore.getState();
  store.setChecking();

  try {
    const update = await check();

    if (update) {
      logger.info('Update available', { version: update.version });
      store.setAvailable(
        update.version,
        update.date ?? '',
        update.body ?? ''
      );
      store._setUpdate(update);
      return true;
    }

    logger.info('No updates available');
    store.setUpToDate();
    return false;
  } catch (error) {
    logger.error('Update check failed', { error });
    store.setError(error instanceof Error ? error.message : String(error));
    return false;
  }
}

/**
 * Download the available update with progress tracking.
 * Transitions store: available → downloading → ready (or error).
 */
export async function downloadUpdate(): Promise<void> {
  const store = useUpdaterStore.getState();
  const update = store._update;

  if (!update) {
    store.setError('No update available to download');
    return;
  }

  const version = 'version' in store ? (store as { version: string }).version : '';

  try {
    let totalBytes = 0;
    let downloadedBytes = 0;

    await update.downloadAndInstall((event) => {
      switch (event.event) {
        case 'Started':
          totalBytes = event.data.contentLength ?? 0;
          downloadedBytes = 0;
          store.setDownloading(version, 0);
          logger.info('Update download started', { totalBytes });
          break;
        case 'Progress':
          downloadedBytes += event.data.chunkLength;
          const progress = totalBytes > 0 ? Math.round((downloadedBytes / totalBytes) * 100) : 0;
          useUpdaterStore.getState().setDownloading(version, progress);
          break;
        case 'Finished':
          logger.info('Update download finished');
          break;
      }
    });

    useUpdaterStore.getState().setReady(version);
  } catch (error) {
    logger.error('Update download failed', { error });
    useUpdaterStore.getState().setError(error instanceof Error ? error.message : String(error));
  }
}

/**
 * Install the downloaded update and relaunch the app.
 */
export async function installAndRelaunch(): Promise<void> {
  useUpdaterStore.getState().setInstalling();
  await relaunch();
}
```

**Step 4: Run test to verify it passes**

Run: `bun run test -- src/lib/updater.test.ts`
Expected: PASS

**Step 5: Commit**

```
feat(updater): Add updater service wrapping Tauri plugin lifecycle
```

---

### Task 3: Create Auto-Updater Hook with Toast UI

**Files:**
- Create: `src/hooks/use-auto-updater.ts`

**Step 1: Write the hook**

This hook is side-effect-heavy (timers, toasts, downloads) — tested via integration with the store and manual verification rather than unit tests.

```typescript
// src/hooks/use-auto-updater.ts
import { msg } from '@lingui/core/macro';
import { useEffect, useRef } from 'react';
import { toast } from 'sonner';
import i18n from '@/i18n/config';
import { logger } from '@/lib/logger';
import { checkForUpdate, downloadUpdate, installAndRelaunch } from '@/lib/updater';
import { useUpdaterStore } from '@/store/updater-store';

const CHECK_INTERVAL_MS = 4 * 60 * 60 * 1000; // 4 hours
const INITIAL_DELAY_MS = 5_000; // 5 seconds after app load
const ERROR_RETRY_MS = 60 * 60 * 1000; // 1 hour

export function useAutoUpdater() {
  const status = useUpdaterStore((s) => s.status);
  const toastIdRef = useRef<string | number | undefined>(undefined);

  // Initial check + periodic interval
  useEffect(() => {
    const initialTimer = setTimeout(() => {
      checkForUpdate();
    }, INITIAL_DELAY_MS);

    const interval = setInterval(() => {
      const currentStatus = useUpdaterStore.getState().status;
      // Don't re-check if already downloading/ready/installing
      if (currentStatus === 'idle' || currentStatus === 'up-to-date' || currentStatus === 'error') {
        checkForUpdate();
      }
    }, CHECK_INTERVAL_MS);

    return () => {
      clearTimeout(initialTimer);
      clearInterval(interval);
    };
  }, []);

  // React to state changes with toasts
  useEffect(() => {
    const _ = i18n._.bind(i18n);

    if (status === 'available') {
      // Auto-start download when update is found
      downloadUpdate();
    }

    if (status === 'downloading') {
      const state = useUpdaterStore.getState();
      if (state.status === 'downloading') {
        const progressText = _(msg`Downloading update v${state.version}... ${String(state.progress)}%`);
        if (toastIdRef.current) {
          toast.loading(progressText, { id: toastIdRef.current });
        } else {
          toastIdRef.current = toast.loading(progressText, { duration: Infinity });
        }
      }
    }

    if (status === 'ready') {
      const state = useUpdaterStore.getState();
      if (state.status === 'ready') {
        // Dismiss progress toast and show action toast
        if (toastIdRef.current) {
          toast.dismiss(toastIdRef.current);
          toastIdRef.current = undefined;
        }

        toast.info(_(msg`Update v${state.version} is ready`), {
          description: _(msg`Restart to apply the update.`),
          duration: Infinity,
          action: {
            label: _(msg`Restart Now`),
            onClick: () => {
              installAndRelaunch().catch((error) => {
                logger.error('Relaunch failed', { error });
              });
            },
          },
          cancel: {
            label: _(msg`Later`),
            onClick: () => {
              // Dismissed — update applies on next natural restart
            },
          },
        });
      }
    }

    if (status === 'error') {
      // Dismiss any active progress toast
      if (toastIdRef.current) {
        toast.dismiss(toastIdRef.current);
        toastIdRef.current = undefined;
      }

      // Schedule silent retry
      const retryTimer = setTimeout(() => {
        useUpdaterStore.getState().reset();
        checkForUpdate();
      }, ERROR_RETRY_MS);

      return () => clearTimeout(retryTimer);
    }
  }, [status]);
}
```

**Step 2: Commit**

```
feat(updater): Add useAutoUpdater hook with toast progress and restart actions
```

---

### Task 4: Integrate Hook into App.tsx and Remove Old Code

**Files:**
- Modify: `src/App.tsx`

**Step 1: Replace the old updater code**

Remove the entire `confirm()`/`alert()` updater block (lines 1-2 imports, lines 56-109 logic) and replace with the hook.

Updated `src/App.tsx`:

```typescript
import { useEffect } from 'react';
import { ErrorBoundary } from './components/ErrorBoundary';
import { MainWindow } from './components/layout/MainWindow';
import { ThemeProvider } from './components/ThemeProvider';
import { useAccountInitialization } from './hooks/use-account-initialization';
import { useAutoUpdater } from './hooks/use-auto-updater';
import { initializeLanguage } from './i18n/language-init';
import { initializeCommandSystem } from './lib/commands';
import { logger } from './lib/logger';
import { buildAppMenu, setupMenuLanguageListener } from './lib/menu';
import { cleanupOldFiles } from './lib/recovery';
import { commands } from './lib/tauri-bindings';

function App() {
  useAccountInitialization();
  useAutoUpdater();

  // Initialize command system and cleanup on app startup
  useEffect(() => {
    logger.info('🚀 Frontend application starting up');
    initializeCommandSystem();
    logger.debug('Command system initialized');

    // Initialize language based on saved preference or system locale
    const initLanguageAndMenu = async () => {
      try {
        // Load preferences to get saved language
        const result = await commands.loadPreferences();
        const savedLanguage = result.status === 'ok' ? result.data.language : null;

        // Initialize language (will use system locale if no preference)
        await initializeLanguage(savedLanguage);

        // Build the application menu with the initialized language
        await buildAppMenu();
        logger.debug('Application menu built');
        setupMenuLanguageListener();
      } catch (error) {
        logger.warn('Failed to initialize language or menu', { error });
      }
    };

    initLanguageAndMenu();

    // Clean up old recovery files on startup
    cleanupOldFiles().catch((error) => {
      logger.warn('Failed to cleanup old recovery files', { error });
    });

    // Example of logging with context
    logger.info('App environment', {
      isDev: import.meta.env.DEV,
      mode: import.meta.env.MODE,
    });
  }, []);

  return (
    <ErrorBoundary>
      <ThemeProvider>
        <MainWindow />
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
```

**Step 2: Run typecheck**

Run: `bun run typecheck`
Expected: PASS

**Step 3: Commit**

```
refactor(updater): Replace confirm/alert updater with useAutoUpdater hook
```

---

### Task 5: Update Menu and Command Palette Handlers

**Files:**
- Modify: `src/lib/menu.ts:432-449`
- Modify: `src/lib/commands/help-commands.ts:14-28`

**Step 1: Update menu handler in `src/lib/menu.ts`**

Replace the `handleCheckForUpdates` function (lines 432-449). Also remove the `checkLatestVersion` import and add the new import.

Old import to remove:
```typescript
import { checkLatestVersion } from '@/lib/updates';
```

New import to add:
```typescript
import { checkForUpdate, downloadUpdate } from '@/lib/updater';
import { useUpdaterStore } from '@/store/updater-store';
```

Replace `handleCheckForUpdates` function:

```typescript
async function handleCheckForUpdates(): Promise<void> {
  const _ = i18n._.bind(i18n);
  const found = await checkForUpdate();

  if (found) {
    const state = useUpdaterStore.getState();
    if (state.status === 'available') {
      notifications.info(
        _(msg`Update Available`),
        _(msg`Version ${state.version} is available. Downloading...`)
      );
      // Trigger download — the auto-updater hook will handle toast progress
      downloadUpdate();
    }
  } else {
    const state = useUpdaterStore.getState();
    if (state.status === 'error') {
      notifications.error(_(msg`Update Check Failed`), _(msg`Could not check for updates`));
    } else {
      notifications.success(_(msg`Up to Date`), _(msg`You are running the latest version`));
    }
  }
}
```

**Step 2: Update command palette handler in `src/lib/commands/help-commands.ts`**

Replace imports:
```typescript
import { msg } from '@lingui/core/macro';
import i18n from '@/i18n/config';
import { notifications } from '@/lib/notifications';
import { checkForUpdate, downloadUpdate } from '@/lib/updater';
import { useUpdaterStore } from '@/store/updater-store';
import type { AppCommand } from './types';
```

Replace the `execute` function in the check-updates command:

```typescript
execute: async () => {
  const _ = i18n._.bind(i18n);
  const found = await checkForUpdate();

  if (found) {
    const state = useUpdaterStore.getState();
    if (state.status === 'available') {
      notifications.info(
        _(msg`Update Available`),
        _(msg`Version ${state.version} is available. Downloading...`)
      );
      downloadUpdate();
    }
  } else {
    const state = useUpdaterStore.getState();
    if (state.status === 'error') {
      notifications.error(_(msg`Update Check Failed`), _(msg`Could not check for updates`));
    } else {
      notifications.success(_(msg`Up to Date`), _(msg`You are running the latest version`));
    }
  }
},
```

**Step 3: Run typecheck**

Run: `bun run typecheck`
Expected: PASS

**Step 4: Commit**

```
refactor(updater): Update menu and command palette to use new updater service
```

---

### Task 6: Enhance AboutPane with Download Progress and Install Button

**Files:**
- Modify: `src/components/preferences/panes/AboutPane.tsx`

**Step 1: Rewrite AboutPane to use shared store**

Replace the local `UpdateCheckState` type and state with Zustand store selectors. Add progress bar and restart button.

Key changes:
- Remove `useState<UpdateCheckState>` and local `handleCheckForUpdates`
- Import `useUpdaterStore` and read `status` via selector
- Import `checkForUpdate`, `downloadUpdate`, `installAndRelaunch` from `@/lib/updater`
- Add a `Progress` component (simple div-based bar) for download state
- Add "Restart to Update" button for ready state
- Keep "Check for Updates" button that calls `checkForUpdate()`

```typescript
// src/components/preferences/panes/AboutPane.tsx
import {
  Alert01Icon,
  CheckmarkCircle01Icon,
  Download04Icon,
  InformationCircleIcon,
  Loading03Icon,
  RefreshIcon,
} from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react';
import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { AppLogo } from '@/components/brand/AppLogo';
import { Button } from '@/components/ui/button';
import { checkForUpdate, downloadUpdate, installAndRelaunch } from '@/lib/updater';
import { cn } from '@/lib/utils';
import { useMinifluxVersion } from '@/services/miniflux';
import { useUpdaterStore } from '@/store/updater-store';
import { SettingsField, SettingsSection } from '../shared/SettingsComponents';

export function AboutPane() {
  const { _ } = useLingui();
  const {
    data: minifluxVersion,
    isLoading: versionLoading,
    error: versionError,
  } = useMinifluxVersion();
  const updaterStatus = useUpdaterStore((s) => s.status);

  const handleCheck = () => {
    checkForUpdate();
  };

  const handleDownload = () => {
    downloadUpdate();
  };

  const handleRestart = () => {
    installAndRelaunch();
  };

  const isChecking = updaterStatus === 'checking';
  const isDownloading = updaterStatus === 'downloading';
  const isReady = updaterStatus === 'ready';
  const isInstalling = updaterStatus === 'installing';
  const isBusy = isChecking || isDownloading || isInstalling;

  // Get version and progress from store when in relevant states
  const storeState = useUpdaterStore.getState();
  const availableVersion =
    storeState.status === 'available' || storeState.status === 'downloading' || storeState.status === 'ready'
      ? storeState.version
      : null;
  const downloadProgress = storeState.status === 'downloading' ? storeState.progress : 0;

  const updateStatusText = (() => {
    switch (updaterStatus) {
      case 'checking':
        return _(msg`Checking for updates...`);
      case 'up-to-date':
        return _(msg`You are running the latest version.`);
      case 'available':
        return _(msg`Version ${availableVersion} is available.`);
      case 'downloading':
        return _(msg`Downloading update v${availableVersion}... ${String(downloadProgress)}%`);
      case 'ready':
        return _(msg`Version ${availableVersion} is ready to install.`);
      case 'installing':
        return _(msg`Installing update...`);
      case 'error':
        return _(msg`Could not check for updates. Please try again.`);
      default:
        return _(msg`Check whether a newer release is available.`);
    }
  })();

  const updateStatusIcon = (() => {
    switch (updaterStatus) {
      case 'checking':
      case 'installing':
        return <HugeiconsIcon icon={Loading03Icon} className="size-4 animate-spin text-primary" />;
      case 'up-to-date':
        return <HugeiconsIcon icon={CheckmarkCircle01Icon} className="size-4 text-green-600" />;
      case 'available':
        return <HugeiconsIcon icon={InformationCircleIcon} className="size-4 text-blue-600" />;
      case 'downloading':
        return <HugeiconsIcon icon={Download04Icon} className="size-4 animate-pulse text-blue-600" />;
      case 'ready':
        return <HugeiconsIcon icon={CheckmarkCircle01Icon} className="size-4 text-green-600" />;
      case 'error':
        return <HugeiconsIcon icon={Alert01Icon} className="size-4 text-destructive" />;
      default:
        return <HugeiconsIcon icon={InformationCircleIcon} className="size-4 text-muted-foreground" />;
    }
  })();

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-border/60 bg-card p-4">
        <div className="flex items-center gap-3">
          <AppLogo showWordmark={false} markClassName="size-12" />
          <div>
            <h3 className="text-lg font-semibold">{_(msg`Minikyu`)}</h3>
            <p className="text-sm text-muted-foreground">{_(msg`RSS Reader`)}</p>
          </div>
        </div>
        <p className="mt-3 text-sm text-muted-foreground">
          {_(
            msg`A calm, focused space for your Miniflux reading. Catch up faster, stay organized, and enjoy every feed.`
          )}
        </p>
      </div>

      <SettingsSection title={_(msg`Version`)}>
        <SettingsField
          label={_(msg`Current version`)}
          description={_(msg`Installed version of Minikyu.`)}
        >
          <p className="text-sm font-medium">{__APP_VERSION__}</p>
        </SettingsField>

        <SettingsField label={_(msg`Latest version`)} description={updateStatusText}>
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              {updateStatusIcon}

              {isReady ? (
                <Button variant="default" onClick={handleRestart}>
                  <HugeiconsIcon icon={RefreshIcon} className="size-4" />
                  {_(msg`Restart to Update`)}
                </Button>
              ) : updaterStatus === 'available' ? (
                <Button variant="outline" onClick={handleDownload}>
                  <HugeiconsIcon icon={Download04Icon} className="size-4" />
                  {_(msg`Download Update`)}
                </Button>
              ) : (
                <Button variant="outline" onClick={handleCheck} disabled={isBusy}>
                  <HugeiconsIcon
                    icon={isChecking ? Loading03Icon : RefreshIcon}
                    className={cn('size-4', isChecking && 'animate-spin')}
                  />
                  {isChecking ? _(msg`Checking...`) : _(msg`Check latest version`)}
                </Button>
              )}
            </div>

            {isDownloading && (
              <div className="w-full max-w-48">
                <div className="h-1.5 w-full rounded-full bg-muted">
                  <div
                    className="h-1.5 rounded-full bg-primary transition-all duration-300"
                    style={{ width: `${downloadProgress}%` }}
                  />
                </div>
              </div>
            )}
          </div>
        </SettingsField>
      </SettingsSection>

      {/* Miniflux Server section stays unchanged */}
      <SettingsSection title={_(msg`Miniflux Server`)}>
        {/* ... existing miniflux version code unchanged ... */}
      </SettingsSection>
    </div>
  );
}
```

Note: Keep the Miniflux Server section exactly as-is from the existing file — only the Version section changes.

**Step 2: Run typecheck and tests**

Run: `bun run typecheck && bun run test`
Expected: PASS

**Step 3: Commit**

```
feat(updater): Enhance AboutPane with download progress and restart button
```

---

### Task 7: Delete Old Updates Module

**Files:**
- Delete: `src/lib/updates.ts`
- Delete: `src/lib/updates.test.ts`

**Step 1: Verify no remaining references to old module**

Run: `grep -r "from.*updates" src/ --include="*.ts" --include="*.tsx" | grep -v node_modules | grep -v updater`

Expected: No results (all references should now point to `@/lib/updater`)

**Step 2: Delete old files**

```bash
rm -f src/lib/updates.ts src/lib/updates.test.ts
```

**Step 3: Run typecheck and tests**

Run: `bun run typecheck && bun run test`
Expected: PASS

**Step 4: Commit**

```
refactor(updater): Remove old updates module replaced by updater service
```

---

### Task 8: Extract i18n Strings and Run Full Check

**Step 1: Extract i18n strings**

Run: `bun run i18n:extract`

**Step 2: Compile i18n catalogs**

Run: `bun run i18n:compile`

**Step 3: Run full quality gate**

Run: `bun run check:all`
Expected: PASS

**Step 4: Commit**

```
chore(i18n): Extract and compile new updater translation strings
```

---

### Task 9: Manual Verification

**Step 1: Start the dev server**

Run: `bun run dev`

**Step 2: Verify these behaviors:**

1. App launches without errors
2. After ~5 seconds, the auto-update check runs silently (check dev console for logger output)
3. Open Settings → About → "Check latest version" button works
4. If an update is available:
   - Toast appears with download progress
   - Progress bar shows in About pane
   - Toast transitions to "Restart Now" / "Later" when done
5. Menu → "Check for Updates..." triggers the same flow
6. Command palette → "Check for Updates" triggers the same flow

**Step 3: Final commit if any fixups needed**
