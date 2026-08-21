import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';
import { logger } from '@/lib/logger';
import { capabilities } from '@/lib/platform';
import { commands } from '@/lib/tauri-bindings';
import { preferencesQueryKeys, usePreferences } from '@/services/preferences';

/**
 * Auto-pull preferences from cloud on app startup if enabled.
 * Runs once when preferences are first loaded.
 *
 * The preference flags alone are not a sufficient guard: preferences are
 * portable (Settings → Advanced can import a file exported from the desktop
 * app), so a build without cloud sync can easily end up holding
 * `cloud_sync_enabled: true`. This runs at startup from `App.tsx`, so an
 * unguarded call would reject before the user has touched anything.
 */
export function useCloudSyncAutoPull() {
  const { data: preferences } = usePreferences();
  const queryClient = useQueryClient();
  const hasRun = useRef(false);

  useEffect(() => {
    if (!capabilities.cloudSync) return;
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

    // Startup side effect with no caller to await it — swallowing the rejection
    // here keeps a sync failure from surfacing as an unhandled rejection.
    pull().catch((error: unknown) => {
      logger.warn('Cloud sync auto-pull failed', { error });
    });
  }, [preferences, queryClient]);
}
