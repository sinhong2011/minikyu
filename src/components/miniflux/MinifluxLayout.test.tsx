import { i18n } from '@lingui/core';
import { I18nProvider } from '@lingui/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useIsConnected } from '@/services/miniflux/auth';
import { useCategories } from '@/services/miniflux/categories';
import { useUnreadCounts } from '@/services/miniflux/counters';
import { useEntries, usePrefetchEntry } from '@/services/miniflux/entries';
import { useSyncMiniflux } from '@/services/miniflux/feeds';
import { useLastReadingEntry, useSaveLastReading } from '@/services/reading-state';
import { useSyncStore } from '@/store/sync-store';
import { useUIStore } from '@/store/ui-store';
import { MinifluxLayout } from './MinifluxLayout';

vi.mock('@lingui/core/macro', () => ({
  msg: (descriptor: any) => descriptor,
}));

vi.mock('@tanstack/react-router', () => ({
  useSearch: vi.fn(() => ({})),
}));

vi.mock('@/hooks/use-sync-progress-listener', () => ({
  useSyncProgressListener: vi.fn(),
}));

vi.mock('@/services/miniflux/auth', () => ({
  useIsConnected: vi.fn(),
}));

vi.mock('@/services/miniflux/categories', () => ({
  useCategories: vi.fn(),
}));

vi.mock('@/services/miniflux/counters', () => ({
  useUnreadCounts: vi.fn(),
}));

vi.mock('@/services/miniflux/entries', () => ({
  useEntries: vi.fn(),
  usePrefetchEntry: vi.fn(),
}));

vi.mock('@/services/miniflux/feeds', () => ({
  useSyncMiniflux: vi.fn(),
}));

vi.mock('@/services/reading-state', () => ({
  useLastReadingEntry: vi.fn(),
  useSaveLastReading: vi.fn(),
}));

vi.mock('@/store/sync-store', () => ({
  useSyncStore: vi.fn(),
}));

vi.mock('@/components/layout/MainWindowContent', () => ({
  // biome-ignore lint/style/useNamingConvention: mock module export name
  MainWindowContent: ({
    children,
    onClose,
  }: {
    children: React.ReactNode;
    onClose?: () => void;
  }) => (
    <div>
      <button type="button" data-testid="close-reading" onClick={onClose}>
        Close
      </button>
      {children}
    </div>
  ),
}));

vi.mock('./EntryList', () => ({
  // biome-ignore lint/style/useNamingConvention: mock module export name
  EntryList: () => <div data-testid="entry-list" />,
}));

vi.mock('./EntryFilters', () => ({
  // biome-ignore lint/style/useNamingConvention: mock module export name
  EntryFiltersUI: () => <div data-testid="entry-filters" />,
}));

vi.mock('./ConnectionDialog', () => ({
  // biome-ignore lint/style/useNamingConvention: mock module export name
  ConnectionDialog: () => null,
}));

i18n.load('en', {
  // biome-ignore lint/style/useNamingConvention: i18n key
  All: 'All',
  // biome-ignore lint/style/useNamingConvention: i18n key
  Loading: 'Loading',
} as Record<string, string>);
i18n.activate('en');

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
    },
  },
});

const TestWrapper = ({ children }: { children: React.ReactNode }) => (
  <QueryClientProvider client={queryClient}>
    <I18nProvider i18n={i18n}>{children}</I18nProvider>
  </QueryClientProvider>
);

describe('MinifluxLayout', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    queryClient.clear();

    useUIStore.setState({
      selectedEntryId: undefined,
      searchFiltersVisible: false,
    });

    (useIsConnected as any).mockReturnValue({
      data: true,
      isLoading: false,
    });

    (useCategories as any).mockReturnValue({ data: [] });
    (useUnreadCounts as any).mockReturnValue({
      data: {
        total: 1,
        today: 1,
        // biome-ignore lint/style/useNamingConvention: API response format
        by_category: [],
        // biome-ignore lint/style/useNamingConvention: API response format
        by_feed: [],
      },
    });
    (useEntries as any).mockReturnValue({
      data: {
        entries: [{ id: '1536612' }],
        total: '1',
      },
    });
    (usePrefetchEntry as any).mockReturnValue(vi.fn());
    (useSyncMiniflux as any).mockReturnValue({
      mutate: vi.fn(),
    });
    (useSaveLastReading as any).mockReturnValue({
      mutate: vi.fn(),
    });
    (useSyncStore as any).mockImplementation((selector: any) =>
      selector({
        syncing: false,
      })
    );
    (useLastReadingEntry as any).mockReturnValue({
      data: {
        // biome-ignore lint/style/useNamingConvention: API response format
        entry_id: '1536612',
        timestamp: '1770881306750',
      },
    });
  });

  it('keeps reader closed after close button even when last reading exists', async () => {
    render(<MinifluxLayout />, { wrapper: TestWrapper });

    await waitFor(() => {
      expect(useUIStore.getState().selectedEntryId).toBe('1536612');
    });

    fireEvent.click(screen.getByTestId('close-reading'));

    await waitFor(() => {
      expect(useUIStore.getState().selectedEntryId).toBeUndefined();
    });

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 60));
    });

    expect(useUIStore.getState().selectedEntryId).toBeUndefined();
  });
});
