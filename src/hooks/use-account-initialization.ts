import { listen } from '@tauri-apps/api/event';
import { useEffect } from 'react';
import { logger } from '@/lib/logger';
import { commands } from '@/lib/tauri-bindings';
import { useAccountStore } from '@/store/account-store';

/**
 * Hook to initialize accounts on app startup.
 * Loads saved accounts from the backend and sets the active account.
 * Waits for database-ready event before fetching accounts.
 */
export function useAccountInitialization() {
  useEffect(() => {
    logger.info('[useAccountInitialization] Hook mounted, setting up database-ready listener');

    const initializeAccounts = async () => {
      logger.info('[useAccountInitialization] Starting account initialization');
      try {
        const result = await commands.getMinifluxAccounts();
        logger.info('[useAccountInitialization] getMinifluxAccounts result', {
          status: result.status,
          accountCount: result.status === 'ok' ? result.data.length : 0,
          accounts:
            result.status === 'ok'
              ? result.data.map((acc) => ({
                  id: acc.id,
                  username: acc.username,
                  server_url: acc.server_url,
                  is_active: acc.is_active,
                }))
              : [],
        });

        if (result.status === 'ok') {
          const { setAccounts, setCurrentAccountId } = useAccountStore.getState();
          setAccounts(result.data);
          logger.info('[useAccountInitialization] Accounts set in store', {
            count: result.data.length,
          });

          const activeAccount = result.data.find((acc) => acc.is_active);
          if (activeAccount) {
            setCurrentAccountId(activeAccount.id);
            logger.info('[useAccountInitialization] Active account set', {
              accountId: activeAccount.id,
              username: activeAccount.username,
              server_url: activeAccount.server_url,
            });
          } else {
            logger.warn('[useAccountInitialization] No active account found in results');
            setCurrentAccountId(null);
          }
        } else {
          logger.error('[useAccountInitialization] Failed to load accounts', {
            error: result.error,
          });
        }
      } catch (error) {
        logger.error('[useAccountInitialization] Exception during initialization', { error });
      }
    };

    const unlistenPromise = listen('database-ready', () => {
      logger.info('[useAccountInitialization] Received database-ready event from Rust backend');
      initializeAccounts();
    });

    return () => {
      logger.debug('[useAccountInitialization] Hook unmounting, cleaning up listener');
      unlistenPromise.then((unlisten) => unlisten());
    };
  }, []);
}
