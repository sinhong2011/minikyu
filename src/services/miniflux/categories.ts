import { i18n } from '@lingui/core';
import { msg } from '@lingui/core/macro';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { logger } from '@/lib/logger';
import { type Category, commands } from '@/lib/tauri-bindings';
import { counterQueryKeys } from './counters';

const translate = i18n._.bind(i18n);

// Query keys for categories
export const categoryQueryKeys = {
  all: ['miniflux', 'categories'] as const,
  lists: () => [...categoryQueryKeys.all, 'list'] as const,
  list: () => [...categoryQueryKeys.lists()] as const,
};

async function syncMinifluxCache() {
  const syncResult = await commands.syncMiniflux();
  if (syncResult.status === 'error') {
    logger.warn('Category mutation succeeded but follow-up sync failed', {
      error: syncResult.error,
    });
  }
}

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
        toast.error(translate(msg`Failed to load categories`), {
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

/**
 * Hook to create a new category
 */
export function useCreateCategory() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (title: string): Promise<Category> => {
      logger.debug('Creating category', { title });
      const result = await commands.createCategory(title);

      if (result.status === 'error') {
        logger.error('Failed to create category', {
          error: result.error,
          title,
        });
        toast.error(translate(msg`Failed to create category`), { description: result.error });
        throw new Error(result.error);
      }

      logger.info('Category created successfully', { id: result.data.id });
      return result.data;
    },
    onSuccess: async () => {
      await syncMinifluxCache();
      queryClient.invalidateQueries({ queryKey: ['miniflux'] });
      queryClient.invalidateQueries({ queryKey: counterQueryKeys.all });
      toast.success(translate(msg`Category created`));
    },
  });
}

/**
 * Hook to update a category
 */
export function useUpdateCategory() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, title }: { id: string; title: string }): Promise<Category> => {
      logger.debug('Updating category', { id, title });
      const result = await commands.updateCategory(id, title);

      if (result.status === 'error') {
        logger.error('Failed to update category', {
          error: result.error,
          id,
        });
        toast.error(translate(msg`Failed to update category`), { description: result.error });
        throw new Error(result.error);
      }

      logger.info('Category updated successfully', { id });
      return result.data;
    },
    onSuccess: async () => {
      await syncMinifluxCache();
      queryClient.invalidateQueries({ queryKey: ['miniflux'] });
      queryClient.invalidateQueries({ queryKey: counterQueryKeys.all });
      toast.success(translate(msg`Category updated`));
    },
  });
}

/**
 * Hook to delete a category
 */
export function useDeleteCategory() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      logger.debug('Deleting category', { id });
      const result = await commands.deleteCategory(id);

      if (result.status === 'error') {
        logger.error('Failed to delete category', {
          error: result.error,
          id,
        });
        toast.error(translate(msg`Failed to delete category`), { description: result.error });
        throw new Error(result.error);
      }

      logger.info('Category deleted successfully', { id });
    },
    onSuccess: async () => {
      await syncMinifluxCache();
      queryClient.invalidateQueries({ queryKey: ['miniflux'] });
      queryClient.invalidateQueries({ queryKey: counterQueryKeys.all });
      toast.success(translate(msg`Category deleted`));
    },
  });
}
