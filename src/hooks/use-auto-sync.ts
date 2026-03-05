import { useEffect, useRef } from 'react';
import { logger } from '@/lib/logger';
import { useIsConnected } from '@/services/miniflux/auth';
import { useSyncMiniflux } from '@/services/miniflux/feeds';
import { usePreferences } from '@/services/preferences';

/**
 * Automatically syncs Miniflux data at the configured interval.
 * Reads `sync_interval` from preferences (in minutes).
 * When null/0, auto-sync is disabled.
 */
export function useAutoSync() {
  const { data: preferences } = usePreferences();
  const { data: isConnected } = useIsConnected();
  const syncMutation = useSyncMiniflux();
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const syncIntervalMinutes = preferences?.sync_interval ?? null;

  useEffect(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    if (!isConnected || !syncIntervalMinutes || syncIntervalMinutes <= 0) {
      return;
    }

    const intervalMs = syncIntervalMinutes * 60 * 1000;

    logger.debug('Auto-sync enabled', { intervalMinutes: syncIntervalMinutes });

    intervalRef.current = setInterval(() => {
      if (!syncMutation.isPending) {
        logger.debug('Auto-sync triggered');
        syncMutation.mutate();
      }
    }, intervalMs);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [isConnected, syncIntervalMinutes, syncMutation]);
}
