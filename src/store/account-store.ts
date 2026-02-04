import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import type { MinifluxAccount } from '@/lib/tauri-bindings';
import { logger } from './logger-middleware';

interface AccountState {
  accounts: MinifluxAccount[];
  currentAccountId: string | null;
  isLoading: boolean;
  error: string | null;

  setAccounts: (accounts: MinifluxAccount[]) => void;
  setCurrentAccountId: (id: string | null) => void;
  addAccount: (account: MinifluxAccount) => void;
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

        setAccounts: (accounts: MinifluxAccount[]) => set({ accounts }, undefined, 'setAccounts'),

        setCurrentAccountId: (id: string | null) =>
          set({ currentAccountId: id }, undefined, 'setCurrentAccountId'),

        addAccount: (account: MinifluxAccount) =>
          set(
            (state: AccountState) => ({ accounts: [account, ...state.accounts] }),
            undefined,
            'addAccount'
          ),

        removeAccount: (id: string) =>
          set(
            (state: AccountState) => ({
              accounts: state.accounts.filter((acc: MinifluxAccount) => acc.id !== id),
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
