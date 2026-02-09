import { useQueryClient } from '@tanstack/react-query';
import { listen } from '@tauri-apps/api/event';
import { useEffect, useRef } from 'react';
import { logger } from '@/lib/logger';
import { categoryQueryKeys } from '@/services/miniflux/categories';
import { counterQueryKeys } from '@/services/miniflux/counters';
import { entryQueryKeys } from '@/services/miniflux/entries';
import { feedQueryKeys } from '@/services/miniflux/feeds';
import { useSyncStore } from '@/store/sync-store';

export function useSyncProgressListener() {
  const queryClient = useQueryClient();
  const lastEntriesRefreshRef = useRef(0);

  useEffect(() => {
    let unlisten: (() => void) | null = null;
    let unlistenStarted: (() => void) | null = null;
    let unlistenCompleted: (() => void) | null = null;

    const setupListener = async () => {
      try {
        const unlistenFn = await listen('sync-progress', (event) => {
          logger.debug('Sync progress event:', { payload: event.payload });

          const payload = event.payload as any;
          const maybeRefreshEntries = (force: boolean = false) => {
            const now = Date.now();
            if (!force && now - lastEntriesRefreshRef.current < 1000) {
              return;
            }
            lastEntriesRefreshRef.current = now;
            queryClient.invalidateQueries({ queryKey: entryQueryKeys.lists() });
            queryClient.invalidateQueries({ queryKey: counterQueryKeys.all });
          };

          switch (payload.event) {
            case 'CategoriesStarted':
              useSyncStore.getState().setCurrentStage('categories');
              break;

            case 'CategoriesCompleted':
              useSyncStore.getState().setCategoriesCount(payload.count);
              queryClient.invalidateQueries({ queryKey: categoryQueryKeys.lists() });
              queryClient.invalidateQueries({ queryKey: counterQueryKeys.all });
              break;

            case 'FeedsStarted':
              useSyncStore.getState().setCurrentStage('feeds');
              break;

            case 'FeedsCompleted':
              useSyncStore.getState().setFeedsCount(payload.count);
              queryClient.invalidateQueries({ queryKey: feedQueryKeys.lists() });
              break;

            case 'EntriesStarted':
              useSyncStore.getState().setCurrentStage('entries');
              break;

            case 'EntriesProgress':
              useSyncStore.getState().setEntriesProgress(payload);
              maybeRefreshEntries();
              break;

            case 'EntriesCompleted':
              useSyncStore.getState().setCurrentStage('cleanup');
              maybeRefreshEntries(true);
              break;

            case 'CleanupStarted':
              useSyncStore.getState().setCurrentStage('cleanup');
              break;

            case 'CleanupCompleted':
              useSyncStore.getState().setCurrentStage('completed');
              useSyncStore.getState().completeSync();
              queryClient.invalidateQueries({ queryKey: categoryQueryKeys.lists() });
              queryClient.invalidateQueries({ queryKey: feedQueryKeys.lists() });
              queryClient.invalidateQueries({ queryKey: entryQueryKeys.lists() });
              queryClient.invalidateQueries({ queryKey: counterQueryKeys.all });
              break;

            default:
              logger.warn('Unknown sync progress event:', { payload });
              break;
          }
        });

        unlisten = unlistenFn;

        const unlistenStartedFn = await listen('sync-started', () => {
          useSyncStore.getState().startSync();
        });
        unlistenStarted = unlistenStartedFn;

        const unlistenCompletedFn = await listen('sync-completed', () => {
          useSyncStore.getState().completeSync();
          queryClient.invalidateQueries({ queryKey: categoryQueryKeys.lists() });
          queryClient.invalidateQueries({ queryKey: feedQueryKeys.lists() });
          queryClient.invalidateQueries({ queryKey: entryQueryKeys.lists() });
          queryClient.invalidateQueries({ queryKey: counterQueryKeys.all });
        });
        unlistenCompleted = unlistenCompletedFn;
      } catch (error) {
        logger.error('Failed to setup sync-progress listener:', { error });
      }
    };

    setupListener();

    return () => {
      if (unlisten) {
        unlisten();
      }
      if (unlistenStarted) {
        unlistenStarted();
      }
      if (unlistenCompleted) {
        unlistenCompleted();
      }
    };
  }, [queryClient]);
}
