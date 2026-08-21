/**
 * Browser-side replacement for the pieces of state the desktop build keeps in
 * SQLite and the OS keychain.
 *
 * SECURITY: the desktop app stores Miniflux credentials in the OS keychain.
 * A browser has no equivalent, so the PWA keeps them in `localStorage`, which
 * is readable by any script running on the origin. That is a real downgrade —
 * see `docs/developer/pwa.md`. Serve the PWA from an origin you control and do
 * not host untrusted third-party scripts on it.
 */

import type { AppPreferences, AuthConfig, LastReadingEntry } from '../bindings';

const KEY_PREFIX = 'minikyu:web:';
const KEYS = {
  account: `${KEY_PREFIX}account`,
  preferences: `${KEY_PREFIX}preferences`,
  lastReading: `${KEY_PREFIX}last-reading`,
} as const;

/** The single Miniflux connection the web build supports. */
export interface StoredAccount extends AuthConfig {
  id: string;
  username: string;
  isAdmin: boolean;
  createdAt: string;
  updatedAt: string;
}

function read<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw === null ? null : (JSON.parse(raw) as T);
  } catch {
    // Corrupt or unparseable entry — treat as absent rather than crashing boot.
    return null;
  }
}

function write(key: string, value: unknown): void {
  localStorage.setItem(key, JSON.stringify(value));
}

export const accountStorage = {
  get: (): StoredAccount | null => read<StoredAccount>(KEYS.account),
  set: (account: StoredAccount): void => write(KEYS.account, account),
  clear: (): void => localStorage.removeItem(KEYS.account),
};

export const preferencesStorage = {
  get: (): AppPreferences | null => read<AppPreferences>(KEYS.preferences),
  set: (preferences: AppPreferences): void => write(KEYS.preferences, preferences),
};

export const lastReadingStorage = {
  get: (): LastReadingEntry | null => read<LastReadingEntry>(KEYS.lastReading),
  set: (entry: LastReadingEntry): void => write(KEYS.lastReading, entry),
};

/** Wipes every key this build owns. Backs the web `clearLocalData`/reset paths. */
export function clearAll(): void {
  for (const key of Object.values(KEYS)) {
    localStorage.removeItem(key);
  }
}
