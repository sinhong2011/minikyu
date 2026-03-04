import { relaunch } from '@tauri-apps/plugin-process';
import { check } from '@tauri-apps/plugin-updater';
import { logger } from '@/lib/logger';
import { useUpdaterStore } from '@/store/updater-store';

/**
 * Check for available updates. Updates the store with result.
 * Returns true if an update is available.
 */
export async function checkForUpdate(): Promise<boolean> {
  const store = useUpdaterStore.getState();
  store.setChecking();

  try {
    const update = await check();

    if (update) {
      logger.info('Update available', { version: update.version });
      store.setAvailable(update.version, update.date ?? '', update.body ?? '');
      store._setUpdate(update);
      return true;
    }

    logger.info('No updates available');
    store.setUpToDate();
    return false;
  } catch (error) {
    logger.error('Update check failed', { error });
    store.setError(error instanceof Error ? error.message : String(error));
    return false;
  }
}

/**
 * Download the available update with progress tracking.
 * Transitions store: available → downloading → ready (or error).
 */
export async function downloadUpdate(): Promise<void> {
  const store = useUpdaterStore.getState();
  const update = store._update;

  if (!update) {
    store.setError('No update available to download');
    return;
  }

  const version = 'version' in store ? (store as { version: string }).version : '';

  try {
    let totalBytes = 0;
    let downloadedBytes = 0;

    await update.downloadAndInstall((event) => {
      switch (event.event) {
        case 'Started':
          totalBytes = event.data.contentLength ?? 0;
          downloadedBytes = 0;
          useUpdaterStore.getState().setDownloading(version, 0);
          logger.info('Update download started', { totalBytes });
          break;
        case 'Progress':
          downloadedBytes += event.data.chunkLength;
          {
            const progress = totalBytes > 0 ? Math.round((downloadedBytes / totalBytes) * 100) : 0;
            useUpdaterStore.getState().setDownloading(version, progress);
          }
          break;
        case 'Finished':
          logger.info('Update download finished');
          break;
      }
    });

    useUpdaterStore.getState().setReady(version);
  } catch (error) {
    logger.error('Update download failed', { error });
    useUpdaterStore.getState().setError(error instanceof Error ? error.message : String(error));
  }
}

/**
 * Install the downloaded update and relaunch the app.
 */
export async function installAndRelaunch(): Promise<void> {
  useUpdaterStore.getState().setInstalling();
  await relaunch();
}
