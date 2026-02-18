import { useQuery } from '@tanstack/react-query';
import { logger } from '@/lib/logger';
import { commands } from '@/lib/tauri-bindings';
import { useIsConnected } from '@/services/miniflux/auth';

// Query keys for version data
export const versionQueryKeys = {
  all: ['miniflux', 'version'] as const,
  current: () => [...versionQueryKeys.all, 'current'] as const,
};

/**
 * Hook to get Miniflux version information
 * Use this in any component that needs version info (e.g., About pane)
 */
export function useMinifluxVersion() {
  const { data: isConnected } = useIsConnected();

  return useQuery({
    queryKey: versionQueryKeys.current(),
    queryFn: async () => {
      logger.info('[useMinifluxVersion] Fetching Miniflux version from backend');
      const result = await commands.getMinifluxVersion();

      if (result.status === 'error') {
        logger.error('[useMinifluxVersion] Failed to fetch version', {
          error: result.error,
        });
        throw new Error(result.error);
      }

      logger.info('[useMinifluxVersion] Version fetched successfully', {
        version: result.data.version,
        commit: result.data.commit,
        buildDate: result.data.build_date,
      });
      return result.data;
    },
    enabled: isConnected ?? false,
    staleTime: 1000 * 60 * 60, // 1 hour - version doesn't change often
    gcTime: 1000 * 60 * 60 * 24, // 24 hours
    retry: 1,
  });
}
