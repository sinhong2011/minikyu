import { msg } from '@lingui/core/macro';
import { getCurrentWindow } from '@tauri-apps/api/window';
import i18n from '@/i18n/config';
import type { AppCommand } from './types';

export const windowCommands: AppCommand[] = [
  {
    id: 'window-close',
    label: msg`Close Window`,
    description: msg`Close the current window`,
    shortcut: '⌘+W',

    execute: async (context) => {
      try {
        const appWindow = getCurrentWindow();
        await appWindow.close();
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        context.showToast(i18n._(msg`Failed to close window: ${message}`), 'error');
      }
    },
  },

  {
    id: 'window-minimize',
    label: msg`Minimize Window`,
    description: msg`Minimize the current window`,
    shortcut: '⌘+M',

    execute: async (context) => {
      try {
        const appWindow = getCurrentWindow();
        await appWindow.minimize();
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        context.showToast(i18n._(msg`Failed to minimize window: ${message}`), 'error');
      }
    },
  },

  {
    id: 'window-toggle-maximize',
    label: msg`Toggle Maximize`,
    description: msg`Toggle window maximize state`,

    execute: async (context) => {
      try {
        const appWindow = getCurrentWindow();
        await appWindow.toggleMaximize();
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        context.showToast(i18n._(msg`Failed to toggle maximize: ${message}`), 'error');
      }
    },
  },

  {
    id: 'window-fullscreen',
    label: msg`Enter Fullscreen`,
    description: msg`Enter fullscreen mode`,
    shortcut: 'F11',

    execute: async (context) => {
      try {
        const appWindow = getCurrentWindow();
        await appWindow.setFullscreen(true);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        context.showToast(i18n._(msg`Failed to enter fullscreen: ${message}`), 'error');
      }
    },
  },

  {
    id: 'window-exit-fullscreen',
    label: msg`Exit Fullscreen`,
    description: msg`Exit fullscreen mode`,
    shortcut: 'Escape',

    execute: async (context) => {
      try {
        const appWindow = getCurrentWindow();
        await appWindow.setFullscreen(false);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        context.showToast(i18n._(msg`Failed to exit fullscreen: ${message}`), 'error');
      }
    },
  },
];
