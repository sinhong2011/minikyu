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
    shortcut: 'Z',
    keywords: ['zen', 'focus', 'distraction', 'reading'],
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
