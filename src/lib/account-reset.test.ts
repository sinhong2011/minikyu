import { beforeEach, describe, expect, it, vi } from 'vitest';

const { resetQueriesMock, syncStoreState, uiStoreState, dismissMock, getSyncStatusMock } =
  vi.hoisted(() => ({
    resetQueriesMock: vi.fn(),
    syncStoreState: {
      restoreSyncStatus: vi.fn(),
      setSyncing: vi.fn(),
      setLastSyncedAt: vi.fn(),
      setError: vi.fn(),
      setCurrentStage: vi.fn(),
    },
    uiStoreState: {
      setSelectedEntryId: vi.fn(),
      setZenModeEnabled: vi.fn(),
      setZenModeEntryId: vi.fn(),
      setInAppBrowserUrl: vi.fn(),
      setSelectionMode: vi.fn(),
      setSearchFiltersVisible: vi.fn(),
    },
    dismissMock: vi.fn(),
    getSyncStatusMock: vi.fn(),
  }));

vi.mock('@/lib/query-client', () => ({
  queryClient: {
    resetQueries: resetQueriesMock,
  },
}));

vi.mock('@/store/ui-store', () => ({
  useUIStore: {
    getState: () => uiStoreState,
  },
}));

vi.mock('@/store/sync-store', () => ({
  useSyncStore: {
    getState: () => syncStoreState,
  },
}));

vi.mock('@/store/player-store', () => ({
  usePlayerStore: {
    getState: () => ({
      dismiss: dismissMock,
    }),
  },
}));

vi.mock('@/lib/tauri-bindings', () => ({
  commands: {
    getSyncStatus: getSyncStatusMock,
  },
}));

import { resetAccountState } from './account-reset';

describe('resetAccountState', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getSyncStatusMock.mockResolvedValue({
      status: 'ok',
      data: {
        // biome-ignore lint/style/useNamingConvention: backend payload shape
        last_sync_at: null,
        // biome-ignore lint/style/useNamingConvention: backend payload shape
        categories_synced: 0,
        // biome-ignore lint/style/useNamingConvention: backend payload shape
        feeds_synced: 0,
        // biome-ignore lint/style/useNamingConvention: backend payload shape
        entries_synced: 0,
      },
    });
  });

  it('resets account-bound query caches including account/auth/user views', async () => {
    await resetAccountState();

    expect(resetQueriesMock).toHaveBeenCalledWith({ queryKey: ['miniflux'] });
    expect(resetQueriesMock).toHaveBeenCalledWith({ queryKey: ['unread-counters'] });
    expect(resetQueriesMock).toHaveBeenCalledWith({ queryKey: ['podcast'] });
    expect(resetQueriesMock).toHaveBeenCalledWith({ queryKey: ['reading-state'] });
    expect(resetQueriesMock).toHaveBeenCalledWith({ queryKey: ['miniflux', 'accounts'] });
    expect(resetQueriesMock).toHaveBeenCalledWith({ queryKey: ['miniflux', 'auth'] });
    expect(resetQueriesMock).toHaveBeenCalledWith({ queryKey: ['miniflux', 'users'] });
  });

  it('clears stale feed/category route params on account switch', async () => {
    window.history.replaceState({}, '', '/?feedId=101&categoryId=9&filter=all');

    await resetAccountState();

    expect(window.location.search).toBe('?filter=all');
  });
});
