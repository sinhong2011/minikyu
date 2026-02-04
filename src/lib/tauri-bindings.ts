/**
 * Re-export generated Tauri bindings with project conventions
 *
 * This file provides type-safe access to all Tauri commands.
 * Types are auto-generated from Rust by tauri-specta.
 *
 * @example
 * ```typescript
 * import { commands, unwrapResult } from '@/lib/tauri-bindings'
 *
 * // In TanStack Query - let errors propagate
 * const prefs = unwrapResult(await commands.loadPreferences())
 *
 * // In event handlers - explicit error handling
 * const result = await commands.savePreferences(prefs)
 * if (result.status === 'error') {
 *   toast.error(result.error)
 * }
 * ```
 *
 * @see docs/developer/tauri-commands.md for full documentation
 */

export type {
  AppPreferences,
  AuthConfig,
  Category,
  CloseBehavior,
  Counters,
  Enclosure,
  Entry,
  EntryFilters,
  EntryResponse,
  EntryUpdate,
  Feed,
  FeedIcon,
  FeedUpdate,
  JsonValue,
  LastReadingEntry,
  MinifluxAccount,
  RecoveryError,
  Result,
  Subscription,
  TrayIconState,
  User,
} from './bindings';

import { invoke } from '@tauri-apps/api/core';
import {
  type Entry,
  type EntryUpdate,
  commands as generatedCommands,
  type Result,
} from './bindings';

function toNumberId(id: string): number {
  const num = Number(id);
  if (Number.isNaN(num)) {
    throw new Error(`Invalid ID: "${id}" cannot be converted to number`);
  }
  return num;
}

export const commands = {
  ...generatedCommands,
  async getEntry(id: string): Promise<Result<Entry, string>> {
    try {
      return { status: 'ok', data: await invoke('get_entry', { id: toNumberId(id) }) };
    } catch (e) {
      if (e instanceof Error) throw e;
      else return { status: 'error', error: e as any };
    }
  },
  async markEntryRead(id: string): Promise<Result<null, string>> {
    try {
      return { status: 'ok', data: await invoke('mark_entry_read', { id: toNumberId(id) }) };
    } catch (e) {
      if (e instanceof Error) throw e;
      else return { status: 'error', error: e as any };
    }
  },
  async toggleEntryStar(id: string): Promise<Result<null, string>> {
    try {
      return { status: 'ok', data: await invoke('toggle_entry_star', { id: toNumberId(id) }) };
    } catch (e) {
      if (e instanceof Error) throw e;
      else return { status: 'error', error: e as any };
    }
  },
  async updateEntry(id: string, updates: EntryUpdate): Promise<Result<Entry, string>> {
    try {
      return {
        status: 'ok',
        data: await invoke('update_entry', { id: toNumberId(id), updates }),
      };
    } catch (e) {
      if (e instanceof Error) throw e;
      else return { status: 'error', error: e as any };
    }
  },
  async switchMinifluxAccount(id: string): Promise<Result<null, string>> {
    try {
      return { status: 'ok', data: await invoke('switch_miniflux_account', { id }) };
    } catch (e) {
      if (e instanceof Error) throw e;
      else return { status: 'error', error: e as any };
    }
  },
  async getDownloadsFromDb(): Promise<Result<any[], string>> {
    try {
      return { status: 'ok', data: await invoke('get_downloads_from_db') };
    } catch (e) {
      if (e instanceof Error) throw e;
      else return { status: 'error', error: e as any };
    }
  },
};

/**
 * Helper to unwrap a Result type, throwing on error
 */
export function unwrapResult<T, E>(
  result: { status: 'ok'; data: T } | { status: 'error'; error: E }
): T {
  if (result.status === 'ok') {
    return result.data;
  }
  throw result.error;
}
