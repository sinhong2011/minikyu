import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useUIStore } from '@/store/ui-store';

vi.mock('@/lib/tauri-bindings', () => ({
  commands: {
    openInAppBrowser: vi.fn().mockResolvedValue(undefined),
    closeInAppBrowser: vi.fn().mockResolvedValue(undefined),
    resizeBrowserWebview: vi.fn().mockResolvedValue(undefined),
    syncBrowserTheme: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock('@tauri-apps/api/window', () => ({
  getCurrentWindow: () => ({
    theme: vi.fn().mockResolvedValue('light'),
    onThemeChanged: vi.fn().mockResolvedValue(vi.fn()),
  }),
}));

import { useInAppBrowser } from './use-in-app-browser';

describe('useInAppBrowser', () => {
  beforeEach(() => {
    useUIStore.setState({ inAppBrowserUrl: null, leftSidebarVisible: true });
  });

  it('closeBrowser clears inAppBrowserUrl', async () => {
    const { result } = renderHook(() => useInAppBrowser());
    useUIStore.setState({ inAppBrowserUrl: 'https://example.com' });

    await act(async () => {
      await result.current.closeBrowser();
    });

    expect(useUIStore.getState().inAppBrowserUrl).toBeNull();
  });

  it('closeBrowser restores sidebar visibility', async () => {
    const { result } = renderHook(() => useInAppBrowser());
    useUIStore.setState({ leftSidebarVisible: false });

    await act(async () => {
      await result.current.closeBrowser();
    });

    expect(useUIStore.getState().leftSidebarVisible).toBe(true);
  });
});
