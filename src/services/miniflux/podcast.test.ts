import { describe, expect, it } from 'vitest';
import { resolvePodcastFeedSettingsForSpeedUpdate } from './podcast';

describe('resolvePodcastFeedSettingsForSpeedUpdate', () => {
  it('preserves existing feed settings while changing speed', () => {
    const resolved = resolvePodcastFeedSettingsForSpeedUpdate({
      // biome-ignore lint/style/useNamingConvention: tauri binding fields are snake_case
      feed_id: 'feed-1',
      // biome-ignore lint/style/useNamingConvention: tauri binding fields are snake_case
      auto_download_count: 9,
      // biome-ignore lint/style/useNamingConvention: tauri binding fields are snake_case
      playback_speed: 1.25,
      // biome-ignore lint/style/useNamingConvention: tauri binding fields are snake_case
      auto_cleanup_days: 30,
    });

    expect(resolved).toEqual({
      autoDownloadCount: 9,
      autoCleanupDays: 30,
    });
  });

  it('falls back to safe defaults when feed settings are missing', () => {
    const resolved = resolvePodcastFeedSettingsForSpeedUpdate(undefined);

    expect(resolved).toEqual({
      autoDownloadCount: 3,
      autoCleanupDays: 7,
    });
  });
});
