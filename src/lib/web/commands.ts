/**
 * Web (PWA) implementation of the Tauri command surface.
 *
 * `vite.config.ts` aliases `@/lib/tauri-bindings` to this module when building
 * with `--mode web`, so the 100+ call sites in `src/` are untouched: they keep
 * importing `commands` and the generated types, and get a browser-backed
 * implementation instead of `invoke()`.
 *
 * Scope is deliberately the core reading loop — connect, categories, feeds,
 * entries, counters, read/star. It is **online-only**: every call hits the
 * Miniflux REST API directly, there is no local mirror and no offline sync.
 * Everything the Rust backend owns (downloads, podcast windows, tray,
 * translation, cloud sync, updater, ...) throws `UnsupportedInWebError`; the UI
 * is expected to gate on `@/lib/platform` first.
 *
 * Types are re-exported from the generated bindings, so this module is checked
 * against the exact same contract the desktop build uses.
 */

import type {
  ApiKey,
  ApiKeyCreate,
  AppPreferences,
  AuthConfig,
  Category,
  commands as generatedCommands,
  Entry,
  EntryFilters,
  EntryResponse,
  EntryUpdate,
  Feed,
  FeedUpdate,
  Integration,
  LastReadingEntry,
  MinifluxConnection,
  MinifluxVersion,
  Subscription,
  SyncSummary,
  UnreadCounts,
  User,
  UserCreate,
  UserUpdate,
} from '../bindings';
import { credentialsFor, MinifluxHttpError, request } from './client';
import { unsupported, UnsupportedInWebError } from './errors';
import { normalizeIds, toNumericId } from './normalize';
import { accountStorage, clearAll, lastReadingStorage, preferencesStorage } from './storage';

export type * from '../bindings';
export { UnsupportedInWebError } from './errors';

type GeneratedCommands = typeof generatedCommands;
type Ok<T> = { status: 'ok'; data: T };
type Err<E> = { status: 'error'; error: E };

const ok = <T>(data: T): Ok<T> => ({ status: 'ok', data });
const err = <E>(error: E): Err<E> => ({ status: 'error', error });

/** Runs `fn`, mapping any thrown error into the bindings' `Result` error arm. */
async function attempt<T>(fn: () => Promise<T>): Promise<Ok<T> | Err<string>> {
  try {
    return ok(await fn());
  } catch (error) {
    if (error instanceof UnsupportedInWebError) throw error;
    return err(error instanceof Error ? error.message : String(error));
  }
}

function connectionFromStorage(): MinifluxConnection | null {
  const account = accountStorage.get();
  if (!account) return null;
  return {
    id: account.id,
    username: account.username,
    server_url: account.server_url,
    auth_method: account.auth_token ? 'token' : 'password',
    is_active: true,
    is_admin: account.isAdmin,
    created_at: account.createdAt,
    updated_at: account.updatedAt,
  };
}

/**
 * Verifies credentials against `/v1/me` and persists the account on success.
 *
 * Note: `config.server_url` is recorded for display only. The PWA always talks
 * to the same-origin `/miniflux-api` prefix, so which Miniflux instance it
 * reaches is fixed by the deployment's proxy, not by this value.
 */
async function connect(raw: AuthConfig): Promise<MinifluxConnection> {
  // Tokens are pasted, so they arrive with stray whitespace often enough to be
  // worth stripping once, here, rather than on every request that reads storage.
  const config: AuthConfig = { ...raw, auth_token: raw.auth_token?.trim() || null };
  const authHeaders = credentialsFor(config);
  const user = normalizeIds<User>(await request<unknown>('me', { authHeaders }));
  const now = new Date().toISOString();
  const existing = accountStorage.get();

  accountStorage.set({
    ...config,
    id: user.id,
    username: user.username,
    isAdmin: user.is_admin ?? false,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  });

  const connection = connectionFromStorage();
  if (!connection) throw new Error('Failed to persist Miniflux account');
  return connection;
}

/**
 * True once an account is stored, i.e. once requests can be authenticated.
 *
 * The desktop read commands (`get_categories`, `get_feeds`, `get_entries_list`,
 * `get_unread_counts`) are served from the local SQLite mirror rather than a
 * live connection, so before an account exists they return *empty* results and
 * the UI quietly shows its "Welcome to Miniflux" state. The web build has no
 * mirror, so without this guard every one of those queries would reject and
 * greet a first-time visitor with a stack of error toasts.
 *
 * Empty-but-successful is the faithful equivalent of an empty mirror.
 */
function isConnected(): boolean {
  return accountStorage.get() !== null;
}

/** Start of the current local day, as the unix timestamp Miniflux expects. */
function startOfTodayUnix(): number {
  const now = new Date();
  return Math.floor(new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime() / 1000);
}

const webCommands = {
  // ---------------------------------------------------------------- connection
  async minifluxConnect(config: AuthConfig) {
    return attempt(async () => {
      await connect(config);
      return true;
    });
  },

  async minifluxDisconnect() {
    accountStorage.clear();
    return ok(null);
  },

  async minifluxIsConnected() {
    return ok(accountStorage.get() !== null);
  },

  async autoReconnectMiniflux() {
    const account = accountStorage.get();
    if (!account) return err({ type: 'NotFound' as const });
    try {
      await request<unknown>('me');
      return ok(null);
    } catch (error) {
      if (error instanceof MinifluxHttpError && (error.status === 401 || error.status === 403)) {
        return err({ type: 'InvalidCredentials' as const });
      }
      return err({
        type: 'DatabaseError' as const,
        data: error instanceof Error ? error.message : String(error),
      });
    }
  },

  async getMinifluxVersion() {
    return attempt(async () => normalizeIds<MinifluxVersion>(await request<unknown>('version')));
  },

  async getCurrentUser() {
    return attempt(async () => normalizeIds<User>(await request<unknown>('me')));
  },

  // ------------------------------------------------------------------ accounts
  // The web build holds exactly one connection; `multiAccount` is off in
  // `@/lib/platform`, so the list is either empty or a single entry.
  async getMinifluxAccounts() {
    const connection = connectionFromStorage();
    return ok(connection ? [connection] : []);
  },

  async getActiveMinifluxAccount() {
    return ok(connectionFromStorage());
  },

  async saveMinifluxAccount(config: AuthConfig) {
    try {
      const connection = await connect(config);
      return ok(connection.id);
    } catch (error) {
      if (error instanceof MinifluxHttpError && (error.status === 401 || error.status === 403)) {
        return err({ type: 'InvalidCredentials' as const });
      }
      return err({
        type: 'DatabaseError' as const,
        data: error instanceof Error ? error.message : String(error),
      });
    }
  },

  async deleteMinifluxAccount(_id: string) {
    accountStorage.clear();
    return ok(null);
  },

  // ---------------------------------------------------------------- categories
  async getCategories() {
    if (!isConnected()) return ok([] as Category[]);
    return attempt(async () => normalizeIds<Category[]>(await request<unknown>('categories')));
  },

  async createCategory(title: string) {
    return attempt(async () =>
      normalizeIds<Category>(
        await request<unknown>('categories', { method: 'POST', body: { title } })
      )
    );
  },

  async updateCategory(id: string, title: string) {
    return attempt(async () =>
      normalizeIds<Category>(
        await request<unknown>(`categories/${toNumericId(id, 'category id')}`, {
          method: 'PUT',
          body: { title },
        })
      )
    );
  },

  async deleteCategory(id: string) {
    return attempt(async () => {
      await request(`categories/${toNumericId(id, 'category id')}`, {
        method: 'DELETE',
        responseType: 'none',
      });
      return null;
    });
  },

  async markCategoryAsRead(id: string) {
    return attempt(async () => {
      await request(`categories/${toNumericId(id, 'category id')}/mark-all-as-read`, {
        method: 'PUT',
        responseType: 'none',
      });
      return null;
    });
  },

  async getCategoryFeeds(categoryId: string) {
    if (!isConnected()) return ok([] as Feed[]);
    return attempt(async () =>
      normalizeIds<Feed[]>(
        await request<unknown>(`categories/${toNumericId(categoryId, 'category id')}/feeds`)
      )
    );
  },

  // --------------------------------------------------------------------- feeds
  async getFeeds() {
    if (!isConnected()) return ok([] as Feed[]);
    return attempt(async () => normalizeIds<Feed[]>(await request<unknown>('feeds')));
  },

  async createFeed(feedUrl: string, categoryId: string | null) {
    return attempt(async () => {
      const created = await request<{ feed_id: number | string }>('feeds', {
        method: 'POST',
        body: {
          feed_url: feedUrl,
          ...(categoryId === null ? {} : { category_id: toNumericId(categoryId, 'category id') }),
        },
      });
      return String(created.feed_id);
    });
  },

  async updateFeed(id: string, updates: FeedUpdate) {
    return attempt(async () => {
      // `category_id` crosses the boundary as a string but Miniflux wants a number.
      const { category_id: categoryId, ...rest } = updates;
      return normalizeIds<Feed>(
        await request<unknown>(`feeds/${toNumericId(id, 'feed id')}`, {
          method: 'PUT',
          body: {
            ...rest,
            ...(categoryId ? { category_id: toNumericId(categoryId, 'category id') } : {}),
          },
        })
      );
    });
  },

  async deleteFeed(id: string) {
    return attempt(async () => {
      await request(`feeds/${toNumericId(id, 'feed id')}`, {
        method: 'DELETE',
        responseType: 'none',
      });
      return null;
    });
  },

  async refreshFeed(id: string) {
    return attempt(async () => {
      await request(`feeds/${toNumericId(id, 'feed id')}/refresh`, {
        method: 'PUT',
        responseType: 'none',
      });
      return null;
    });
  },

  async refreshAllFeeds() {
    return attempt(async () => {
      await request('feeds/refresh', { method: 'PUT', responseType: 'none' });
      return null;
    });
  },

  async markFeedAsRead(id: string) {
    return attempt(async () => {
      await request(`feeds/${toNumericId(id, 'feed id')}/mark-all-as-read`, {
        method: 'PUT',
        responseType: 'none',
      });
      return null;
    });
  },

  async getFeedIconData(feedId: string) {
    return attempt(async () => {
      try {
        const icon = await request<{ data: string; mime_type: string }>(
          `feeds/${toNumericId(feedId, 'feed id')}/icon`
        );
        // Mirrors `to_data_url` in src-tauri/src/commands/miniflux.rs: Miniflux
        // sometimes already includes the "<mime>;base64," prefix.
        if (icon.data.startsWith('data:')) return icon.data;
        if (icon.data.startsWith(`${icon.mime_type};base64,`)) return `data:${icon.data}`;
        return `data:${icon.mime_type};base64,${icon.data}`;
      } catch (error) {
        // Feeds without an icon 404 — that is a normal, empty result.
        if (error instanceof MinifluxHttpError && error.status === 404) return null;
        throw error;
      }
    });
  },

  async discoverSubscriptions(url: string) {
    return attempt(async () =>
      normalizeIds<Subscription[]>(
        await request<unknown>('discover', { method: 'POST', body: { url } })
      )
    );
  },

  async exportOpml() {
    return attempt(async () => request<string>('export', { responseType: 'text' }));
  },

  async importOpml(opmlContent: string) {
    return attempt(async () => {
      await request('import', { method: 'POST', rawBody: opmlContent, responseType: 'none' });
      return null;
    });
  },

  // ------------------------------------------------------------------- entries
  async getEntriesList(filters: EntryFilters) {
    if (!isConnected()) return ok({ total: '0', entries: [] } satisfies EntryResponse);
    return attempt(async () => {
      // EntryFilters mirrors Miniflux's query parameters one-for-one, so the
      // only work is dropping nulls (handled by `request`).
      const query: Record<string, string | number | boolean | null | undefined> = { ...filters };
      return normalizeIds<EntryResponse>(await request<unknown>('entries', { query }));
    });
  },

  async getEntry(entryId: string) {
    return attempt(async () =>
      normalizeIds<Entry>(await request<unknown>(`entries/${toNumericId(entryId, 'entry id')}`))
    );
  },

  async markEntryRead(id: string) {
    return attempt(async () => {
      await request('entries', {
        method: 'PUT',
        body: { entry_ids: [toNumericId(id, 'entry id')], status: 'read' },
        responseType: 'none',
      });
      return null;
    });
  },

  async markEntriesRead(ids: string[]) {
    return attempt(async () => {
      if (ids.length === 0) return null;
      await request('entries', {
        method: 'PUT',
        body: { entry_ids: ids.map((id) => toNumericId(id, 'entry id')), status: 'read' },
        responseType: 'none',
      });
      return null;
    });
  },

  async toggleEntryRead(id: string) {
    return attempt(async () => {
      const entry = normalizeIds<Entry>(
        await request<unknown>(`entries/${toNumericId(id, 'entry id')}`)
      );
      const nextStatus = entry.status === 'read' ? 'unread' : 'read';
      await request('entries', {
        method: 'PUT',
        body: { entry_ids: [toNumericId(id, 'entry id')], status: nextStatus },
        responseType: 'none',
      });
      return nextStatus;
    });
  },

  async toggleEntryStar(id: string) {
    return attempt(async () => {
      const entry = normalizeIds<Entry>(
        await request<unknown>(`entries/${toNumericId(id, 'entry id')}`)
      );
      await request(`entries/${toNumericId(id, 'entry id')}/bookmark`, {
        method: 'PUT',
        responseType: 'none',
      });
      return !(entry.starred ?? false);
    });
  },

  async saveEntry(id: string) {
    return attempt(async () => {
      await request(`entries/${toNumericId(id, 'entry id')}/save`, {
        method: 'POST',
        responseType: 'none',
      });
      return null;
    });
  },

  async fetchEntryContent(id: string, _updateContent: boolean) {
    return attempt(async () => {
      const fetched = await request<{ content: string }>(
        `entries/${toNumericId(id, 'entry id')}/fetch-content`
      );
      return fetched.content;
    });
  },

  async updateEntry(id: string, updates: EntryUpdate) {
    return attempt(async () =>
      normalizeIds<Entry>(
        await request<unknown>(`entries/${toNumericId(id, 'entry id')}`, {
          method: 'PUT',
          body: updates,
        })
      )
    );
  },

  // ------------------------------------------------------------------ counters
  async getUnreadCounts() {
    if (!isConnected()) {
      return ok({ total: '0', today: '0', by_feed: [], by_category: [] } satisfies UnreadCounts);
    }
    return attempt(async () => {
      // The desktop build reads these from its SQLite mirror. Online-only, the
      // equivalent is /v1/feeds/counters plus a feed→category map.
      const [counters, feeds, todayResponse] = await Promise.all([
        request<{ unreads?: Record<string, number> }>('feeds/counters'),
        request<unknown>('feeds').then((value) => normalizeIds<Feed[]>(value)),
        request<{ total: number | string }>('entries', {
          query: { status: 'unread', published_after: startOfTodayUnix(), limit: 1 },
        }),
      ]);

      const unreads = counters.unreads ?? {};
      const categoryOfFeed = new Map<string, string>();
      for (const feed of feeds) {
        if (feed.category) categoryOfFeed.set(feed.id, feed.category.id);
      }

      let total = 0;
      const byCategory = new Map<string, number>();
      const byFeed: UnreadCounts['by_feed'] = [];

      for (const [feedId, count] of Object.entries(unreads)) {
        total += count;
        byFeed.push({ feed_id: feedId, unread_count: String(count) });
        const categoryId = categoryOfFeed.get(feedId);
        if (categoryId) {
          byCategory.set(categoryId, (byCategory.get(categoryId) ?? 0) + count);
        }
      }

      return {
        total: String(total),
        today: String(todayResponse.total ?? 0),
        by_feed: byFeed,
        by_category: [...byCategory].map(([categoryId, count]) => ({
          category_id: categoryId,
          unread_count: String(count),
        })),
      } satisfies UnreadCounts;
    });
  },

  // -------------------------------------------------- server administration
  // All plain Miniflux REST endpoints, so the Preferences → Server panes
  // (users, API keys, integrations) work in the browser too.
  async getUsers() {
    if (!isConnected()) return ok([] as User[]);
    return attempt(async () => normalizeIds<User[]>(await request<unknown>('users')));
  },

  async createUser(user: UserCreate) {
    return attempt(async () =>
      normalizeIds<User>(await request<unknown>('users', { method: 'POST', body: user }))
    );
  },

  async updateUser(id: string, updates: UserUpdate) {
    return attempt(async () =>
      normalizeIds<User>(
        await request<unknown>(`users/${toNumericId(id, 'user id')}`, {
          method: 'PUT',
          body: updates,
        })
      )
    );
  },

  async deleteUser(id: string) {
    return attempt(async () => {
      await request(`users/${toNumericId(id, 'user id')}`, {
        method: 'DELETE',
        responseType: 'none',
      });
      return null;
    });
  },

  async getApiKeys() {
    if (!isConnected()) return ok([] as ApiKey[]);
    return attempt(async () => normalizeIds<ApiKey[]>(await request<unknown>('api-keys')));
  },

  async createApiKey(request_: ApiKeyCreate) {
    return attempt(async () =>
      normalizeIds<ApiKey>(await request<unknown>('api-keys', { method: 'POST', body: request_ }))
    );
  },

  async deleteApiKey(id: string) {
    return attempt(async () => {
      await request(`api-keys/${toNumericId(id, 'api key id')}`, {
        method: 'DELETE',
        responseType: 'none',
      });
      return null;
    });
  },

  async getIntegrations() {
    return attempt(async () => normalizeIds<Integration>(await request<unknown>('integrations')));
  },

  async flushHistory() {
    return attempt(async () => {
      await request('flush-history', { method: 'DELETE', responseType: 'none' });
      return null;
    });
  },

  // ---------------------------------------------------------------------- sync
  /**
   * On desktop, "sync" pulls Miniflux into the local SQLite mirror. The web
   * build has no mirror — every query already reads live from the API — so the
   * faithful equivalent is a no-op that reports nothing transferred.
   *
   * This matters beyond the connect flow: `syncMiniflux` is called after every
   * feed/category mutation to refresh the mirror, and from the titlebar, menu,
   * tray and command palette. Succeeding here lets `useSyncMiniflux`'s
   * `onSuccess` invalidate the feed/category/entry/counter queries, so those
   * call sites still do the right thing — they refetch.
   */
  async syncMiniflux() {
    return ok({
      entries_pulled: 0,
      entries_pushed: 0,
      feeds_pulled: 0,
      categories_pulled: 0,
    } satisfies SyncSummary);
  },

  /** No local mirror means no sync history to report. */
  async getSyncStatus() {
    return ok(null);
  },

  // -------------------------------------------------------- local-only storage
  async loadPreferences() {
    const stored = preferencesStorage.get();
    // No stored preferences yet: report an error so `usePreferences` falls back
    // to its own defaults rather than duplicating them here.
    return stored ? ok(stored) : err('No preferences stored yet');
  },

  async savePreferences(preferences: AppPreferences) {
    return attempt(async () => {
      preferencesStorage.set(preferences);
      return null;
    });
  },

  async saveLastReading(entry: LastReadingEntry) {
    return attempt(async () => {
      lastReadingStorage.set(entry);
      return null;
    });
  },

  async loadLastReading() {
    return ok(lastReadingStorage.get());
  },

  async clearLocalData() {
    return attempt(async () => {
      clearAll();
      return null;
    });
  },
};

/**
 * The web `commands` object.
 *
 * Anything not implemented above resolves to a stub that throws
 * `UnsupportedInWebError` naming the command, so a missing capability gate
 * surfaces as a clear error instead of `undefined is not a function`.
 */
export const commands: GeneratedCommands = new Proxy(webCommands as unknown as GeneratedCommands, {
  get(target, property, receiver) {
    if (typeof property === 'string' && !(property in target)) {
      return unsupported(property);
    }
    return Reflect.get(target, property, receiver);
  },
});

// The desktop wrapper (src/lib/tauri-bindings.ts) exports these alongside
// `commands`; keep the module surface identical so the alias swap is total.
export function normalizeTranslationSegmentRequest<T>(request_: T): T {
  return request_;
}

export const translateReaderSegmentWithDefaults = unsupported('translateReaderSegment');
