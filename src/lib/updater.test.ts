import { relaunch } from '@tauri-apps/plugin-process';
import { check } from '@tauri-apps/plugin-updater';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useUpdaterStore } from '@/store/updater-store';
import { checkForUpdate, downloadUpdate, installAndRelaunch } from './updater';

vi.mock('@tauri-apps/plugin-updater', () => ({
  check: vi.fn(),
}));

vi.mock('@tauri-apps/plugin-process', () => ({
  relaunch: vi.fn(),
}));

describe('updater service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useUpdaterStore.setState({ status: 'idle', _update: null });
  });

  describe('checkForUpdate', () => {
    it('sets store to available when update exists', async () => {
      const mockUpdate = {
        version: '1.4.0',
        date: '2026-03-04',
        body: 'Bug fixes',
        download: vi.fn(),
        install: vi.fn(),
        downloadAndInstall: vi.fn(),
        close: vi.fn(),
      };
      vi.mocked(check).mockResolvedValue(mockUpdate as any);

      const result = await checkForUpdate();

      expect(result).toBe(true);
      expect(useUpdaterStore.getState().status).toBe('available');
    });

    it('sets store to up-to-date when no update', async () => {
      vi.mocked(check).mockResolvedValue(null);

      const result = await checkForUpdate();

      expect(result).toBe(false);
      expect(useUpdaterStore.getState().status).toBe('up-to-date');
    });

    it('sets store to error on failure', async () => {
      vi.mocked(check).mockRejectedValue(new Error('Network error'));

      const result = await checkForUpdate();

      expect(result).toBe(false);
      expect(useUpdaterStore.getState().status).toBe('error');
    });
  });

  describe('downloadUpdate', () => {
    it('downloads without installing and transitions to ready', async () => {
      const mockUpdate = {
        version: '1.4.0',
        download: vi.fn().mockResolvedValue(undefined),
        install: vi.fn(),
        downloadAndInstall: vi.fn(),
      };
      useUpdaterStore.setState({ status: 'available', version: '1.4.0', date: '', body: '' });
      useUpdaterStore.getState()._setUpdate(mockUpdate as any);

      await downloadUpdate();

      expect(mockUpdate.download).toHaveBeenCalled();
      expect(mockUpdate.install).not.toHaveBeenCalled();
      expect(mockUpdate.downloadAndInstall).not.toHaveBeenCalled();
      expect(useUpdaterStore.getState().status).toBe('ready');
    });

    it('sets error when no update object available', async () => {
      useUpdaterStore.setState({ status: 'available', version: '1.4.0', date: '', body: '' });

      await downloadUpdate();

      expect(useUpdaterStore.getState().status).toBe('error');
    });
  });

  describe('installAndRelaunch', () => {
    it('installs the update then relaunches', async () => {
      const mockUpdate = {
        install: vi.fn().mockResolvedValue(undefined),
      };
      useUpdaterStore.setState({ status: 'ready', version: '1.4.0' });
      useUpdaterStore.getState()._setUpdate(mockUpdate as any);

      await installAndRelaunch();

      expect(mockUpdate.install).toHaveBeenCalled();
      expect(relaunch).toHaveBeenCalled();
    });

    it('sets error when no update object available', async () => {
      await installAndRelaunch();

      expect(useUpdaterStore.getState().status).toBe('error');
      expect(relaunch).not.toHaveBeenCalled();
    });
  });
});
