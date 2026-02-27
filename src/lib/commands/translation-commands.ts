import { msg } from '@lingui/core/macro';
import type { AppCommand } from './types';

export const translationCommands: AppCommand[] = [
  {
    id: 'translate-article',
    label: msg`Translate Article`,
    description: msg`Toggle translation for the current article`,
    group: 'article',
    shortcut: '⌘⇧T',
    keywords: ['translate', 'translation', 'language', 'ai'],
    isAvailable: (context) => context.getSelectedEntryId() !== undefined,
    execute: () => {
      document.dispatchEvent(new CustomEvent('command:translate'));
    },
  },
  {
    id: 'translate-display-bilingual',
    label: msg`Translation: Bilingual Mode`,
    description: msg`Show original text alongside translation`,
    group: 'article',
    keywords: ['translate', 'bilingual', 'dual', 'display', 'mode'],
    isAvailable: (context) => context.getSelectedEntryId() !== undefined,
    execute: () => {
      document.dispatchEvent(
        new CustomEvent('command:set-translation-display-mode', { detail: 'bilingual' })
      );
    },
  },
  {
    id: 'translate-display-translated-only',
    label: msg`Translation: Translated Only`,
    description: msg`Show only the translated text`,
    group: 'article',
    keywords: ['translate', 'translated', 'only', 'display', 'mode'],
    isAvailable: (context) => context.getSelectedEntryId() !== undefined,
    execute: () => {
      document.dispatchEvent(
        new CustomEvent('command:set-translation-display-mode', { detail: 'translated_only' })
      );
    },
  },
];
