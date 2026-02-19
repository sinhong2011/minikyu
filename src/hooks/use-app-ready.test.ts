import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Mock Tauri event API
const mockUnlisten = vi.fn();
let listenCallback: (() => void) | null = null;

vi.mock('@tauri-apps/api/event', () => ({
  listen: vi.fn((event: string, callback: () => void) => {
    if (event === 'database-ready') {
      listenCallback = callback;
    }
    return Promise.resolve(mockUnlisten);
  }),
}));

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), debug: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

const { useAppReady } = await import('./use-app-ready');

describe('useAppReady', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    listenCallback = null;
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('starts as not ready', () => {
    const { result } = renderHook(() => useAppReady());
    expect(result.current).toBe(false);
  });

  it('is not ready when only timer has elapsed', () => {
    const { result } = renderHook(() => useAppReady());
    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(result.current).toBe(false);
  });

  it('is not ready when only database-ready fires', () => {
    const { result } = renderHook(() => useAppReady());
    act(() => {
      listenCallback?.();
    });
    expect(result.current).toBe(false);
  });

  it('is not ready when only init-complete fires', () => {
    const { result } = renderHook(() => useAppReady());
    act(() => {
      window.dispatchEvent(new Event('app-init-complete'));
    });
    expect(result.current).toBe(false);
  });

  it('becomes ready when all three signals fire', () => {
    const { result } = renderHook(() => useAppReady());

    act(() => {
      listenCallback?.();
    });
    act(() => {
      window.dispatchEvent(new Event('app-init-complete'));
    });
    act(() => {
      vi.advanceTimersByTime(2000);
    });

    expect(result.current).toBe(true);
  });

  it('becomes ready regardless of signal order', () => {
    const { result } = renderHook(() => useAppReady());

    act(() => {
      vi.advanceTimersByTime(2000);
    });
    act(() => {
      window.dispatchEvent(new Event('app-init-complete'));
    });
    act(() => {
      listenCallback?.();
    });

    expect(result.current).toBe(true);
  });

  it('cleans up listeners on unmount', async () => {
    const removeEventListenerSpy = vi.spyOn(window, 'removeEventListener');
    const clearTimeoutSpy = vi.spyOn(globalThis, 'clearTimeout');

    const { unmount } = renderHook(() => useAppReady());
    unmount();

    // Flush the microtask queue so unlistenPromise.then() resolves
    await vi.waitFor(() => {
      expect(mockUnlisten).toHaveBeenCalled();
    });

    expect(removeEventListenerSpy).toHaveBeenCalledWith('app-init-complete', expect.any(Function));
    expect(clearTimeoutSpy).toHaveBeenCalled();
  });

  it('forces ready after safety timeout if signals never arrive', () => {
    const { result } = renderHook(() => useAppReady());

    // Only timer fires, no db or init signals
    act(() => {
      vi.advanceTimersByTime(15_000);
    });

    expect(result.current).toBe(true);
  });
});
