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
    id: 'toggle-focus-mode',
    label: msg`Toggle Focus Mode`,
    description: msg`Dim paragraphs except the one you're reading`,
    group: 'view',
    shortcut: 'V',
    keywords: ['focus', 'mode', 'dim', 'reading', 'concentration'],
    execute: () => {
      document.dispatchEvent(new CustomEvent('command:toggle-focus-mode'));
    },
  },
  {
    id: 'app-theme-light',
    label: msg`Theme: Light`,
    description: msg`Switch to light theme`,
    group: 'view',
    keywords: ['theme', 'light', 'bright', 'appearance'],
    execute: () => {
      document.dispatchEvent(new CustomEvent('command:set-app-theme', { detail: 'light' }));
    },
  },
  {
    id: 'app-theme-dark',
    label: msg`Theme: Dark`,
    description: msg`Switch to dark theme`,
    group: 'view',
    keywords: ['theme', 'dark', 'night', 'appearance'],
    execute: () => {
      document.dispatchEvent(new CustomEvent('command:set-app-theme', { detail: 'dark' }));
    },
  },
  {
    id: 'app-theme-system',
    label: msg`Theme: System`,
    description: msg`Follow system theme`,
    group: 'view',
    keywords: ['theme', 'system', 'auto', 'appearance'],
    execute: () => {
      document.dispatchEvent(new CustomEvent('command:set-app-theme', { detail: 'system' }));
    },
  },
  {
    id: 'language-english',
    label: msg`Language: English`,
    group: 'view',
    keywords: ['language', 'english', 'en'],
    execute: () => {
      document.dispatchEvent(new CustomEvent('command:set-language', { detail: 'en' }));
    },
  },
  {
    id: 'language-zh-cn',
    label: msg`Language: 简体中文`,
    group: 'view',
    keywords: ['language', 'chinese', 'simplified', '中文', '简体'],
    execute: () => {
      document.dispatchEvent(new CustomEvent('command:set-language', { detail: 'zh-CN' }));
    },
  },
  {
    id: 'language-zh-tw',
    label: msg`Language: 繁體中文`,
    group: 'view',
    keywords: ['language', 'chinese', 'traditional', '中文', '繁體'],
    execute: () => {
      document.dispatchEvent(new CustomEvent('command:set-language', { detail: 'zh-TW' }));
    },
  },
  {
    id: 'language-ja',
    label: msg`Language: 日本語`,
    group: 'view',
    keywords: ['language', 'japanese', '日本語'],
    execute: () => {
      document.dispatchEvent(new CustomEvent('command:set-language', { detail: 'ja' }));
    },
  },
  {
    id: 'language-ko',
    label: msg`Language: 한국어`,
    group: 'view',
    keywords: ['language', 'korean', '한국어'],
    execute: () => {
      document.dispatchEvent(new CustomEvent('command:set-language', { detail: 'ko' }));
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
  {
    id: 'change-background-image',
    label: msg`Change Background Image`,
    description: msg`Set background from file or URL`,
    group: 'view',
    keywords: ['background', 'wallpaper', 'image', 'url', 'picture'],
    execute: () => {
      document.dispatchEvent(
        new CustomEvent('command:navigate-page', { detail: 'background-image' })
      );
    },
  },
];
