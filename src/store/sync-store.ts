import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { logger } from './logger-middleware';

interface SyncState {
  syncing: boolean;
  lastSyncedAt: Date | null;
  error: string | null;

  setSyncing: (syncing: boolean) => void;
  setLastSyncedAt: (date: Date | null) => void;
  setError: (error: string | null) => void;
  startSync: () => void;
  completeSync: () => void;
  failSync: (error: string) => void;
}

export const useSyncStore = create<SyncState>()(
  logger(
    devtools(
      (set) => ({
        syncing: false,
        lastSyncedAt: null,
        error: null,

        setSyncing: (syncing: boolean) =>
          set(syncing ? { syncing, error: null } : { syncing }, undefined, 'setSyncing'),

        setLastSyncedAt: (date: Date | null) =>
          set({ lastSyncedAt: date }, undefined, 'setLastSyncedAt'),

        setError: (error: string | null) =>
          set(error !== null ? { error, syncing: false } : { error }, undefined, 'setError'),

        startSync: () => set({ syncing: true, error: null }, undefined, 'startSync'),

        completeSync: () =>
          set({ syncing: false, lastSyncedAt: new Date() }, undefined, 'completeSync'),

        failSync: (error: string) => set({ syncing: false, error }, undefined, 'failSync'),
      }),
      { name: 'sync-store' }
    ),
    'sync-store'
  )
);
