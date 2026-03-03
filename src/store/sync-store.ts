import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { logger } from './logger-middleware';

type SyncStage = 'idle' | 'categories' | 'feeds' | 'entries' | 'cleanup' | 'completed' | 'failed';

interface SyncState {
  syncing: boolean;
  lastSyncedAt: Date | null;
  error: string | null;
  currentStage: SyncStage;
  categoriesCount?: number;
  feedsCount?: number;
  entriesProgress?: { pulled: number; total: number; percentage: number };

  setSyncing: (syncing: boolean) => void;
  setLastSyncedAt: (date: Date | null) => void;
  setError: (error: string | null) => void;
  startSync: () => void;
  completeSync: () => void;
  failSync: (error: string) => void;
  setCurrentStage: (stage: SyncStage) => void;
  setCategoriesCount: (count: number) => void;
  setFeedsCount: (count: number) => void;
  setEntriesProgress: (progress: { pulled: number; total: number; percentage: number }) => void;
  restoreSyncStatus: (status: {
    lastSyncAt: string | null;
    categoriesSynced: number;
    feedsSynced: number;
    entriesSynced: number;
  }) => void;
}

export const useSyncStore = create<SyncState>()(
  logger(
    devtools(
      (set) => ({
        syncing: false,
        lastSyncedAt: null,
        error: null,
        currentStage: 'idle',

        setSyncing: (syncing: boolean) =>
          set(syncing ? { syncing, error: null } : { syncing }, undefined, 'setSyncing'),

        setLastSyncedAt: (date: Date | null) =>
          set({ lastSyncedAt: date }, undefined, 'setLastSyncedAt'),

        setError: (error: string | null) =>
          set(error !== null ? { error, syncing: false } : { error }, undefined, 'setError'),

        startSync: () =>
          set(
            {
              syncing: true,
              error: null,
              currentStage: 'idle',
            },
            undefined,
            'startSync'
          ),

        completeSync: () =>
          set(
            { syncing: false, lastSyncedAt: new Date(), currentStage: 'completed' },
            undefined,
            'completeSync'
          ),

        failSync: (error: string) =>
          set({ syncing: false, error, currentStage: 'failed' }, undefined, 'failSync'),

        setCurrentStage: (stage: SyncStage) =>
          set({ currentStage: stage }, undefined, 'setCurrentStage'),

        setCategoriesCount: (count: number) =>
          set({ categoriesCount: count }, undefined, 'setCategoriesCount'),

        setFeedsCount: (count: number) => set({ feedsCount: count }, undefined, 'setFeedsCount'),

        setEntriesProgress: (progress: { pulled: number; total: number; percentage: number }) =>
          set({ entriesProgress: progress }, undefined, 'setEntriesProgress'),

        restoreSyncStatus: (status) =>
          set(
            {
              syncing: false,
              error: null,
              currentStage: status.lastSyncAt ? 'completed' : 'idle',
              lastSyncedAt: status.lastSyncAt ? new Date(status.lastSyncAt) : null,
              categoriesCount: status.categoriesSynced || undefined,
              feedsCount: status.feedsSynced || undefined,
              entriesProgress: status.entriesSynced
                ? { pulled: status.entriesSynced, total: status.entriesSynced, percentage: 100 }
                : undefined,
            },
            undefined,
            'restoreSyncStatus'
          ),
      }),
      { name: 'sync-store' }
    ),
    'sync-store'
  )
);
