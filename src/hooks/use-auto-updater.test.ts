import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import i18n from '@/i18n/config';
import { useUpdaterStore } from '@/store/updater-store';
import { useAutoUpdater } from './use-auto-updater';

const {
  notificationsInfoMock,
  toastInfoMock,
  toastLoadingMock,
  toastDismissMock,
  installAndRelaunchMock,
} = vi.hoisted(() => ({
  notificationsInfoMock: vi.fn(),
  toastInfoMock: vi.fn(),
  toastLoadingMock: vi.fn(),
  toastDismissMock: vi.fn(),
  installAndRelaunchMock: vi.fn(),
}));

vi.mock('@/services/preferences', () => ({
  usePreferences: () => ({
    data: {
      // biome-ignore lint/style/useNamingConvention: preferences field name
      auto_check_updates: false,
    },
  }),
}));

vi.mock('@/lib/notifications', () => ({
  notifications: {
    info: notificationsInfoMock,
  },
}));

vi.mock('sonner', () => ({
  toast: {
    info: toastInfoMock,
    loading: toastLoadingMock,
    dismiss: toastDismissMock,
  },
}));

vi.mock('@/lib/updater', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/updater')>();
  return {
    ...actual,
    installAndRelaunch: installAndRelaunchMock,
  };
});

describe('useAutoUpdater', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    i18n.activate('en');
    useUpdaterStore.setState({ status: 'idle', _update: null });
  });

  it('shows install notification when update is ready', async () => {
    renderHook(() => useAutoUpdater());

    act(() => {
      useUpdaterStore.getState().setReady('1.2.3');
    });

    await waitFor(() => {
      expect(toastInfoMock).toHaveBeenCalledTimes(1);
      expect(notificationsInfoMock).toHaveBeenCalledTimes(1);
    });
  });

  it('does not duplicate ready notification for same version', async () => {
    renderHook(() => useAutoUpdater());

    act(() => {
      useUpdaterStore.getState().setReady('1.2.3');
    });

    await waitFor(() => {
      expect(toastInfoMock).toHaveBeenCalledTimes(1);
    });

    act(() => {
      useUpdaterStore.getState().setReady('1.2.3');
    });

    // Give effect cycle time; should remain unchanged.
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(toastInfoMock).toHaveBeenCalledTimes(1);
  });
});
