import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { showToast } from '@/components/ui/sonner';
import { logger } from '@/lib/logger';
import { type AuthConfig, commands } from '@/lib/tauri-bindings';

// Query keys for authentication
export const authQueryKeys = {
  all: ['miniflux', 'auth'] as const,
  connection: () => [...authQueryKeys.all, 'connection'] as const,
};

/**
 * Hook to check if connected to Miniflux server
 */
export function useIsConnected() {
  return useQuery({
    queryKey: authQueryKeys.connection(),
    queryFn: async (): Promise<boolean> => {
      logger.debug('Checking Miniflux connection status');
      const result = await commands.minifluxIsConnected();

      if (result.status === 'error') {
        logger.error('Failed to check connection status', {
          error: result.error,
        });
        return false;
      }

      logger.debug('Connection status checked', { connected: result.data });
      return result.data;
    },
    staleTime: 1000 * 30, // 30 seconds
    gcTime: 1000 * 60 * 5, // 5 minutes
  });
}

/**
 * Hook to connect to Miniflux server
 */
export function useConnect() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: authQueryKeys.connection(),
    mutationFn: async (config: AuthConfig) => {
      logger.debug('Connecting to Miniflux server', {
        serverUrl: config.server_url,
      });
      const result = await commands.minifluxConnect(config);

      if (result.status === 'error') {
        logger.error('Failed to connect to Miniflux', {
          error: result.error,
          serverUrl: config.server_url,
        });
        showToast.error('Connection failed', result.error);
        throw new Error(result.error);
      }

      logger.info('Successfully connected to Miniflux', {
        serverUrl: config.server_url,
      });
      return result.data;
    },
    onSuccess: () => {
      // Invalidate connection status query
      queryClient.invalidateQueries({ queryKey: authQueryKeys.connection() });
      showToast.success('Connected to Miniflux');
    },
  });
}

/**
 * Hook to disconnect from Miniflux server
 */
export function useDisconnect() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationKey: [...authQueryKeys.all, 'disconnect'] as const,
    mutationFn: async () => {
      logger.debug('Disconnecting from Miniflux server');
      const result = await commands.minifluxDisconnect();

      if (result.status === 'error') {
        logger.error('Failed to disconnect from Miniflux', {
          error: result.error,
        });
        showToast.error('Disconnect failed', result.error);
        throw new Error(result.error);
      }

      logger.info('Successfully disconnected from Miniflux');
    },
    onSuccess: () => {
      // Invalidate connection status query
      queryClient.invalidateQueries({ queryKey: authQueryKeys.connection() });
      // Clear all Miniflux-related queries
      queryClient.invalidateQueries({ queryKey: ['miniflux'] });
      showToast.success('Disconnected from Miniflux');
    },
  });
}

export function useAutoReconnect() {
  const queryClient = useQueryClient();
  const [autoReconnectError, setAutoReconnectError] = useState<string | null>(null);

  const handleAutoReconnect = async () => {
    setAutoReconnectError(null);
    try {
      const result = await commands.autoReconnectMiniflux();
      if (result.status === 'error') {
        logger.error('Auto-reconnect failed', { error: result.error });
        setAutoReconnectError(String(result.error.type || 'Unknown error'));
      } else {
        logger.info('Auto-reconnect succeeded');
        // Invalidate connection status query to trigger immediate UI update
        queryClient.invalidateQueries({ queryKey: authQueryKeys.connection() });
      }
    } catch (error) {
      logger.error('Auto-reconnect exception', { error });
      setAutoReconnectError(String(error));
    }
  };

  return { autoReconnectError, handleAutoReconnect, setAutoReconnectError };
}
