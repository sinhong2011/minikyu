import { msg } from '@lingui/core/macro';
import type { AppCommand } from './types';

export const navigationCommands: AppCommand[] = [
  {
    id: 'show-left-sidebar',
    label: msg`Show Left Sidebar`,
    description: msg`Show the left sidebar`,
    group: 'navigation',
    execute: (context) => {
      context.showToast('Not implemented yet', 'info');
    },
  },
  {
    id: 'hide-left-sidebar',
    label: msg`Hide Left Sidebar`,
    description: msg`Hide the left sidebar`,
    group: 'navigation',
    execute: (context) => {
      context.showToast('Not implemented yet', 'info');
    },
  },
  {
    id: 'open-preferences',
    label: msg`Open Preferences`,
    description: msg`Open the application preferences`,
    group: 'navigation',
    execute: (context) => {
      context.openPreferences();
    },
  },
];
