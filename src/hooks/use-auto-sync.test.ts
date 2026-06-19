import { renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useAutoSync } from './use-auto-sync';

const { mutateMock, useSyncMinifluxMock, useIsConnectedMock, usePreferencesMock } = vi.hoisted(
  () => ({
    mutateMock: vi.fn(),
    useSyncMinifluxMock: vi.fn(),
    useIsConnectedMock: vi.fn(),
    usePreferencesMock: vi.fn(),
  })
);

vi.mock('@/services/miniflux/feeds', () => ({
  useSyncMiniflux: useSyncMinifluxMock,
}));

vi.mock('@/services/miniflux/auth', () => ({
  useIsConnected: useIsConnectedMock,
}));

vi.mock('@/services/preferences', () => ({
  usePreferences: usePreferencesMock,
}));

vi.mock('@/lib/logger', () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

describe('useAutoSync', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    useIsConnectedMock.mockReturnValue({ data: true });
    usePreferencesMock.mockReturnValue({ data: { sync_interval: 1 } });
    useSyncMinifluxMock.mockReturnValue({ isPending: false, mutate: mutateMock });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('triggers a sync after the configured interval elapses', () => {
    renderHook(() => useAutoSync());

    expect(mutateMock).not.toHaveBeenCalled();
    vi.advanceTimersByTime(60 * 1000);
    expect(mutateMock).toHaveBeenCalledTimes(1);
  });

  it('does not recreate the interval when the mutation state changes', () => {
    const clearSpy = vi.spyOn(globalThis, 'clearInterval');
    const setSpy = vi.spyOn(globalThis, 'setInterval');

    const { rerender } = renderHook(() => useAutoSync());

    const setCallsAfterMount = setSpy.mock.calls.length;
    const clearCallsAfterMount = clearSpy.mock.calls.length;

    // Simulate the mutation flipping pending -> idle across re-renders. Before
    // useEffectEvent this changed the effect dependency and churned the timer.
    useSyncMinifluxMock.mockReturnValue({ isPending: true, mutate: mutateMock });
    rerender();
    useSyncMinifluxMock.mockReturnValue({ isPending: false, mutate: mutateMock });
    rerender();

    expect(setSpy.mock.calls.length).toBe(setCallsAfterMount);
    expect(clearSpy.mock.calls.length).toBe(clearCallsAfterMount);
  });

  it('skips triggering a sync while a sync is already pending', () => {
    useSyncMinifluxMock.mockReturnValue({ isPending: true, mutate: mutateMock });
    renderHook(() => useAutoSync());

    vi.advanceTimersByTime(60 * 1000);
    expect(mutateMock).not.toHaveBeenCalled();
  });
});
