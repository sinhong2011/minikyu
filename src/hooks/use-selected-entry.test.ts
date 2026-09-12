import { renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test';
import { rememberReaderClosed, resetHistoryIntent } from '@/lib/history-intent';

const search = vi.hoisted(() => ({ entry: undefined as string | undefined }));

vi.mock('@tanstack/react-router', () => ({
  useRouterState: ({ select }: { select: (state: { location: { search: typeof search } }) => unknown }) =>
    select({ location: { search } }),
}));

import { getSelectedEntryId, useSelectedEntryId } from './use-selected-entry';

describe('useSelectedEntryId', () => {
  beforeEach(() => {
    resetHistoryIntent();
    search.entry = undefined;
    vi.stubGlobal('location', { search: '' });
  });

  it('returns the URL entry', () => {
    search.entry = '1536612';
    const { result } = renderHook(() => useSelectedEntryId());
    expect(result.current).toBe('1536612');
  });

  it('hides an iOS swipe-back echo so the reader does not remount', () => {
    rememberReaderClosed('1536612');
    search.entry = '1536612';
    const { result } = renderHook(() => useSelectedEntryId());
    expect(result.current).toBeUndefined();
  });
});

describe('getSelectedEntryId', () => {
  beforeEach(() => {
    resetHistoryIntent();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('hides the same echo for imperative callers', () => {
    rememberReaderClosed('1536612');
    vi.stubGlobal('location', { search: '?entry=1536612' });
    expect(getSelectedEntryId()).toBeUndefined();
  });
});
