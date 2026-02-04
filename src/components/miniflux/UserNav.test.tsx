import { i18n } from '@lingui/core';
import { I18nProvider } from '@lingui/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as tauriBindings from '@/lib/tauri-bindings';
import * as usersService from '@/services/miniflux/users';
import { UserNav } from './UserNav';

// Setup i18n
i18n.load('en', {});
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

const customRender = (ui: React.ReactElement) => render(ui, { wrapper: TestWrapper });

// Mock store
const mockAccounts = [
  {
    id: '1',
    username: 'user1',
    server_url: 'https://server1.com',
    is_active: true,
    auth_method: 'token',
    created_at: '',
    updated_at: '',
  },
  {
    id: '2',
    username: 'user2',
    server_url: 'https://server2.com',
    is_active: false,
    auth_method: 'token',
    created_at: '',
    updated_at: '',
  },
];

vi.mock('@/store/account-store', () => ({
  useAccountStore: (selector: any) => {
    const state = {
      accounts: mockAccounts,
      currentAccountId: '1',
      setAccounts: vi.fn(),
      setCurrentAccountId: vi.fn(),
      isLoading: false,
    };
    return selector(state);
  },
}));

vi.mock('../../../store/account-store', () => ({
  useAccountStore: (selector: any) => {
    const state = {
      accounts: mockAccounts,
      currentAccountId: '1',
      setAccounts: vi.fn(),
      setCurrentAccountId: vi.fn(),
      isLoading: false,
    };
    return selector(state);
  },
}));

vi.mock('/Users/niskan516/Sync/Workspace/dev/desktop/minikyu/src/store/account-store', () => ({
  useAccountStore: (selector: any) => {
    const state = {
      accounts: mockAccounts,
      currentAccountId: '1',
      setAccounts: vi.fn(),
      setCurrentAccountId: vi.fn(),
      isLoading: false,
    };
    return selector(state);
  },
}));

describe('UserNav', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    queryClient.clear();

    // Mock useCurrentUser hook with default success state
    vi.spyOn(usersService, 'useCurrentUser').mockReturnValue({
      data: {
        id: '1',
        username: 'user1',
        is_admin: true,
        language: 'en',
        timezone: 'America/New_York',
        theme: null,
        entry_sorting_direction: null,
        entry_sorting_order: null,
        entries_per_page: null,
        keyboard_shortcuts: null,
        display_mode: null,
        show_reading_time: null,
        entry_swipe: null,
        stylesheet: null,
        google_id: null,
        openid_connect_id: null,
        last_login_at: null,
        created_at: null,
        updated_at: null,
      },
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    } as any);
  });

  it('renders user avatar with initials', () => {
    customRender(<UserNav />);
    // user1 -> US
    expect(screen.getByText('US')).toBeInTheDocument();
  });

  it('renders server domain', () => {
    customRender(<UserNav />);
    expect(screen.getByText('server1.com')).toBeInTheDocument();
  });

  it('opens menu on click', async () => {
    customRender(<UserNav />);
    const trigger = screen.getByRole('button');
    fireEvent.click(trigger);

    await waitFor(() => {
      expect(screen.getByText('user2')).toBeInTheDocument();
      expect(screen.getByText('server2.com')).toBeInTheDocument();
    });
  });

  it('calls switchMinifluxAccount when account is selected', async () => {
    // Mock successful switch
    vi.spyOn(tauriBindings.commands, 'switchMinifluxAccount').mockResolvedValue({
      status: 'ok',
      data: null,
    });
    vi.spyOn(tauriBindings.commands, 'getMinifluxAccounts').mockResolvedValue({
      status: 'ok',
      data: mockAccounts,
    });

    customRender(<UserNav />);
    const trigger = screen.getByRole('button');
    fireEvent.click(trigger);

    const account2 = await screen.findByText('user2');
    fireEvent.click(account2);

    expect(tauriBindings.commands.switchMinifluxAccount).toHaveBeenCalledWith('2');
  });

  it('calls minifluxDisconnect when logout is clicked', async () => {
    vi.spyOn(tauriBindings.commands, 'minifluxDisconnect').mockResolvedValue({
      status: 'ok',
      data: null,
    });

    customRender(<UserNav />);
    const trigger = screen.getByRole('button');
    fireEvent.click(trigger);

    const logout = await screen.findByText('Log out');
    fireEvent.click(logout);

    expect(tauriBindings.commands.minifluxDisconnect).toHaveBeenCalled();
  });

  it('displays admin badge when user is admin', async () => {
    customRender(<UserNav />);

    await waitFor(() => {
      expect(screen.getByText('Admin')).toBeInTheDocument();
    });
  });

  it('displays user profile information in menu', async () => {
    customRender(<UserNav />);
    const trigger = screen.getByRole('button');
    fireEvent.click(trigger);

    await waitFor(() => {
      expect(screen.getByText('User Profile')).toBeInTheDocument();
      expect(screen.getByText('Role')).toBeInTheDocument();
      expect(screen.getByText('Administrator')).toBeInTheDocument();
      expect(screen.getByText('Language')).toBeInTheDocument();
      expect(screen.getByText('Timezone')).toBeInTheDocument();
      expect(screen.getByText('America/New_York')).toBeInTheDocument();
    });
  });

  it('does not show admin badge for non-admin users', async () => {
    vi.spyOn(usersService, 'useCurrentUser').mockReturnValue({
      data: {
        id: '1',
        username: 'user1',
        is_admin: false,
        language: null,
        timezone: null,
        theme: null,
        entry_sorting_direction: null,
        entry_sorting_order: null,
        entries_per_page: null,
        keyboard_shortcuts: null,
        display_mode: null,
        show_reading_time: null,
        entry_swipe: null,
        stylesheet: null,
        google_id: null,
        openid_connect_id: null,
        last_login_at: null,
        created_at: null,
        updated_at: null,
      },
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    } as any);

    customRender(<UserNav />);

    await waitFor(() => {
      expect(screen.queryByText('Admin')).not.toBeInTheDocument();
    });
  });

  it('hides user profile section when data is loading', async () => {
    vi.spyOn(usersService, 'useCurrentUser').mockReturnValue({
      data: undefined,
      isLoading: true,
      isError: false,
      error: null,
      refetch: vi.fn(),
    } as any);

    customRender(<UserNav />);
    const trigger = screen.getByRole('button');
    fireEvent.click(trigger);

    await waitFor(() => {
      expect(screen.queryByText('User Profile')).not.toBeInTheDocument();
      expect(screen.getByText('Accounts')).toBeInTheDocument();
    });
  });

  it('hides user profile section when data fetch fails', async () => {
    vi.spyOn(usersService, 'useCurrentUser').mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      error: new Error('Failed to fetch user'),
      refetch: vi.fn(),
    } as any);

    customRender(<UserNav />);
    const trigger = screen.getByRole('button');
    fireEvent.click(trigger);

    await waitFor(() => {
      expect(screen.queryByText('User Profile')).not.toBeInTheDocument();
      expect(screen.getByText('Accounts')).toBeInTheDocument();
    });
  });
});
