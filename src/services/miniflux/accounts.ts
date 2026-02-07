import { useQuery } from '@tanstack/react-query';
import { logger } from '@/lib/logger';
import { commands } from '@/lib/tauri-bindings';

export const accountQueryKeys = {
  all: ['miniflux', 'accounts'] as const,
  list: () => [...accountQueryKeys.all, 'list'] as const,
};

export function useAccounts() {
  return useQuery({
    queryKey: accountQueryKeys.list(),
    queryFn: async () => {
      logger.debug('[useAccounts] Fetching accounts from database');
      const result = await commands.getMinifluxAccounts();

      if (result.status === 'error') {
        logger.error('[useAccounts] Failed to fetch accounts', {
          error: result.error,
        });
        throw new Error('Failed to load accounts');
      }

      logger.debug('[useAccounts] Accounts fetched successfully', {
        count: result.data.length,
      });
      return result.data;
    },
    staleTime: 1000 * 60 * 5,
    retry: 3,
    retryDelay: (attempt) => Math.min(attempt * 1000, 5000),
  });
}

export function useActiveAccount() {
  const { data: accounts = [], ...rest } = useAccounts();
  const activeAccount = accounts.find((acc) => acc.is_active);

  return {
    ...rest,
    data: activeAccount,
    accounts,
  };
}
