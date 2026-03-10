import { useEffect, useRef } from 'react';
import { logger } from '@/lib/logger';
import { commands } from '@/lib/tauri-bindings';
import { usePreferences } from '@/services/preferences';

/**
 * Auto-pull preferences from cloud on app startup if enabled.
 * Runs once when preferences are first loaded.
 */
export function useCloudSyncAutoPull() {
  const { data: preferences } = usePreferences();
  const hasRun = useRef(false);

  useEffect(() => {
    if (!preferences || hasRun.current) return;
    if (!preferences.cloud_sync_enabled || !preferences.cloud_sync_auto_pull) return;
    hasRun.current = true;

    const pull = async () => {
      logger.info('Cloud sync auto-pull: starting');
      const result = await commands.cloudSyncPull();
      if (result.status === 'ok') {
        logger.info('Cloud sync auto-pull: success, reloading');
        window.location.reload();
      } else {
        logger.warn(`Cloud sync auto-pull failed: ${result.error}`);
      }
    };

    pull();
  }, [preferences]);
}
