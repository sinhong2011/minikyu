import { useQuery } from '@tanstack/react-query';
import { logger } from '@/lib/logger';
import { commands } from '@/lib/tauri-bindings';

// Query keys for user data
export const userQueryKeys = {
  all: ['miniflux', 'user'] as const,
  current: () => [...userQueryKeys.all, 'current'] as const,
};

/**
 * Hook to get current user data
 * Use this in any component that needs user information
 */
export function useCurrentUser() {
  return useQuery({
    queryKey: userQueryKeys.current(),
    queryFn: async () => {
      logger.info('[useCurrentUser] Fetching current user data from backend');
      const result = await commands.getCurrentUser();

      if (result.status === 'error') {
        logger.error('[useCurrentUser] Failed to fetch current user', {
          error: result.error,
        });
        throw new Error(result.error);
      }

      logger.info('[useCurrentUser] Current user data fetched successfully', {
        id: result.data.id,
        username: result.data.username,
        is_admin: result.data.is_admin,
        language: result.data.language,
        timezone: result.data.timezone,
      });
      return result.data;
    },
    staleTime: 1000 * 60 * 30,
    gcTime: 1000 * 60 * 60,
  });
}
