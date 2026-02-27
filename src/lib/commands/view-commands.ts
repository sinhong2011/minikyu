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
