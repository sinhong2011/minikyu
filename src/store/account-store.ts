import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import type { MinifluxConnection } from '@/lib/tauri-bindings';
import { logger } from './logger-middleware';

interface AccountState {
  accounts: MinifluxConnection[];
  currentAccountId: string | null;
  isLoading: boolean;
  error: string | null;

  setAccounts: (accounts: MinifluxConnection[]) => void;
  setCurrentAccountId: (id: string | null) => void;
  addAccount: (account: MinifluxConnection) => void;
  removeAccount: (id: string) => void;
  clearAccounts: () => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
}

export const useAccountStore = create<AccountState>()(
  logger(
    devtools(
      (set) => ({
        accounts: [],
        currentAccountId: null,
        isLoading: false,
        error: null,

        setAccounts: (accounts: MinifluxConnection[]) =>
          set({ accounts }, undefined, 'setAccounts'),

        setCurrentAccountId: (id: string | null) =>
          set({ currentAccountId: id }, undefined, 'setCurrentAccountId'),

        addAccount: (account: MinifluxConnection) =>
          set(
            (state: AccountState) => ({ accounts: [account, ...state.accounts] }),
            undefined,
            'addAccount'
          ),

        removeAccount: (id: string) =>
          set(
            (state: AccountState) => ({
              accounts: state.accounts.filter((acc: MinifluxConnection) => acc.id !== id),
            }),
            undefined,
            'removeAccount'
          ),

        clearAccounts: () =>
          set({ accounts: [], currentAccountId: null }, undefined, 'clearAccounts'),

        setLoading: (loading: boolean) => set({ isLoading: loading }, undefined, 'setLoading'),

        setError: (error: string | null) => set({ error }, undefined, 'setError'),
      }),
      {
        name: 'account-store',
      }
    ),
    'account-store'
  )
);
