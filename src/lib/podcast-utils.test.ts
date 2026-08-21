import { describe, expect, it } from 'vite-plus/test';
import type { Enclosure } from '@/lib/tauri-bindings';
import { buildPodcastDownloadFileName } from './podcast-utils';

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
