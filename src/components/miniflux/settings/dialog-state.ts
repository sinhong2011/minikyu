import type { Category, Feed, User } from '@/lib/tauri-bindings';

export type MinifluxSettingsPane = 'categories' | 'feeds' | 'users' | 'token' | 'integrations';

export type CategoryDialogState = { mode: 'create' } | { mode: 'edit'; category: Category };

export type FeedDialogState =
  | {
      mode: 'create';
      defaultCategoryId: string | null;
      initialFeedUrl: string;
      initialSearchOpen?: boolean;
    }
  | { mode: 'edit'; feed: Feed };

export type UserDialogState = { mode: 'create' } | { mode: 'edit'; user: User };

export type DeleteDialogState =
  | { type: 'category'; id: string; title: string }
  | { type: 'feed'; id: string; title: string }
  | { type: 'user'; id: string; title: string };
