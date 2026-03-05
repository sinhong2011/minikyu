import { i18n } from '@lingui/core';
import { msg } from '@lingui/core/macro';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { logger } from '@/lib/logger';
import { commands } from '@/lib/tauri-bindings';
import { useIsConnected } from '@/services/miniflux/auth';

const translate = i18n._.bind(i18n);

export const apiKeyQueryKeys = {
  all: ['miniflux', 'api-keys'] as const,
  list: () => [...apiKeyQueryKeys.all, 'list'] as const,
};

/**
 * Hook to list all API keys for the current user.
 */
export function useApiKeys(enabled: boolean = true) {
  const { data: isConnected } = useIsConnected();

  return useQuery({
    queryKey: apiKeyQueryKeys.list(),
    queryFn: async () => {
      logger.info('[useApiKeys] Fetching API keys');
      const result = await commands.getApiKeys();

      if (result.status === 'error') {
        logger.error('[useApiKeys] Failed to fetch API keys', { error: result.error });
        throw new Error(result.error);
      }

      return result.data;
    },
    enabled: enabled && (isConnected ?? false),
    staleTime: 1000 * 60 * 5,
    gcTime: 1000 * 60 * 10,
  });
}

/**
 * Hook to create a new API key.
 */
export function useCreateApiKey() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (description: string) => {
      logger.info('[useCreateApiKey] Creating API key', { description });
      const result = await commands.createApiKey({ description });

      if (result.status === 'error') {
        logger.error('[useCreateApiKey] Failed to create API key', { error: result.error });
        toast.error(translate(msg`Failed to create API key`), { description: result.error });
        throw new Error(result.error);
      }

      return result.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: apiKeyQueryKeys.all });
    },
  });
}

/**
 * Hook to delete an API key.
 */
export function useDeleteApiKey() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      logger.info('[useDeleteApiKey] Deleting API key', { id });
      const result = await commands.deleteApiKey(id);

      if (result.status === 'error') {
        logger.error('[useDeleteApiKey] Failed to delete API key', { error: result.error, id });
        toast.error(translate(msg`Failed to delete API key`), { description: result.error });
        throw new Error(result.error);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: apiKeyQueryKeys.all });
      toast.success(translate(msg`API key deleted`));
    },
  });
}
