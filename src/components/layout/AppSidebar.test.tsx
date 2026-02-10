import { i18n } from '@lingui/core';
import { I18nProvider } from '@lingui/react';
import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SidebarProvider } from '@/components/ui/sidebar';
import {
  useCategories,
  useCategoryFeeds,
  useCategoryUnreadCount,
  useFeedUnreadCount,
  useIsConnected,
  useRefreshAllFeeds,
  useUnreadCounts,
} from '@/services/miniflux';
import { AppSidebar } from './AppSidebar';

vi.mock('@lingui/core/macro', () => ({
  msg: (descriptor: any) => descriptor,
}));

i18n.load('en', {
  // biome-ignore lint/style/useNamingConvention: i18n key
  Minikyu: 'Minikyu',
  // biome-ignore lint/style/useNamingConvention: i18n key
  Views: 'Views',
  // biome-ignore lint/style/useNamingConvention: i18n key
  Categories: 'Categories',
  'Not Connected': 'Not Connected',
  'Failed to load feeds': 'Failed to load feeds',
  // biome-ignore lint/style/useNamingConvention: i18n key
  Sync: 'Sync',
  // biome-ignore lint/style/useNamingConvention: i18n key
  All: 'All',
  // biome-ignore lint/style/useNamingConvention: i18n key
  Today: 'Today',
  // biome-ignore lint/style/useNamingConvention: i18n key
  Starred: 'Starred',
  // biome-ignore lint/style/useNamingConvention: i18n key
  History: 'History',
} as Record<string, string>);
i18n.activate('en');

vi.mock('@/services/miniflux', () => ({
  useCategories: vi.fn(),
  useCategoryFeeds: vi.fn(),
  useCategoryUnreadCount: vi.fn(),
  useFeedUnreadCount: vi.fn(),
  useIsConnected: vi.fn(),
  useRefreshAllFeeds: vi.fn(),
  useUnreadCounts: vi.fn(),
}));

vi.mock('@tanstack/react-router', () => ({
  // biome-ignore lint/style/useNamingConvention: mock component name
  Link: ({ children, to, search, activeOptions }: any) => {
    return (
      <a
        href={to + (search ? `?${new URLSearchParams(search).toString()}` : '')}
        data-active-options={JSON.stringify(activeOptions)}
        data-testid="mock-link"
      >
        {typeof children === 'function' ? children({ isActive: false }) : children}
      </a>
    );
  },
}));

vi.mock('@/components/miniflux', () => ({
  // biome-ignore lint/style/useNamingConvention: Mock component name
  UserNav: () => <div data-testid="user-nav">UserNav</div>,
  // biome-ignore lint/style/useNamingConvention: Mock component name
  FeedAvatar: () => <div data-testid="feed-avatar" />,
}));

vi.mock('@/components/animate-ui/primitives/base/collapsible', () => {
  const CollapsibleContext = React.createContext<{
    isOpen: boolean;
    setIsOpen: React.Dispatch<React.SetStateAction<boolean>>;
  }>({
    isOpen: true,
    setIsOpen: () => {},
  });

  return {
    // biome-ignore lint/style/useNamingConvention: Mock component name
    Collapsible: ({ children, defaultOpen = false }: any) => {
      const [isOpen, setIsOpen] = React.useState(defaultOpen);
      return (
        <CollapsibleContext.Provider value={{ isOpen, setIsOpen }}>
          <div data-testid="collapsible" data-state={isOpen ? 'open' : 'closed'}>
            {children}
          </div>
        </CollapsibleContext.Provider>
      );
    },
    // biome-ignore lint/style/useNamingConvention: Mock component name
    CollapsibleTrigger: ({ children, className }: any) => {
      const { setIsOpen } = React.useContext(CollapsibleContext);
      return (
        <button
          type="button"
          data-testid="collapsible-trigger"
          onClick={() => setIsOpen((prev) => !prev)}
          className={className}
        >
          {children}
        </button>
      );
    },
    // biome-ignore lint/style/useNamingConvention: Mock component name
    CollapsiblePanel: ({ children }: any) => {
      const { isOpen } = React.useContext(CollapsibleContext);
      return isOpen ? <div data-testid="collapsible-panel">{children}</div> : null;
    },
    useCollapsible: () => React.useContext(CollapsibleContext),
  };
});

const mockCategories = [
  {
    id: '1',
    title: 'Tech',
    // biome-ignore lint/style/useNamingConvention: API response format
    user_id: 1,
  },
  {
    id: '2',
    title: 'News',
    // biome-ignore lint/style/useNamingConvention: API response format
    user_id: 1,
  },
];

const mockFeeds = [
  {
    id: 101,
    title: 'TechCrunch',
    category: {
      id: '1',
      title: 'Tech',
      // biome-ignore lint/style/useNamingConvention: API response format
      user_id: 1,
    },
  },
  {
    id: 102,
    title: 'Verge',
    category: {
      id: '1',
      title: 'Tech',
      // biome-ignore lint/style/useNamingConvention: API response format
      user_id: 1,
    },
  },
];

describe('AppSidebar', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    (useIsConnected as any).mockReturnValue({ data: true, isLoading: false });
    (useUnreadCounts as any).mockReturnValue({
      data: {
        total: 0,
        today: 0,
      },
    });
    (useCategoryUnreadCount as any).mockReturnValue(0);
    (useFeedUnreadCount as any).mockReturnValue(0);
    (useCategories as any).mockReturnValue({
      data: mockCategories,
      isLoading: false,
    });
    (useCategoryFeeds as any).mockImplementation((categoryId: any) => {
      if (String(categoryId) === '1') {
        return { data: mockFeeds, isLoading: false, error: null };
      }
      return { data: [], isLoading: false, error: null };
    });
    (useRefreshAllFeeds as any).mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
    });
  });

  const renderComponent = () => {
    return render(
      <I18nProvider i18n={i18n}>
        <SidebarProvider>
          <AppSidebar />
        </SidebarProvider>
      </I18nProvider>
    );
  };

  it('renders categories', () => {
    renderComponent();
    expect(screen.getByText('Tech')).toBeInTheDocument();
    expect(screen.getByText('News')).toBeInTheDocument();
  });

  it('category title navigates to correct URL', () => {
    renderComponent();
    const techLink = screen.getByText('Tech').closest('a');
    expect(techLink).not.toBeNull();
    if (techLink) {
      expect(techLink).toHaveAttribute('href', '/?categoryId=1');
    }
  });

  it('toggles feeds visibility when chevron is clicked', async () => {
    renderComponent();

    expect(screen.getByText('TechCrunch')).toBeInTheDocument();

    const triggers = screen.getAllByTestId('collapsible-trigger');
    if (triggers[0]) {
      fireEvent.click(triggers[0]);
    }

    expect(screen.queryByText('TechCrunch')).not.toBeInTheDocument();

    if (triggers[0]) {
      fireEvent.click(triggers[0]);
    }
    expect(screen.getByText('TechCrunch')).toBeInTheDocument();
  });

  it('shows loading state for feeds', () => {
    (useCategoryFeeds as any).mockReturnValue({
      data: undefined,
      isLoading: true,
      error: null,
    });
    renderComponent();

    const skeletons = document.querySelectorAll('.animate-pulse');
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it('shows error state for feeds', () => {
    (useCategoryFeeds as any).mockReturnValue({
      data: undefined,
      isLoading: false,
      error: 'Error',
    });
    renderComponent();
    expect(screen.getAllByText('Failed to load feeds')[0]).toBeInTheDocument();
  });

  it('handles empty feeds', () => {
    (useCategoryFeeds as any).mockReturnValue({
      data: [],
      isLoading: false,
      error: null,
    });
    renderComponent();
    expect(screen.queryByText('TechCrunch')).not.toBeInTheDocument();
    expect(screen.queryByText('Failed to load feeds')).not.toBeInTheDocument();
  });

  it('feed items link to correct URL', () => {
    renderComponent();
    const feedLink = screen.getByText('TechCrunch').closest('[data-testid="mock-link"]');
    expect(feedLink).not.toBeNull();
    if (feedLink) {
      expect(feedLink).toHaveAttribute('href', '/?feedId=101');
    }
  });
});
