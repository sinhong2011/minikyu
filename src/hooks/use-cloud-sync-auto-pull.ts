import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';
import { logger } from '@/lib/logger';
import { commands } from '@/lib/tauri-bindings';
import { preferencesQueryKeys, usePreferences } from '@/services/preferences';

/**
 * Auto-pull preferences from cloud on app startup if enabled.
 * Runs once when preferences are first loaded.
 */
export function useCloudSyncAutoPull() {
  const { data: preferences } = usePreferences();
  const queryClient = useQueryClient();
  const hasRun = useRef(false);

  useEffect(() => {
    if (!preferences || hasRun.current) return;
    if (!preferences.cloud_sync_enabled || !preferences.cloud_sync_auto_pull) return;
    hasRun.current = true;

    const pull = async () => {
      logger.info('Cloud sync auto-pull: starting');
      const result = await commands.cloudSyncPull();
      if (result.status === 'ok') {
        logger.info('Cloud sync auto-pull: success');
        queryClient.setQueryData(preferencesQueryKeys.preferences(), result.data);
      } else {
        logger.warn(`Cloud sync auto-pull failed: ${result.error}`);
      }
    };

    pull();
  }, [preferences, queryClient]);
}
