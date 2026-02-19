import { i18n } from '@lingui/core';
import { I18nProvider } from '@lingui/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useSearch } from '@tanstack/react-router';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useActiveAccount } from '@/services/miniflux/accounts';
import { useIsConnected } from '@/services/miniflux/auth';
import { useCategories } from '@/services/miniflux/categories';
import { useUnreadCounts } from '@/services/miniflux/counters';
import { useEntries, usePrefetchEntry } from '@/services/miniflux/entries';
import { useSyncMiniflux } from '@/services/miniflux/feeds';
import { useLastReadingEntry, useSaveLastReading } from '@/services/reading-state';
import { useSyncStore } from '@/store/sync-store';
import { useUIStore } from '@/store/ui-store';
import { MinifluxLayout } from './MinifluxLayout';

vi.mock('@tanstack/react-router', () => ({
  useSearch: vi.fn(() => ({})),
}));

vi.mock('@/hooks/use-sync-progress-listener', () => ({
  useSyncProgressListener: vi.fn(),
}));

vi.mock('@/services/miniflux/auth', () => ({
  useIsConnected: vi.fn(),
}));

vi.mock('@/services/miniflux/accounts', () => ({
  useActiveAccount: vi.fn(),
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
  useToggleEntryRead: vi.fn(),
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
  Starred: 'Starred',
  // biome-ignore lint/style/useNamingConvention: i18n key
  History: 'History',
  // biome-ignore lint/style/useNamingConvention: i18n key
  Loading: 'Loading',
  'unread items': 'unread items',
  'starred items': 'starred items',
  'history items': 'history items',
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
    (useSearch as any).mockReturnValue({});

    (useIsConnected as any).mockReturnValue({
      data: true,
      isLoading: false,
    });
    (useActiveAccount as any).mockReturnValue({
      data: { id: '1', username: 'minikyu_dev' },
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

  it('shows unread count below the title on all entries view', () => {
    (useUnreadCounts as any).mockReturnValue({
      data: {
        total: 23,
        today: 3,
        // biome-ignore lint/style/useNamingConvention: API response format
        by_category: [],
        // biome-ignore lint/style/useNamingConvention: API response format
        by_feed: [],
      },
    });

    render(<MinifluxLayout />, { wrapper: TestWrapper });

    expect(screen.getByRole('heading', { name: 'All' })).toBeInTheDocument();
    expect(screen.getByText('23 unread items')).toBeInTheDocument();
  });

  it('shows starred count below the title on starred entries view', () => {
    (useSearch as any).mockReturnValue({ filter: 'starred' });
    (useEntries as any).mockReturnValue({
      data: {
        entries: [{ id: '1536612' }],
        total: '7',
      },
    });

    render(<MinifluxLayout />, { wrapper: TestWrapper });

    expect(screen.getByRole('heading', { name: 'Starred' })).toBeInTheDocument();
    expect(screen.getByText('7 starred items')).toBeInTheDocument();
  });

  it('shows history count below the title on history entries view', () => {
    (useSearch as any).mockReturnValue({ filter: 'history' });
    (useEntries as any).mockReturnValue({
      data: {
        entries: [{ id: '1536612' }],
        total: '11',
      },
    });

    render(<MinifluxLayout />, { wrapper: TestWrapper });

    expect(screen.getByRole('heading', { name: 'History' })).toBeInTheDocument();
    expect(screen.getByText('11 history items')).toBeInTheDocument();
  });

  it('formats large unread count with locale separators', () => {
    (useUnreadCounts as any).mockReturnValue({
      data: {
        total: 12345,
        today: 3,
        // biome-ignore lint/style/useNamingConvention: API response format
        by_category: [],
        // biome-ignore lint/style/useNamingConvention: API response format
        by_feed: [],
      },
    });

    render(<MinifluxLayout />, { wrapper: TestWrapper });

    expect(screen.getByText('12,345 unread items')).toBeInTheDocument();
  });

  it('renders cached content instead of welcome screen when offline', () => {
    (useIsConnected as any).mockReturnValue({
      data: false,
      isLoading: false,
    });
    (useCategories as any).mockReturnValue({
      data: [{ id: '1', title: 'Tech' }],
    });
    (useEntries as any).mockReturnValue({
      data: {
        entries: [{ id: '1536612' }],
        total: '1',
      },
    });

    render(<MinifluxLayout />, { wrapper: TestWrapper });

    expect(screen.queryByText('Welcome to Miniflux')).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'All' })).toBeInTheDocument();
  });

  it('shows welcome screen when offline without cached content', () => {
    (useIsConnected as any).mockReturnValue({
      data: false,
      isLoading: false,
    });
    (useActiveAccount as any).mockReturnValue({
      data: null,
    });
    (useCategories as any).mockReturnValue({ data: [] });
    (useUnreadCounts as any).mockReturnValue({
      data: {
        total: 0,
        today: 0,
        // biome-ignore lint/style/useNamingConvention: API response format
        by_category: [],
        // biome-ignore lint/style/useNamingConvention: API response format
        by_feed: [],
      },
    });
    (useEntries as any).mockReturnValue({
      data: {
        entries: [],
        total: '0',
      },
    });

    render(<MinifluxLayout />, { wrapper: TestWrapper });

    expect(screen.getByText('Welcome to Miniflux')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Connect to Server' })).toBeInTheDocument();
  });

  it('does not show welcome screen when offline with an active local account', () => {
    (useIsConnected as any).mockReturnValue({
      data: false,
      isLoading: false,
    });
    (useActiveAccount as any).mockReturnValue({
      data: { id: '1', username: 'minikyu_dev' },
    });
    (useCategories as any).mockReturnValue({ data: [] });
    (useUnreadCounts as any).mockReturnValue({
      data: {
        total: 0,
        today: 0,
        // biome-ignore lint/style/useNamingConvention: API response format
        by_category: [],
        // biome-ignore lint/style/useNamingConvention: API response format
        by_feed: [],
      },
    });
    (useEntries as any).mockReturnValue({
      data: {
        entries: [],
        total: '0',
      },
    });

    render(<MinifluxLayout />, { wrapper: TestWrapper });

    expect(screen.queryByText('Welcome to Miniflux')).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'All' })).toBeInTheDocument();
  });
});
