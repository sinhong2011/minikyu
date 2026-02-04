import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { logger } from '@/lib/logger';
import { type Category, commands } from '@/lib/tauri-bindings';

// Query keys for categories
export const categoryQueryKeys = {
  all: ['miniflux', 'categories'] as const,
  lists: () => [...categoryQueryKeys.all, 'list'] as const,
  list: () => [...categoryQueryKeys.lists()] as const,
};

/**
 * Hook to get all categories
 */
export function useCategories(enabled: boolean = true) {
  return useQuery({
    queryKey: categoryQueryKeys.list(),
    queryFn: async (): Promise<Category[]> => {
      logger.debug('Fetching categories from Miniflux');
      const result = await commands.getCategories();

      if (result.status === 'error') {
        logger.error('Failed to fetch categories', {
          error: result.error,
        });
        toast.error('Failed to load categories', {
          description: result.error,
        });
        throw new Error(result.error);
      }

      logger.info('Categories fetched successfully', {
        count: result.data.length,
      });
      return result.data;
    },
    enabled,
    staleTime: 1000 * 60 * 5, // 5 minutes
    gcTime: 1000 * 60 * 10, // 10 minutes
  });
}
