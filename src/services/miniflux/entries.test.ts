import { i18n } from '@lingui/core';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook } from '@testing-library/react';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('sonner', () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    debug: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}));

vi.mock('@/lib/tauri-bindings', () => ({
  commands: {
    fetchEntryContent: vi.fn(),
  },
}));

import { toast } from 'sonner';
import { commands } from '@/lib/tauri-bindings';
import { entryQueryKeys, getNextEntriesOffset, useFetchEntryContent } from './entries';

describe('getNextEntriesOffset', () => {
  beforeEach(() => {
    i18n.load('en', {});
    i18n.activate('en');
    vi.clearAllMocks();
  });

  it('returns next offset when loaded entries are below total', () => {
    const nextOffset = getNextEntriesOffset([
      { total: '250', entries: new Array(100).fill({}) },
      { total: '250', entries: new Array(100).fill({}) },
    ]);

    expect(nextOffset).toBe(200);
  });

  it('returns undefined when all entries are loaded', () => {
    const nextOffset = getNextEntriesOffset([
      { total: '200', entries: new Array(100).fill({}) },
      { total: '200', entries: new Array(100).fill({}) },
    ]);

    expect(nextOffset).toBeUndefined();
  });

  it('returns undefined when total is invalid', () => {
    const nextOffset = getNextEntriesOffset([
      { total: 'invalid', entries: new Array(10).fill({}) },
    ]);

    expect(nextOffset).toBeUndefined();
  });

  it('returns undefined when the last page is empty', () => {
    const nextOffset = getNextEntriesOffset([
      { total: '300', entries: new Array(100).fill({}) },
      { total: '300', entries: [] },
    ]);

    expect(nextOffset).toBeUndefined();
  });
});

describe('useFetchEntryContent', () => {
  beforeEach(() => {
    i18n.load('en', {});
    i18n.activate('en');
    vi.clearAllMocks();
  });

  function createWrapper(queryClient: QueryClient) {
    return ({ children }: { children: React.ReactNode }) =>
      React.createElement(QueryClientProvider, { client: queryClient }, children);
  }

  it('calls command with expected payload and invalidates entry queries on success', async () => {
    (commands.fetchEntryContent as any).mockResolvedValue({
      status: 'ok',
      data: '<p>full content</p>',
    });
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
        },
      },
    });
    const invalidateQueriesSpy = vi.spyOn(queryClient, 'invalidateQueries');
    const { result } = renderHook(() => useFetchEntryContent(), {
      wrapper: createWrapper(queryClient),
    });

    await act(async () => {
      await result.current.mutateAsync({ id: '42', updateContent: true });
    });

    expect(commands.fetchEntryContent).toHaveBeenCalledWith('42', true);
    expect(invalidateQueriesSpy).toHaveBeenCalledWith({ queryKey: entryQueryKeys.detail('42') });
    expect(invalidateQueriesSpy).toHaveBeenCalledWith({ queryKey: entryQueryKeys.lists() });
    expect(toast.success).toHaveBeenCalledWith('Original content downloaded');
  });

  it('shows an error toast when command returns an error', async () => {
    (commands.fetchEntryContent as any).mockResolvedValue({
      status: 'error',
      error: 'network failed',
    });
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
        },
      },
    });
    const { result } = renderHook(() => useFetchEntryContent(), {
      wrapper: createWrapper(queryClient),
    });

    await expect(result.current.mutateAsync({ id: '99', updateContent: true })).rejects.toThrow(
      'network failed'
    );

    expect(toast.error).toHaveBeenCalledWith('Failed to download original content', {
      description: 'network failed',
    });
  });
});
