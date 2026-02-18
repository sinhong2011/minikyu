import { useQuery } from '@tanstack/react-query';
import { logger } from '@/lib/logger';
import { commands } from '@/lib/tauri-bindings';
import { useIsConnected } from '@/services/miniflux/auth';

// Query keys for integration data
export const integrationsQueryKeys = {
  all: ['miniflux', 'integrations'] as const,
  current: () => [...integrationsQueryKeys.all, 'current'] as const,
};

/**
 * Hook to get user integration settings
 * Use this in any component that needs integration status (e.g., Integrations pane)
 */
export function useIntegrations() {
  const { data: isConnected } = useIsConnected();

  return useQuery({
    queryKey: integrationsQueryKeys.current(),
    queryFn: async () => {
      logger.info('[useIntegrations] Fetching integration settings from backend');
      const result = await commands.getIntegrations();

      if (result.status === 'error') {
        logger.error('[useIntegrations] Failed to fetch integrations', {
          error: result.error,
        });
        throw new Error(result.error);
      }

      // Count enabled integrations for logging
      const enabledCount = Object.entries(result.data).filter(
        ([key, value]) => key.endsWith('_enabled') && value === true
      ).length;

      logger.info('[useIntegrations] Integration settings fetched successfully', {
        enabledCount,
      });
      return result.data;
    },
    enabled: isConnected ?? false,
    staleTime: 1000 * 60 * 5, // 5 minutes - integration settings don't change often
    gcTime: 1000 * 60 * 30, // 30 minutes
    retry: 1,
  });
}
