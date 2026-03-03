import { queryClient } from '@/lib/query-client';
import { commands } from '@/lib/tauri-bindings';
import { usePlayerStore } from '@/store/player-store';
import { useSyncStore } from '@/store/sync-store';
import { useUIStore } from '@/store/ui-store';

/**
 * Resets all account-specific state after account switch, add, or delete.
 * Clears TanStack Query caches and Zustand store state, then restores
 * the new account's persisted sync status from the database.
 */
export async function resetAccountState(): Promise<void> {
  // 1. Reset all account-specific TanStack Query caches
  //    These use different prefixes, so we must reset each one
  await queryClient.resetQueries({ queryKey: ['miniflux'] });
  await queryClient.resetQueries({ queryKey: ['unread-counters'] });
  await queryClient.resetQueries({ queryKey: ['podcast'] });
  await queryClient.resetQueries({ queryKey: ['reading-state'] });

  // 2. Reset account-specific UI state
  const uiStore = useUIStore.getState();
  uiStore.setSelectedEntryId(undefined);
  uiStore.setZenModeEnabled(false);
  uiStore.setZenModeEntryId(null);
  uiStore.setInAppBrowserUrl(null);
  uiStore.setSelectionMode(false);
  uiStore.setSearchFiltersVisible(false);

  // 3. Restore sync status from DB for the new active account
  const syncStore = useSyncStore.getState();
  try {
    const result = await commands.getSyncStatus();
    if (result.status === 'ok' && result.data) {
      syncStore.restoreSyncStatus({
        lastSyncAt: result.data.last_sync_at,
        categoriesSynced: result.data.categories_synced,
        feedsSynced: result.data.feeds_synced,
        entriesSynced: result.data.entries_synced,
      });
    } else {
      syncStore.setSyncing(false);
      syncStore.setLastSyncedAt(null);
      syncStore.setError(null);
      syncStore.setCurrentStage('idle');
    }
  } catch {
    syncStore.setSyncing(false);
    syncStore.setLastSyncedAt(null);
    syncStore.setError(null);
    syncStore.setCurrentStage('idle');
  }

  // 4. Dismiss podcast player (belongs to old account's entries)
  usePlayerStore.getState().dismiss();
}
