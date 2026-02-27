import { msg } from '@lingui/core/macro';
import i18n from '@/i18n/config';
import { commands } from '@/lib/tauri-bindings';
import type { AppCommand } from './types';

export const articleCommands: AppCommand[] = [
  {
    id: 'article-mark-read',
    label: msg`Mark as Read/Unread`,
    description: msg`Toggle the read status of the current article`,
    group: 'article',
    shortcut: '⌘⇧U',
    keywords: ['read', 'unread', 'mark', 'status'],
    isAvailable: (context) => context.getSelectedEntryId() !== undefined,
    execute: async (context) => {
      const entryId = context.getSelectedEntryId();
      if (!entryId) return;
      const _ = i18n._.bind(i18n);
      try {
        const result = await commands.toggleEntryRead(entryId);
        if (result.status === 'error') {
          context.showToast(_(msg`Failed to toggle read status`), 'error');
        }
      } catch {
        context.showToast(_(msg`Failed to toggle read status`), 'error');
      }
    },
  },
  {
    id: 'article-toggle-star',
    label: msg`Toggle Star`,
    description: msg`Star or unstar the current article`,
    group: 'article',
    shortcut: '⌘⇧S',
    keywords: ['star', 'favorite', 'bookmark', 'save'],
    isAvailable: (context) => context.getSelectedEntryId() !== undefined,
    execute: async (context) => {
      const entryId = context.getSelectedEntryId();
      if (!entryId) return;
      const _ = i18n._.bind(i18n);
      try {
        const result = await commands.toggleEntryStar(entryId);
        if (result.status === 'error') {
          context.showToast(_(msg`Failed to toggle star`), 'error');
        }
      } catch {
        context.showToast(_(msg`Failed to toggle star`), 'error');
      }
    },
  },
  {
    id: 'article-fetch-content',
    label: msg`Fetch Original Content`,
    description: msg`Download the full article from the original source`,
    group: 'article',
    shortcut: '⌘⇧F',
    keywords: ['fetch', 'original', 'content', 'full'],
    isAvailable: (context) => context.getSelectedEntryId() !== undefined,
    execute: async (context) => {
      const entryId = context.getSelectedEntryId();
      if (!entryId) return;
      const _ = i18n._.bind(i18n);
      try {
        const result = await commands.fetchEntryContent(entryId, true);
        if (result.status === 'ok') {
          context.showToast(_(msg`Original content fetched`), 'success');
        } else {
          context.showToast(_(msg`Failed to fetch content`), 'error');
        }
      } catch {
        context.showToast(_(msg`Failed to fetch content`), 'error');
      }
    },
  },
  {
    id: 'article-open-browser',
    label: msg`Open in Browser`,
    description: msg`Open the article in an external browser`,
    group: 'article',
    shortcut: '⌘⇧O',
    keywords: ['browser', 'external', 'open', 'web'],
    isAvailable: (context) => context.getSelectedEntryId() !== undefined,
    execute: () => {
      document.dispatchEvent(new CustomEvent('command:open-in-browser'));
    },
  },
  {
    id: 'article-open-in-app-browser',
    label: msg`Open in App Browser`,
    description: msg`Open the article in the built-in browser`,
    group: 'article',
    keywords: ['browser', 'in-app', 'internal', 'web'],
    isAvailable: (context) => context.getSelectedEntryId() !== undefined,
    execute: () => {
      document.dispatchEvent(new CustomEvent('command:open-in-app-browser'));
    },
  },
  {
    id: 'article-copy-link',
    label: msg`Copy Link`,
    description: msg`Copy the article link to clipboard`,
    group: 'article',
    shortcut: '⌘⇧C',
    keywords: ['copy', 'link', 'url', 'clipboard'],
    isAvailable: (context) => context.getSelectedEntryId() !== undefined,
    execute: () => {
      document.dispatchEvent(new CustomEvent('command:copy-link'));
    },
  },
  {
    id: 'article-summarize',
    label: msg`Summarize with AI`,
    description: msg`Generate an AI summary of the current article`,
    group: 'article',
    keywords: ['ai', 'summary', 'summarize', 'llm', 'gpt'],
    isAvailable: (context) => context.getSelectedEntryId() !== undefined,
    execute: () => {
      document.dispatchEvent(new CustomEvent('command:summarize-article'));
    },
  },
];
