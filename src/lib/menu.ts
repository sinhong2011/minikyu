import { msg } from '@lingui/core/macro';
import { Menu, MenuItem, PredefinedMenuItem, Submenu } from '@tauri-apps/api/menu';
import { confirm } from '@tauri-apps/plugin-dialog';
import { i18n } from '@/i18n';
import { resetAccountState } from '@/lib/account-reset';
import { logger } from '@/lib/logger';
import { notifications } from '@/lib/notifications';
import { commands } from '@/lib/tauri-bindings';
import { checkForUpdate, downloadUpdate } from '@/lib/updater';
import { usePlayerStore } from '@/store/player-store';
import { useUIStore } from '@/store/ui-store';
import { useUpdaterStore } from '@/store/updater-store';

const APP_NAME = 'Minikyu';

export async function buildAppMenu(): Promise<Menu> {
  const _ = i18n._.bind(i18n);

  try {
    // -- App menu (Minikyu) --
    const appSubmenu = await Submenu.new({
      text: APP_NAME,
      items: [
        await MenuItem.new({
          id: 'about',
          text: _(msg`About ${APP_NAME}`),
          action: handleAbout,
        }),
        await PredefinedMenuItem.new({ item: 'Separator' }),
        await MenuItem.new({
          id: 'check-updates',
          text: _(msg`Check for Updates...`),
          action: handleCheckForUpdates,
        }),
        await PredefinedMenuItem.new({ item: 'Separator' }),
        await MenuItem.new({
          id: 'preferences',
          text: _(msg`Preferences...`),
          accelerator: 'CmdOrCtrl+,',
          action: handleOpenPreferences,
        }),
        await PredefinedMenuItem.new({ item: 'Separator' }),
        await PredefinedMenuItem.new({
          item: 'Hide',
          text: _(msg`Hide ${APP_NAME}`),
        }),
        await PredefinedMenuItem.new({
          item: 'HideOthers',
          text: _(msg`Hide Others`),
        }),
        await PredefinedMenuItem.new({
          item: 'ShowAll',
          text: _(msg`Show All`),
        }),
        await PredefinedMenuItem.new({ item: 'Separator' }),
        await MenuItem.new({
          id: 'quit',
          text: _(msg`Quit ${APP_NAME}`),
          accelerator: 'CmdOrCtrl+Q',
          action: handleQuitApp,
        }),
      ],
    });

    // -- File menu --
    const fileSubmenu = await Submenu.new({
      text: _(msg`File`),
      items: [
        await MenuItem.new({
          id: 'add-feed',
          text: _(msg`New Feed...`),
          accelerator: 'CmdOrCtrl+N',
          action: handleAddFeed,
        }),
        await MenuItem.new({
          id: 'add-category',
          text: _(msg`New Category...`),
          accelerator: 'CmdOrCtrl+Shift+N',
          action: handleAddCategory,
        }),
        await PredefinedMenuItem.new({ item: 'Separator' }),
        await MenuItem.new({
          id: 'import-opml',
          text: _(msg`Import OPML...`),
          action: handleImportOpml,
        }),
        await MenuItem.new({
          id: 'export-opml',
          text: _(msg`Export OPML...`),
          action: handleExportOpml,
        }),
        await PredefinedMenuItem.new({ item: 'Separator' }),
        await MenuItem.new({
          id: 'sync-now',
          text: _(msg`Sync Now`),
          accelerator: 'CmdOrCtrl+R',
          action: handleSyncNow,
        }),
        await MenuItem.new({
          id: 'refresh-all',
          text: _(msg`Refresh All Feeds`),
          accelerator: 'CmdOrCtrl+Shift+R',
          action: handleRefreshAllFeeds,
        }),
        await PredefinedMenuItem.new({ item: 'Separator' }),
        await MenuItem.new({
          id: 'add-account',
          text: _(msg`Add Account...`),
          action: handleAddAccount,
        }),
        await MenuItem.new({
          id: 'delete-account',
          text: _(msg`Delete Account...`),
          action: handleDeleteAccount,
        }),
        await PredefinedMenuItem.new({ item: 'Separator' }),
        await PredefinedMenuItem.new({ item: 'CloseWindow' }),
      ],
    });

    // -- Edit menu --
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

    // -- View menu --
    const readerThemeSubmenu = await Submenu.new({
      text: _(msg`Reader Theme`),
      items: [
        await MenuItem.new({
          id: 'theme-default',
          text: _(msg`Default`),
          action: () => handleSetReaderTheme('default'),
        }),
        await MenuItem.new({
          id: 'theme-paper',
          text: _(msg`Paper`),
          action: () => handleSetReaderTheme('paper'),
        }),
        await MenuItem.new({
          id: 'theme-sepia',
          text: _(msg`Sepia`),
          action: () => handleSetReaderTheme('sepia'),
        }),
        await MenuItem.new({
          id: 'theme-slate',
          text: _(msg`Slate`),
          action: () => handleSetReaderTheme('slate'),
        }),
        await MenuItem.new({
          id: 'theme-oled',
          text: _(msg`OLED`),
          action: () => handleSetReaderTheme('oled'),
        }),
      ],
    });

    const viewSubmenu = await Submenu.new({
      text: _(msg`View`),
      items: [
        await MenuItem.new({
          id: 'toggle-left-sidebar',
          text: _(msg`Toggle Left Sidebar`),
          accelerator: 'CmdOrCtrl+1',
          action: handleToggleLeftSidebar,
        }),
        await MenuItem.new({
          id: 'toggle-downloads',
          text: _(msg`Toggle Downloads`),
          accelerator: 'CmdOrCtrl+D',
          action: handleToggleDownloads,
        }),
        await MenuItem.new({
          id: 'zen-mode',
          text: _(msg`Zen Mode`),
          action: handleZenMode,
        }),
        await PredefinedMenuItem.new({ item: 'Separator' }),
        await MenuItem.new({
          id: 'ui-zoom-in',
          text: _(msg`Zoom In`),
          accelerator: 'CmdOrCtrl+Plus',
          action: handleUiZoomIn,
        }),
        await MenuItem.new({
          id: 'ui-zoom-out',
          text: _(msg`Zoom Out`),
          accelerator: 'CmdOrCtrl+-',
          action: handleUiZoomOut,
        }),
        await MenuItem.new({
          id: 'ui-zoom-reset',
          text: _(msg`Reset Zoom`),
          accelerator: 'CmdOrCtrl+0',
          action: handleUiZoomReset,
        }),
        await PredefinedMenuItem.new({ item: 'Separator' }),
        readerThemeSubmenu,
        await PredefinedMenuItem.new({ item: 'Separator' }),
        await PredefinedMenuItem.new({ item: 'Fullscreen' }),
      ],
    });

    // -- Article menu --
    const articleSubmenu = await Submenu.new({
      text: _(msg`Article`),
      items: [
        await MenuItem.new({
          id: 'article-read',
          text: _(msg`Mark as Read/Unread`),
          accelerator: 'CmdOrCtrl+Shift+U',
          action: () => dispatchCommand('command:toggle-read'),
        }),
        await MenuItem.new({
          id: 'article-star',
          text: _(msg`Toggle Star`),
          accelerator: 'CmdOrCtrl+Shift+S',
          action: () => dispatchCommand('command:toggle-star'),
        }),
        await PredefinedMenuItem.new({ item: 'Separator' }),
        await MenuItem.new({
          id: 'article-fetch',
          text: _(msg`Fetch Original Content`),
          accelerator: 'CmdOrCtrl+Shift+F',
          action: () => dispatchCommand('command:fetch-content'),
        }),
        await MenuItem.new({
          id: 'article-translate',
          text: _(msg`Translate Article`),
          accelerator: 'CmdOrCtrl+Shift+T',
          action: () => dispatchCommand('command:translate'),
        }),
        await MenuItem.new({
          id: 'article-summarize',
          text: _(msg`Summarize with AI`),
          action: () => dispatchCommand('command:summarize-article'),
        }),
        await PredefinedMenuItem.new({ item: 'Separator' }),
        await MenuItem.new({
          id: 'article-browser',
          text: _(msg`Open in Browser`),
          accelerator: 'CmdOrCtrl+Shift+O',
          action: () => dispatchCommand('command:open-in-browser'),
        }),
        await MenuItem.new({
          id: 'article-app-browser',
          text: _(msg`Open in App Browser`),
          action: () => dispatchCommand('command:open-in-app-browser'),
        }),
        await MenuItem.new({
          id: 'article-copy-link',
          text: _(msg`Copy Link`),
          accelerator: 'CmdOrCtrl+Shift+C',
          action: () => dispatchCommand('command:copy-link'),
        }),
        await PredefinedMenuItem.new({ item: 'Separator' }),
        await MenuItem.new({
          id: 'article-prev',
          text: _(msg`Previous Article`),
          accelerator: 'CmdOrCtrl+[',
          action: () => dispatchCommand('command:prev-article'),
        }),
        await MenuItem.new({
          id: 'article-next',
          text: _(msg`Next Article`),
          accelerator: 'CmdOrCtrl+]',
          action: () => dispatchCommand('command:next-article'),
        }),
        await PredefinedMenuItem.new({ item: 'Separator' }),
        await MenuItem.new({
          id: 'article-font-increase',
          text: _(msg`Increase Reader Font`),
          action: handleFontSizeIncrease,
        }),
        await MenuItem.new({
          id: 'article-font-decrease',
          text: _(msg`Decrease Reader Font`),
          action: handleFontSizeDecrease,
        }),
        await MenuItem.new({
          id: 'article-font-reset',
          text: _(msg`Reset Reader Font`),
          action: handleFontSizeReset,
        }),
      ],
    });

    // -- Podcast menu --
    const podcastSubmenu = await Submenu.new({
      text: _(msg`Podcast`),
      items: [
        await MenuItem.new({
          id: 'podcast-play-pause',
          text: _(msg`Play / Pause`),
          action: () => dispatchCommand('player:cmd:toggle-play-pause'),
        }),
        await PredefinedMenuItem.new({ item: 'Separator' }),
        await MenuItem.new({
          id: 'podcast-skip-back',
          text: _(msg`Skip Back 15s`),
          action: handlePodcastSkipBack,
        }),
        await MenuItem.new({
          id: 'podcast-skip-forward',
          text: _(msg`Skip Forward 30s`),
          action: handlePodcastSkipForward,
        }),
        await PredefinedMenuItem.new({ item: 'Separator' }),
        await MenuItem.new({
          id: 'podcast-speed-decrease',
          text: _(msg`Decrease Speed`),
          accelerator: 'CmdOrCtrl+Shift+[',
          action: handlePodcastSpeedDecrease,
        }),
        await MenuItem.new({
          id: 'podcast-speed-increase',
          text: _(msg`Increase Speed`),
          accelerator: 'CmdOrCtrl+Shift+]',
          action: handlePodcastSpeedIncrease,
        }),
        await MenuItem.new({
          id: 'podcast-speed-reset',
          text: _(msg`Reset Speed`),
          action: handlePodcastSpeedReset,
        }),
        await PredefinedMenuItem.new({ item: 'Separator' }),
        await MenuItem.new({
          id: 'podcast-mute',
          text: _(msg`Mute / Unmute`),
          action: handlePodcastToggleMute,
        }),
        await MenuItem.new({
          id: 'podcast-volume-up',
          text: _(msg`Volume Up`),
          action: handlePodcastVolumeUp,
        }),
        await MenuItem.new({
          id: 'podcast-volume-down',
          text: _(msg`Volume Down`),
          action: handlePodcastVolumeDown,
        }),
        await PredefinedMenuItem.new({ item: 'Separator' }),
        await MenuItem.new({
          id: 'podcast-player-window',
          text: _(msg`Open Player Window`),
          action: handleTogglePlayerWindow,
        }),
        await MenuItem.new({
          id: 'podcast-mini-player',
          text: _(msg`Toggle Mini Player`),
          action: handleToggleMiniPlayer,
        }),
        await PredefinedMenuItem.new({ item: 'Separator' }),
        await MenuItem.new({
          id: 'podcast-dismiss',
          text: _(msg`Dismiss Player`),
          action: handlePodcastDismiss,
        }),
      ],
    });

    // -- Window menu --
    const windowSubmenu = await Submenu.new({
      text: _(msg`Window`),
      items: [
        await PredefinedMenuItem.new({ item: 'Minimize' }),
        await PredefinedMenuItem.new({ item: 'Maximize' }),
        await PredefinedMenuItem.new({ item: 'Separator' }),
        await PredefinedMenuItem.new({ item: 'Fullscreen' }),
        await PredefinedMenuItem.new({ item: 'Separator' }),
        await PredefinedMenuItem.new({ item: 'CloseWindow' }),
      ],
    });

    // -- Help menu --
    const helpSubmenu = await Submenu.new({
      text: _(msg`Help`),
      items: [
        await MenuItem.new({
          id: 'help-report',
          text: _(msg`Report an Issue...`),
          action: () => window.open('https://github.com/sinhong2011/minikyu/issues', '_blank'),
        }),
      ],
    });

    const menu = await Menu.new({
      items: [
        appSubmenu,
        fileSubmenu,
        editSubmenu,
        viewSubmenu,
        articleSubmenu,
        podcastSubmenu,
        windowSubmenu,
        helpSubmenu,
      ],
    });

    await menu.setAsAppMenu();

    logger.info('Application menu built successfully');
    return menu;
  } catch (error) {
    logger.error('Failed to build application menu', { error });
    throw error;
  }
}

export function setupMenuLanguageListener(): () => void {
  const handler = async () => {
    logger.info('Language changed, rebuilding menu');
    try {
      await buildAppMenu();
    } catch (error) {
      logger.error('Failed to rebuild menu on language change', { error });
    }
  };

  const unsubscribe = i18n.on('change', handler);

  return () => {
    if (unsubscribe) unsubscribe();
  };
}

// -- Utility --

function dispatchCommand(eventName: string): void {
  document.dispatchEvent(new CustomEvent(eventName));
}

// -- Menu action handlers --

function handleAbout(): void {
  useUIStore.getState().setPreferencesActivePane('about');
  useUIStore.getState().setPreferencesOpen(true);
}

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

function handleOpenPreferences(): void {
  useUIStore.getState().setPreferencesActivePane('general');
  useUIStore.getState().setPreferencesOpen(true);
}

function handleToggleLeftSidebar(): void {
  useUIStore.getState().toggleLeftSidebar();
}

async function handleQuitApp(): Promise<void> {
  const result = await commands.trayQuitApp();
  if (result.status === 'error') {
    logger.error('Failed to quit application', { error: result.error });
  }
}

function handleAddFeed(): void {
  dispatchCommand('command:add-feed');
}

function handleAddCategory(): void {
  dispatchCommand('command:add-category');
}

function handleImportOpml(): void {
  useUIStore.getState().openPreferencesToPane('feeds');
}

function handleExportOpml(): void {
  useUIStore.getState().openPreferencesToPane('feeds');
}

function handleAddAccount(): void {
  useUIStore.getState().setShowConnectionDialog(true);
}

async function handleDeleteAccount(): Promise<void> {
  const _ = i18n._.bind(i18n);
  const result = await commands.getActiveMinifluxAccount();
  if (result.status !== 'ok' || !result.data) return;

  const confirmed = await confirm(
    _(
      msg`Are you sure you want to delete this account? This will remove all credentials and data associated with this account.`
    ),
    { title: _(msg`Delete Account`), kind: 'warning' }
  );

  if (!confirmed) return;

  const deleteResult = await commands.deleteMinifluxAccount(result.data.id);
  if (deleteResult.status === 'ok') {
    await resetAccountState();
  }
}

async function handleSyncNow(): Promise<void> {
  const _ = i18n._.bind(i18n);
  try {
    const result = await commands.syncMiniflux();
    if (result.status === 'ok') {
      notifications.success(_(msg`Sync Completed`), _(msg`All feeds synchronized`));
    } else {
      notifications.error(_(msg`Sync Failed`), result.error);
    }
  } catch (error) {
    logger.error('Sync failed', { error });
    const message = error instanceof Error ? error.message : 'Unknown error';
    notifications.error(_(msg`Sync Failed`), message);
  }
}

async function handleRefreshAllFeeds(): Promise<void> {
  const _ = i18n._.bind(i18n);
  try {
    const result = await commands.refreshAllFeeds();
    if (result.status === 'ok') {
      notifications.success(_(msg`Refresh Complete`), _(msg`All feeds refreshed`));
    } else {
      notifications.error(_(msg`Refresh Failed`), result.error);
    }
  } catch (error) {
    logger.error('Refresh all feeds failed', { error });
    const message = error instanceof Error ? error.message : 'Unknown error';
    notifications.error(_(msg`Refresh Failed`), message);
  }
}

function handleToggleDownloads(): void {
  useUIStore.getState().toggleDownloads();
}

function handleZenMode(): void {
  useUIStore.getState().toggleZenMode();
}

function handleUiZoomIn(): void {
  document.dispatchEvent(new CustomEvent('command:ui-zoom-in'));
}

function handleUiZoomOut(): void {
  document.dispatchEvent(new CustomEvent('command:ui-zoom-out'));
}

function handleUiZoomReset(): void {
  document.dispatchEvent(new CustomEvent('command:ui-zoom-reset'));
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

// -- Podcast handlers --

function handlePodcastSkipBack(): void {
  const player = usePlayerStore.getState();
  player.seek(Math.max(0, player.currentTime - 15));
}

function handlePodcastSkipForward(): void {
  const player = usePlayerStore.getState();
  player.seek(Math.min(player.duration, player.currentTime + 30));
}

function handlePodcastSpeedIncrease(): void {
  const player = usePlayerStore.getState();
  player.setSpeed(Math.min(3, Math.round((player.playbackSpeed + 0.25) * 100) / 100));
}

function handlePodcastSpeedDecrease(): void {
  const player = usePlayerStore.getState();
  player.setSpeed(Math.max(0.5, Math.round((player.playbackSpeed - 0.25) * 100) / 100));
}

function handlePodcastSpeedReset(): void {
  usePlayerStore.getState().setSpeed(1.0);
}

function handlePodcastToggleMute(): void {
  usePlayerStore.getState().toggleMute();
}

function handlePodcastVolumeUp(): void {
  const player = usePlayerStore.getState();
  player.setVolume(Math.min(1, Math.round((player.volume + 0.1) * 100) / 100));
}

function handlePodcastVolumeDown(): void {
  const player = usePlayerStore.getState();
  player.setVolume(Math.max(0, Math.round((player.volume - 0.1) * 100) / 100));
}

async function handleTogglePlayerWindow(): Promise<void> {
  await commands.togglePlayerWindow();
}

async function handleToggleMiniPlayer(): Promise<void> {
  await commands.toggleTrayPopover();
}

function handlePodcastDismiss(): void {
  usePlayerStore.getState().dismiss();
}
