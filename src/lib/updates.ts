import { check, type Update } from '@tauri-apps/plugin-updater';
import { logger } from '@/lib/logger';

export type LatestVersionCheckResult =
  | {
      status: 'available';
      update: Update;
      version: string;
    }
  | {
      status: 'up-to-date';
    };

export async function checkLatestVersion(): Promise<LatestVersionCheckResult> {
  const update = await check();

  if (update) {
    logger.info('Update available', { version: update.version });
    return {
      status: 'available',
      update,
      version: update.version,
    };
  }

  logger.info('No updates available');
  return { status: 'up-to-date' };
}
