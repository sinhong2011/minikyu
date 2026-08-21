import { i18n } from '@lingui/core';
import { beforeAll, describe, expect, it } from 'vite-plus/test';

import type { DownloadState } from '@/lib/tauri-bindings';
import {
  applyDownloadProgress,
  type DownloadItem,
  type DownloadProgressEvent,
  findDownloadByUrl,
  mapDownloadStates,
} from './downloads';

beforeAll(() => {
  i18n.load('en', {});
  i18n.activate('en');
});

const EPOCH = { duration_since_epoch: '1', duration_since_unix_epoch: 1 };

function downloadingState(id: string, url: string): DownloadState {
  return {
    Downloading: {
      id,
      url,
      progress: 37,
      downloaded_bytes: '370',
      total_bytes: '1000',
      started_at: EPOCH,
    },
  } as DownloadState;
}

function completedState(id: string, url: string, filePath: string): DownloadState {
  return {
    Completed: {
      id,
      url,
      progress: 100,
      total_bytes: '1000',
      file_path: filePath,
      completed_at: EPOCH,
    },
  } as DownloadState;
}

function progressEvent(overrides: Partial<DownloadProgressEvent> = {}): DownloadProgressEvent {
  return {
    enclosure_id: 22,
    file_name: 'ep.m4a',
    url: 'https://cdn.example.com/ep.m4a',
    progress: 50,
    downloaded_bytes: 500,
    total_bytes: 1000,
    status: 'downloading',
    ...overrides,
  };
}

describe('mapDownloadStates', () => {
  it('rewrites orphaned Downloading rows as interrupted', () => {
    const items = mapDownloadStates(
      [downloadingState('22', 'https://cdn.example.com/ep.m4a')],
      () => false
    );

    expect(items[0]).toMatchObject({
      status: 'failed',
      error: 'Interrupted — app was closed',
    });
  });

  it('leaves a Downloading row alone while its transfer is being watched', () => {
    const items = mapDownloadStates(
      [downloadingState('22', 'https://cdn.example.com/ep.m4a')],
      (id) => id === 22
    );

    expect(items[0]).toMatchObject({ status: 'downloading' });
    expect(items[0]?.error).toBeUndefined();
  });

  it('takes the completed file name from the saved path, not the URL', () => {
    const items = mapDownloadStates(
      [completedState('22', 'https://cdn.example.com/ep?token=abc', '/tmp/Episode 1.m4a')],
      () => false
    );

    expect(items[0]).toMatchObject({
      fileName: 'Episode 1.m4a',
      filePath: '/tmp/Episode 1.m4a',
    });
  });
});

describe('applyDownloadProgress', () => {
  const existing: DownloadItem = {
    enclosureId: 22,
    url: 'https://cdn.example.com/ep.m4a',
    fileName: 'ep.m4a',
    status: 'downloading',
    progress: 10,
    downloadedBytes: 100,
    totalBytes: 1000,
    speed: 2048,
    eta: '1m',
    updatedAt: 1,
  };

  it('inserts a row for an enclosure not yet in the history', () => {
    const result = applyDownloadProgress([], progressEvent(), 0, 99);

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ enclosureId: 22, progress: 50, updatedAt: 99 });
  });

  it('updates the matching row and leaves the others untouched', () => {
    const other: DownloadItem = { ...existing, enclosureId: 7, url: 'https://other.example/a.mp3' };

    const result = applyDownloadProgress([other, existing], progressEvent(), 4096, 99);

    expect(result[0]).toBe(other);
    expect(result[1]).toMatchObject({ enclosureId: 22, progress: 50, speed: 4096, eta: '1s' });
  });

  it('carries over the previous speed and ETA when sampled too soon', () => {
    const result = applyDownloadProgress([existing], progressEvent(), -1, 99);

    expect(result[0]).toMatchObject({ speed: 2048, eta: '1m', progress: 50 });
  });

  it('clears the ETA once the transfer is no longer measurable', () => {
    const result = applyDownloadProgress(
      [existing],
      progressEvent({ status: 'completed', progress: 100, downloaded_bytes: 1000 }),
      0,
      99
    );

    expect(result[0]).toMatchObject({ status: 'completed', eta: '' });
  });
});

describe('findDownloadByUrl', () => {
  it('matches on the enclosure URL', () => {
    const a: DownloadItem = {
      enclosureId: 1,
      url: 'https://a.example/1.mp3',
      fileName: '1.mp3',
      status: 'completed',
      progress: 100,
      downloadedBytes: 1,
      totalBytes: 1,
      updatedAt: 1,
    };
    const b: DownloadItem = { ...a, enclosureId: 2, url: 'https://b.example/2.mp3' };

    expect(findDownloadByUrl([a, b], 'https://b.example/2.mp3')).toBe(b);
    expect(findDownloadByUrl([a, b], 'https://c.example/3.mp3')).toBeUndefined();
  });
});
