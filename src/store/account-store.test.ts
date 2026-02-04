import { beforeEach, describe, expect, it } from 'vitest';
import type { MinifluxAccount } from '@/lib/tauri-bindings';
import { useAccountStore } from './account-store';

describe('account-store', () => {
  beforeEach(() => {
    useAccountStore.setState({
      accounts: [],
      currentAccountId: null,
      isLoading: false,
      error: null,
    });
  });

  it('should initialize with empty accounts', () => {
    const accounts = useAccountStore.getState().accounts;
    expect(accounts).toEqual([]);
  });

  it('should set accounts', () => {
    const setAccounts = useAccountStore.getState().setAccounts;
    const testAccounts: MinifluxAccount[] = [
      {
        id: '1',
        username: 'user1',
        server_url: 'https://test.com',
        auth_method: 'token',
        is_active: true,
        created_at: '2025-01-01',
        updated_at: '2025-01-01',
      },
      {
        id: '2',
        username: 'user2',
        server_url: 'https://test.com',
        auth_method: 'password',
        is_active: false,
        created_at: '2025-01-02',
        updated_at: '2025-01-02',
      },
    ];

    setAccounts(testAccounts);
    const accounts = useAccountStore.getState().accounts;
    expect(accounts).toEqual(testAccounts);
    expect(accounts.length).toBe(2);
  });

  it('should set current account ID', () => {
    const setCurrentAccountId = useAccountStore.getState().setCurrentAccountId;
    setCurrentAccountId('1');
    const currentAccountId = useAccountStore.getState().currentAccountId;
    expect(currentAccountId).toBe('1');
  });

  it('should add account', () => {
    const addAccount = useAccountStore.getState().addAccount;
    const testAccount: MinifluxAccount = {
      id: '3',
      username: 'user3',
      server_url: 'https://test.com',
      auth_method: 'token',
      is_active: false,
      created_at: '2025-01-03',
      updated_at: '2025-01-03',
    };

    addAccount(testAccount);
    const accounts = useAccountStore.getState().accounts;
    expect(accounts.length).toBe(1);
    expect(accounts[0]).toEqual(testAccount);
  });

  it('should remove account by ID', () => {
    const setAccounts = useAccountStore.getState().setAccounts;
    const testAccounts: MinifluxAccount[] = [
      {
        id: '1',
        username: 'user1',
        server_url: 'https://test.com',
        auth_method: 'token',
        is_active: true,
        created_at: '2025-01-01',
        updated_at: '2025-01-01',
      },
      {
        id: '2',
        username: 'user2',
        server_url: 'https://test.com',
        auth_method: 'password',
        is_active: false,
        created_at: '2025-01-02',
        updated_at: '2025-01-02',
      },
    ];
    setAccounts(testAccounts);

    const removeAccount = useAccountStore.getState().removeAccount;
    removeAccount('1');

    const accounts = useAccountStore.getState().accounts;
    expect(accounts.length).toBe(1);
    expect(accounts[0]).toBeDefined();
    expect(accounts[0]?.id).toBe('2');
  });

  it('should clear accounts', () => {
    const setAccounts = useAccountStore.getState().setAccounts;
    const clearAccounts = useAccountStore.getState().clearAccounts;

    setAccounts([
      {
        id: '1',
        username: 'user1',
        server_url: 'https://test.com',
        auth_method: 'token',
        is_active: true,
        created_at: '2025-01-01',
        updated_at: '2025-01-01',
      },
    ]);
    clearAccounts();
    const accounts = useAccountStore.getState().accounts;
    expect(accounts).toEqual([]);
    const currentAccountId = useAccountStore.getState().currentAccountId;
    expect(currentAccountId).toBe(null);
  });

  it('should set loading state', () => {
    const setLoading = useAccountStore.getState().setLoading;
    setLoading(true);
    const isLoading = useAccountStore.getState().isLoading;
    expect(isLoading).toBe(true);

    setLoading(false);
    const isLoadingAfter = useAccountStore.getState().isLoading;
    expect(isLoadingAfter).toBe(false);
  });

  it('should set error state', () => {
    const setError = useAccountStore.getState().setError;
    setError('Test error');
    const error = useAccountStore.getState().error;
    expect(error).toBe('Test error');

    setError(null);
    const errorAfter = useAccountStore.getState().error;
    expect(errorAfter).toBe(null);
  });
});
