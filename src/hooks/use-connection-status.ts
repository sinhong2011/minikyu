import { useQueryClient } from '@tanstack/react-query';
import { listen } from '@tauri-apps/api/event';
import { useEffect } from 'react';
import { logger } from '@/lib/logger';
import { authQueryKeys } from '@/services/miniflux/auth';

/**
 * Hook to listen for Miniflux connection status events.
 * Invalidates connection query when successful connection is established.
 */
export function useConnectionStatusListener() {
  const queryClient = useQueryClient();

  useEffect(() => {
    let isMounted = true;
    let unlisten: (() => void) | null = null;

    listen('miniflux-connected', () => {
      logger.debug('Received miniflux-connected event, invalidating connection query');
      queryClient.invalidateQueries({ queryKey: authQueryKeys.connection() });
    })
      .then((unlistenFn) => {
        if (!isMounted) {
          unlistenFn();
        } else {
          unlisten = unlistenFn;
        }
      })
      .catch((error) => {
        logger.error('Failed to setup miniflux-connected listener', { error });
      });

    return () => {
      isMounted = false;
      if (unlisten) {
        unlisten();
      }
    };
  }, [queryClient]);
}
