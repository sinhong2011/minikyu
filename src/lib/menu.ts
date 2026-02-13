import { msg } from '@lingui/core/macro';
import { Menu, MenuItem, PredefinedMenuItem, Submenu } from '@tauri-apps/api/menu';
import { i18n } from '@/i18n';
import { logger } from '@/lib/logger';
import { notifications } from '@/lib/notifications';
import { checkLatestVersion } from '@/lib/updates';
import { useUIStore } from '@/store/ui-store';

const APP_NAME = 'Minikyu';

export async function buildAppMenu(): Promise<Menu> {
  const _ = i18n._.bind(i18n);

  try {
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
        await PredefinedMenuItem.new({
          item: 'Quit',
          text: _(msg`Quit ${APP_NAME}`),
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
      ],
    });

    const menu = await Menu.new({
      items: [appSubmenu, viewSubmenu],
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

// Menu action handlers

function handleAbout(): void {
  logger.info('About menu item clicked');
  useUIStore.getState().setPreferencesActivePane('about');
  useUIStore.getState().setPreferencesOpen(true);
}

async function handleCheckForUpdates(): Promise<void> {
  logger.info('Check for Updates menu item clicked');
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
  } catch (error) {
    logger.error('Update check failed', { error });
    notifications.error(_(msg`Update Check Failed`), _(msg`Could not check for updates`));
  }
}

function handleOpenPreferences(): void {
  logger.info('Preferences menu item clicked');
  useUIStore.getState().setPreferencesActivePane('general');
  useUIStore.getState().setPreferencesOpen(true);
}

function handleToggleLeftSidebar(): void {
  logger.info('Toggle Left Sidebar menu item clicked');
  useUIStore.getState().toggleLeftSidebar();
}
