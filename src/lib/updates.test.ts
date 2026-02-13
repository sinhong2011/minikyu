import { check } from '@tauri-apps/plugin-updater';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { checkLatestVersion } from './updates';

vi.mock('@tauri-apps/plugin-updater', () => ({
  check: vi.fn(),
}));

describe('checkLatestVersion', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns available when update exists', async () => {
    const availableUpdate = {
      version: '0.2.0',
      currentVersion: '0.1.0',
      date: '2026-02-12T00:00:00.000Z',
      body: null,
      rawJson: null,
      download: vi.fn(),
      install: vi.fn(),
      downloadAndInstall: vi.fn(),
      close: vi.fn(),
    } as unknown as NonNullable<Awaited<ReturnType<typeof check>>>;

    vi.mocked(check).mockResolvedValue(availableUpdate);

    await expect(checkLatestVersion()).resolves.toEqual({
      status: 'available',
      update: availableUpdate,
      version: '0.2.0',
    });
  });

  it('returns up-to-date when no update exists', async () => {
    vi.mocked(check).mockResolvedValue(null);

    await expect(checkLatestVersion()).resolves.toEqual({
      status: 'up-to-date',
    });
  });
});
