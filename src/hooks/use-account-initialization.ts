import { listen } from '@tauri-apps/api/event';
import { useEffect } from 'react';
import { logger } from '@/lib/logger';
import { queryClient } from '@/lib/query-client';

export function useAccountInitialization() {
  useEffect(() => {
    logger.info('[useAccountInitialization] Hook mounted');

    const invalidate = () => {
      logger.info('[useAccountInitialization] Event received, invalidating miniflux queries');
      queryClient.invalidateQueries({ queryKey: ['miniflux'] });
    };

    const unlistenPromises = [
      listen('database-ready', () => {
        logger.info('[useAccountInitialization] Received database-ready event');
        invalidate();
      }),
      listen('miniflux-connected', () => {
        logger.info('[useAccountInitialization] Received miniflux-connected event');
        invalidate();
      }),
      listen('miniflux-disconnected', () => {
        logger.info('[useAccountInitialization] Received miniflux-disconnected event');
        invalidate();
      }),
    ];

    return () => {
      logger.debug('[useAccountInitialization] Hook unmounting, cleaning up listeners');
      unlistenPromises.forEach((promise) => {
        promise.then((unlisten) => unlisten());
      });
    };
  }, []);
}
