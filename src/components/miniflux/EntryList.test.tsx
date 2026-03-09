import { i18n } from '@lingui/core';
import { I18nProvider } from '@lingui/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, expect, it, vi } from 'vitest';
import type { Entry } from '@/lib/bindings';
import { fireEvent, render, screen, waitFor } from '@/test/test-utils';
import { EntryList } from './EntryList';

vi.mock('@/services/miniflux', () => ({
  useEntries: vi.fn(),
  usePrefetchEntry: vi.fn(),
}));

vi.mock('@/services/preferences', () => ({
  usePreferences: vi.fn(),
}));

vi.mock('@tauri-apps/api/core', () => ({
  convertFileSrc: vi.fn((path: string) => `asset://${path}`),
}));

const { useEntries, usePrefetchEntry } = await import('@/services/miniflux');
const { usePreferences } = await import('@/services/preferences');

class MockIntersectionObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}

vi.stubGlobal('IntersectionObserver', MockIntersectionObserver);

function localDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `section-${y}-${m}-${day}`;
}
const todayKey = localDateKey(new Date());
const yesterdayKey = localDateKey(new Date(Date.now() - 86400000));

function mockSectionOffsets() {
  const original = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'offsetTop');
  Object.defineProperty(HTMLElement.prototype, 'offsetTop', {
    configurable: true,
    get() {
      const key = (this as HTMLElement).dataset.sectionKey;
      if (key === todayKey) return 0;
      if (key === yesterdayKey) return 220;
      return 0;
    },
  });

  return () => {
    if (original) {
      Object.defineProperty(HTMLElement.prototype, 'offsetTop', original);
    }
  };
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: false },
    mutations: { retry: false },
  },
});

const TestWrapper = ({ children }: { children: React.ReactNode }) => (
  <QueryClientProvider client={queryClient}>
    <I18nProvider i18n={i18n}>{children}</I18nProvider>
  </QueryClientProvider>
);

const sampleEntry: Entry = {
  id: 'entry-1',
  user_id: '1',
  feed_id: '1',
  title: 'Entry title',
  url: 'https://example.com/articles/1',
  comments_url: null,
  author: 'Author',
  content: '<p>hello</p>',
  hash: 'hash',
  published_at: new Date(new Date().setHours(8, 0, 0, 0)).toISOString(),
  created_at: null,
  changed_at: null,
  status: 'unread',
  share_code: null,
  starred: false,
  reading_time: 3,
  enclosures: [],
  feed: {
    id: '1',
    user_id: '1',
    title: 'Feed title',
    site_url: 'https://example.com',
    feed_url: 'https://example.com/feed.xml',
    category: null,
    icon: null,
  },
  tags: [],
};

const olderEntry: Entry = {
  ...sampleEntry,
  id: 'entry-2',
  title: 'Older entry',
  published_at: new Date(Date.now() - 86400000).toISOString(),
};

describe('EntryList sticky section header', () => {
  it('renders the external section header shell without sticky positioning and updates title on scroll', async () => {
    i18n.load('en', {});
    i18n.activate('en');
    queryClient.clear();

    vi.mocked(useEntries).mockReturnValue({
      data: {
        entries: [sampleEntry, olderEntry],
        total: '2',
      },
      isLoading: false,
      error: null,
      fetchNextPage: vi.fn(),
      hasNextPage: false,
      isFetchingNextPage: false,
    } as never);
    vi.mocked(usePrefetchEntry).mockReturnValue(vi.fn());
    vi.mocked(usePreferences).mockReturnValue({
      data: {
        time_format: '24h',
        background_image_path: '/tmp/test-bg.png',
        background_image_opacity: 0.2,
        background_image_size: 'cover',
        background_image_blur: 0,
      },
    } as never);

    const restoreOffsets = mockSectionOffsets();

    render(
      <TestWrapper>
        <EntryList />
      </TestWrapper>
    );

    const stickyTitle = await screen.findByTestId('entry-list-sticky-title');
    const stickyShell = screen.getByTestId('entry-list-sticky-shell');

    expect(stickyShell).toHaveClass('relative');
    expect(stickyShell).not.toHaveClass('sticky');
    expect(stickyTitle).toHaveTextContent('Today');
    expect(screen.getByTestId('entry-list-section-mask')).toBeInTheDocument();

    const scrollContainer = screen.getByTestId('entry-list-scroll-container') as HTMLDivElement;
    Object.defineProperty(scrollContainer, 'scrollTop', {
      configurable: true,
      writable: true,
      value: 240,
    });
    fireEvent.scroll(scrollContainer);

    await waitFor(() => {
      expect(screen.getByTestId('entry-list-sticky-title')).toHaveTextContent('Yesterday');
    });

    restoreOffsets();
  });

  it('hides sticky section overlay while pull-to-refresh is active', async () => {
    i18n.load('en', {});
    i18n.activate('en');
    queryClient.clear();

    vi.mocked(useEntries).mockReturnValue({
      data: {
        entries: [sampleEntry, olderEntry],
        total: '2',
      },
      isLoading: false,
      error: null,
      fetchNextPage: vi.fn(),
      hasNextPage: false,
      isFetchingNextPage: false,
    } as never);
    vi.mocked(usePrefetchEntry).mockReturnValue(vi.fn());
    vi.mocked(usePreferences).mockReturnValue({
      data: {
        time_format: '24h',
      },
    } as never);

    const restoreOffsets = mockSectionOffsets();

    render(
      <TestWrapper>
        <EntryList onPullToRefresh={vi.fn()} isRefreshing />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(screen.queryByTestId('entry-list-sticky-title')).not.toBeInTheDocument();
    });

    restoreOffsets();
  });
});
