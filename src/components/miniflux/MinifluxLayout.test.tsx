import { i18n } from '@lingui/core';
import { I18nProvider } from '@lingui/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useSyncExternalStore } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vite-plus/test';
import { useAccounts, useActiveAccount } from '@/services/miniflux/accounts';
import { useIsConnected } from '@/services/miniflux/auth';
import { useCategories, useMarkCategoryAsRead } from '@/services/miniflux/categories';
import { useUnreadCounts } from '@/services/miniflux/counters';
import { useEntries, usePrefetchEntry } from '@/services/miniflux/entries';
import { useMarkFeedAsRead, useSyncMiniflux } from '@/services/miniflux/feeds';
import { useLastReadingEntry, useSaveLastReading } from '@/services/reading-state';
import { useSyncStore } from '@/store/sync-store';
import { useUIStore } from '@/store/ui-store';
import { MinifluxLayout } from './MinifluxLayout';

/**
 * The URL is the component's state now, so the router mock has to behave like
 * one: `navigate` applies the patch and re-renders, the way a real navigation
 * would. A `mockReturnValue` stub would make every write a no-op and the
 * open/close assertions vacuous.
 */
const routerMock = vi.hoisted(() => {
  let search: Record<string, unknown> = {};
  const listeners = new Set<() => void>();
  const emit = () => {
    for (const listener of listeners) listener();
  };

  return {
    getSearch: () => search,
    /** Seed the URL for a test, as if it had been navigated to directly. */
    set: (next: Record<string, unknown>) => {
      search = next;
      emit();
    },
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    navigate: (options: { search?: unknown }) => {
      const patch =
        typeof options.search === 'function'
          ? (options.search as (prev: Record<string, unknown>) => Record<string, unknown>)(search)
          : (options.search as Record<string, unknown> | undefined);
      // TanStack Router drops undefined params from the query string.
      search = Object.fromEntries(
        Object.entries({ ...search, ...patch }).filter(([, value]) => value !== undefined)
      );
      emit();
    },
    back: vi.fn(),
  };
});

vi.mock('@tanstack/react-router', () => ({
  useSearch: () => useSyncExternalStore(routerMock.subscribe, routerMock.getSearch),
  useNavigate: () => routerMock.navigate,
  useRouter: () => ({ history: { back: routerMock.back } }),
}));

vi.mock('@/hooks/use-sync-progress-listener', () => ({
  useSyncProgressListener: vi.fn(),
}));

vi.mock('@/services/miniflux/auth', () => ({
  useIsConnected: vi.fn(),
}));

vi.mock('@/services/miniflux/accounts', () => ({
  useAccounts: vi.fn(),
  useActiveAccount: vi.fn(),
}));

vi.mock('@/services/miniflux/categories', () => ({
  useCategories: vi.fn(),
  useMarkCategoryAsRead: vi.fn(),
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
  useMarkFeedAsRead: vi.fn(),
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
  EntryList: () => <div data-testid="entry-list" />,
}));

vi.mock('./EntryFilters', () => ({
  EntryFiltersUI: () => <div data-testid="entry-filters" />,
}));

vi.mock('./ConnectionDialog', () => ({
  ConnectionDialog: () => null,
}));

vi.mock('@/lib/account-reset', () => ({
  resetAccountState: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/hooks/use-auto-sync', () => ({
  useAutoSync: vi.fn(),
}));

i18n.load('en', {
  All: 'All',
  Starred: 'Starred',
  History: 'History',
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

    useUIStore.setState({ searchFiltersVisible: false });
    routerMock.set({});

    (useIsConnected as any).mockReturnValue({
      data: true,
      isLoading: false,
    });
    (useAccounts as any).mockReturnValue({
      data: [],
    });
    (useActiveAccount as any).mockReturnValue({
      data: { id: '1', username: 'minikyu_dev' },
    });

    (useCategories as any).mockReturnValue({ data: [] });
    (useUnreadCounts as any).mockReturnValue({
      data: {
        total: 1,
        today: 1,
        by_category: [],
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
    (useMarkFeedAsRead as any).mockReturnValue({
      mutateAsync: vi.fn(),
    });
    (useMarkCategoryAsRead as any).mockReturnValue({
      mutateAsync: vi.fn(),
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
        entry_id: '1536612',
        timestamp: '1770881306750',
      },
    });
  });

  it('keeps reader closed after close button even when last reading exists', async () => {
    render(<MinifluxLayout />, { wrapper: TestWrapper });

    await waitFor(() => {
      expect(routerMock.getSearch().entry).toBe('1536612');
    });

    fireEvent.click(screen.getByTestId('close-reading'));

    await waitFor(() => {
      expect(routerMock.getSearch().entry).toBeUndefined();
    });

    // The resume-last-reading effect must not undo the close on a later tick.
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 60));
    });

    expect(routerMock.getSearch().entry).toBeUndefined();
  });

  it('restores the last reading entry into the URL, without a history push', async () => {
    render(<MinifluxLayout />, { wrapper: TestWrapper });

    await waitFor(() => {
      expect(routerMock.getSearch().entry).toBe('1536612');
    });
    expect(routerMock.back).not.toHaveBeenCalled();
  });

  it('defaults to unread on the article views and records an explicit all', async () => {
    render(<MinifluxLayout />, { wrapper: TestWrapper });

    // Absent means "the view default", so a pristine URL stays pristine...
    expect(routerMock.getSearch().status).toBeUndefined();
    expect((useEntries as any).mock.calls.at(-1)?.[0]).toMatchObject({ status: 'unread' });

    // ...while choosing All is written out, so it survives a reload.
    await act(async () => {
      routerMock.navigate({
        search: (prev: Record<string, unknown>) => ({ ...prev, status: 'all' }),
      });
    });

    expect(routerMock.getSearch().status).toBe('all');
    expect((useEntries as any).mock.calls.at(-1)?.[0].status).toBeUndefined();
  });

  it('sorts history by read time unless the URL says otherwise', async () => {
    routerMock.set({ filter: 'history' });
    render(<MinifluxLayout />, { wrapper: TestWrapper });

    expect((useEntries as any).mock.calls.at(-1)?.[0]).toMatchObject({
      status: 'read',
      order: 'changed_at',
      direction: 'desc',
    });

    await act(async () => {
      routerMock.navigate({
        search: (prev: Record<string, unknown>) => ({ ...prev, sort: 'published_at' }),
      });
    });

    expect((useEntries as any).mock.calls.at(-1)?.[0]).toMatchObject({ order: 'published_at' });
  });

  it('shows unread count below the title on all entries view', () => {
    (useUnreadCounts as any).mockReturnValue({
      data: {
        total: 23,
        today: 3,
        by_category: [],
        by_feed: [],
      },
    });

    render(<MinifluxLayout />, { wrapper: TestWrapper });

    expect(screen.getByRole('heading', { name: 'All' })).toBeInTheDocument();
    expect(screen.getByText('23 unread items')).toBeInTheDocument();
  });

  it('shows starred count below the title on starred entries view', () => {
    routerMock.set({ filter: 'starred' });
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
    routerMock.set({ filter: 'history' });
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
        by_category: [],
        by_feed: [],
      },
    });

    render(<MinifluxLayout />, { wrapper: TestWrapper });

    expect(screen.getByText('12.3K unread items')).toBeInTheDocument();
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
        by_category: [],
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
        by_category: [],
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
