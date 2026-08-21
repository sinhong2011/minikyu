import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vite-plus/test';
import { useUIStore } from '@/store/ui-store';

vi.mock('@/lib/tauri-bindings', () => ({
  commands: {
    openInAppBrowser: vi.fn().mockResolvedValue(undefined),
    closeInAppBrowser: vi.fn().mockResolvedValue(undefined),
    resizeBrowserWebview: vi.fn().mockResolvedValue(undefined),
    syncBrowserTheme: vi.fn().mockResolvedValue(undefined),
  },
}));

// The hook reads the open entry from the URL; these tests render it outside a
// RouterProvider, so stand in a location with no entry selected.
vi.mock('@tanstack/react-router', () => ({
  useRouterState: ({ select }: { select: (state: unknown) => unknown }) =>
    select({ location: { search: {} } }),
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

  it('closeBrowser does not affect sidebar visibility', async () => {
    const { result } = renderHook(() => useInAppBrowser());
    useUIStore.setState({ leftSidebarVisible: false });

    await act(async () => {
      await result.current.closeBrowser();
    });

    expect(useUIStore.getState().leftSidebarVisible).toBe(false);
  });
});
