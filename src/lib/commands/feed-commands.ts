import { msg } from '@lingui/core/macro';
import i18n from '@/i18n/config';
import { commands } from '@/lib/tauri-bindings';
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
    execute: () => {
      document.dispatchEvent(new CustomEvent('command:add-feed'));
    },
  },
  {
    id: 'category-add',
    label: msg`Add New Category...`,
    description: msg`Create a new feed category`,
    group: 'feed',
    shortcut: '⌘⇧N',
    keywords: ['category', 'folder', 'group', 'new'],
    execute: () => {
      document.dispatchEvent(new CustomEvent('command:add-category'));
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
    execute: () => {
      useUIStore.getState().openPreferencesToPane('feeds');
    },
  },
  {
    id: 'export-opml',
    label: msg`Export OPML...`,
    description: msg`Export feeds to an OPML file`,
    group: 'feed',
    keywords: ['export', 'opml', 'backup', 'save'],
    execute: () => {
      useUIStore.getState().openPreferencesToPane('feeds');
    },
  },
];
