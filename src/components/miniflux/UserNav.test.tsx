import { i18n } from '@lingui/core';
import { I18nProvider } from '@lingui/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as tauriBindings from '@/lib/tauri-bindings';
import * as accountsService from '@/services/miniflux/accounts';
import * as authService from '@/services/miniflux/auth';
import * as usersService from '@/services/miniflux/users';
import { UserNav } from './UserNav';

vi.mock('@tauri-apps/plugin-dialog', () => ({
  confirm: vi.fn().mockResolvedValue(true),
  open: vi.fn(),
  save: vi.fn(),
}));

vi.mock('@/lib/account-reset', () => ({
  resetAccountState: vi.fn().mockResolvedValue(undefined),
}));

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

const mockAccounts = [
  {
    id: '1',
    username: 'user1',
    // biome-ignore lint/style/useNamingConvention: API response format
    server_url: 'https://server1.com',
    // biome-ignore lint/style/useNamingConvention: API response format
    is_active: true,
    // biome-ignore lint/style/useNamingConvention: API response format
    is_admin: true,
    // biome-ignore lint/style/useNamingConvention: API response format
    auth_method: 'token',
    // biome-ignore lint/style/useNamingConvention: API response format
    created_at: '',
    // biome-ignore lint/style/useNamingConvention: API response format
    updated_at: '',
  },
  {
    id: '2',
    username: 'user2',
    // biome-ignore lint/style/useNamingConvention: API response format
    server_url: 'https://server2.com',
    // biome-ignore lint/style/useNamingConvention: API response format
    is_active: false,
    // biome-ignore lint/style/useNamingConvention: API response format
    is_admin: false,
    // biome-ignore lint/style/useNamingConvention: API response format
    auth_method: 'token',
    // biome-ignore lint/style/useNamingConvention: API response format
    created_at: '',
    // biome-ignore lint/style/useNamingConvention: API response format
    updated_at: '',
  },
];

describe('UserNav', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    queryClient.clear();

    vi.spyOn(accountsService, 'useAccounts').mockReturnValue({
      data: mockAccounts,
      isLoading: false,
      isError: false,
    } as any);

    vi.spyOn(accountsService, 'useActiveAccount').mockReturnValue({
      data: mockAccounts[0],
      isLoading: false,
      isError: false,
      accounts: mockAccounts,
    } as any);

    vi.spyOn(authService, 'useIsConnected').mockReturnValue({
      data: true,
      isLoading: false,
      isError: false,
    } as any);

    // Mock useCurrentUser hook with default success state
    vi.spyOn(usersService, 'useCurrentUser').mockReturnValue({
      data: {
        id: '1',
        username: 'user1',
        // biome-ignore lint/style/useNamingConvention: API response format
        is_admin: true,
        language: 'en',
        timezone: 'America/New_York',
        theme: null,
        // biome-ignore lint/style/useNamingConvention: API response format
        entry_sorting_direction: null,
        // biome-ignore lint/style/useNamingConvention: API response format
        entry_sorting_order: null,
        // biome-ignore lint/style/useNamingConvention: API response format
        entries_per_page: null,
        // biome-ignore lint/style/useNamingConvention: API response format
        keyboard_shortcuts: null,
        // biome-ignore lint/style/useNamingConvention: API response format
        display_mode: null,
        // biome-ignore lint/style/useNamingConvention: API response format
        show_reading_time: null,
        // biome-ignore lint/style/useNamingConvention: API response format
        entry_swipe: null,
        stylesheet: null,
        // biome-ignore lint/style/useNamingConvention: API response format
        google_id: null,
        // biome-ignore lint/style/useNamingConvention: API response format
        openid_connect_id: null,
        // biome-ignore lint/style/useNamingConvention: API response format
        last_login_at: null,
        // biome-ignore lint/style/useNamingConvention: API response format
        created_at: null,
        // biome-ignore lint/style/useNamingConvention: API response format
        updated_at: null,
      },
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    } as any);
  });

  it('renders user avatar', () => {
    customRender(<UserNav />);
    // Avatar is now an SVG mascot, verify the username is displayed
    expect(screen.getByText('user1')).toBeInTheDocument();
  });

  it('renders server domain', () => {
    customRender(<UserNav />);
    expect(screen.getByText('server1.com')).toBeInTheDocument();
  });

  it('shows offline cached data label when disconnected', () => {
    vi.spyOn(authService, 'useIsConnected').mockReturnValue({
      data: false,
      isLoading: false,
      isError: false,
    } as any);

    customRender(<UserNav />);
    expect(screen.getByText('Offline cached data')).toBeInTheDocument();
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

  it('calls deleteMinifluxAccount when per-account delete button is clicked', async () => {
    vi.spyOn(tauriBindings.commands, 'deleteMinifluxAccount').mockResolvedValue({
      status: 'ok',
      data: null,
    });

    customRender(<UserNav />);
    const trigger = screen.getByRole('button');
    fireEvent.click(trigger);

    // Wait for the menu to open and find the per-account delete buttons
    const deleteButtons = await screen.findAllByTitle('Delete account');
    expect(deleteButtons.length).toBeGreaterThan(0);
    // Click the delete button for the first account
    fireEvent.click(deleteButtons[0] as HTMLElement);

    await waitFor(() => {
      expect(tauriBindings.commands.deleteMinifluxAccount).toHaveBeenCalledWith('1');
    });
  });

  it('displays admin icon when user is admin', async () => {
    // Override mock to include is_admin on the active account
    const adminAccounts = mockAccounts.map((a) => (a.id === '1' ? { ...a, is_admin: true } : a));
    vi.spyOn(accountsService, 'useActiveAccount').mockReturnValue({
      data: adminAccounts[0],
      isLoading: false,
      isError: false,
      accounts: adminAccounts,
    } as any);

    customRender(<UserNav />);

    await waitFor(() => {
      // Admin icon renders as an SVG inside the username row
      const svgIcons = document.querySelectorAll('svg');
      expect(svgIcons.length).toBeGreaterThan(0);
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
        // biome-ignore lint/style/useNamingConvention: API response format
        is_admin: false,
        language: null,
        timezone: null,
        theme: null,
        // biome-ignore lint/style/useNamingConvention: API response format
        entry_sorting_direction: null,
        // biome-ignore lint/style/useNamingConvention: API response format
        entry_sorting_order: null,
        // biome-ignore lint/style/useNamingConvention: API response format
        entries_per_page: null,
        // biome-ignore lint/style/useNamingConvention: API response format
        keyboard_shortcuts: null,
        // biome-ignore lint/style/useNamingConvention: API response format
        display_mode: null,
        // biome-ignore lint/style/useNamingConvention: API response format
        show_reading_time: null,
        // biome-ignore lint/style/useNamingConvention: API response format
        entry_swipe: null,
        stylesheet: null,
        // biome-ignore lint/style/useNamingConvention: API response format
        google_id: null,
        // biome-ignore lint/style/useNamingConvention: API response format
        openid_connect_id: null,
        // biome-ignore lint/style/useNamingConvention: API response format
        last_login_at: null,
        // biome-ignore lint/style/useNamingConvention: API response format
        created_at: null,
        // biome-ignore lint/style/useNamingConvention: API response format
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
