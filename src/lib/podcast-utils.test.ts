import { describe, expect, it } from 'vitest';
import type { DownloadState, Enclosure } from '@/lib/tauri-bindings';
import { buildPodcastDownloadFileName, getPodcastDownloadSnapshotForUrl } from './podcast-utils';

describe('buildPodcastDownloadFileName', () => {
  it('builds an mp3 file name from title and audio mime type', () => {
    const enclosure = {
      mime_type: 'audio/mpeg',
      url: 'https://cdn.example.com/episodes/ep-01',
    } as Enclosure;

    expect(buildPodcastDownloadFileName('Episode 01: Hello / World?', enclosure)).toBe(
      'Episode 01 Hello World.mp3'
    );
  });

  it('uses extension from URL when mime type is generic', () => {
    const enclosure = {
      mime_type: 'application/octet-stream',
      url: 'https://cdn.example.com/episodes/ep-02.m4a?auth=123',
    } as Enclosure;

    expect(buildPodcastDownloadFileName('Episode 02', enclosure)).toBe('Episode 02.m4a');
  });

  it('falls back to .mp3 when no extension can be inferred', () => {
    const enclosure = {
      mime_type: 'audio/unknown',
      url: 'https://cdn.example.com/episodes/ep-03',
    } as Enclosure;

    expect(buildPodcastDownloadFileName('Episode 03', enclosure)).toBe('Episode 03.mp3');
  });
});

describe('getPodcastDownloadSnapshotForUrl', () => {
  it('returns downloading snapshot with progress', () => {
    const state: DownloadState[] = [
      {
        Downloading: {
          id: '22',
          url: 'https://cdn.example.com/ep.m4a',
          progress: 37,
          downloaded_bytes: '370',
          total_bytes: '1000',
          started_at: { duration_since_epoch: '1', duration_since_unix_epoch: 1 },
        },
      },
    ];

    expect(getPodcastDownloadSnapshotForUrl(state, 'https://cdn.example.com/ep.m4a')).toEqual({
      status: 'downloading',
      progress: 37,
    });
  });

  it('returns completed snapshot with file path', () => {
    const state: DownloadState[] = [
      {
        Completed: {
          id: '22',
          url: 'https://cdn.example.com/ep.m4a',
          progress: 100,
          total_bytes: '1000',
          file_path: '/tmp/ep.m4a',
          completed_at: { duration_since_epoch: '1', duration_since_unix_epoch: 1 },
        },
      },
    ];

    expect(getPodcastDownloadSnapshotForUrl(state, 'https://cdn.example.com/ep.m4a')).toEqual({
      status: 'completed',
      progress: 100,
      filePath: '/tmp/ep.m4a',
    });
  });
});
