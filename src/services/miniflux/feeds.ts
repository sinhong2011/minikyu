import { i18n } from '@lingui/core';
import { msg } from '@lingui/core/macro';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { logger } from '@/lib/logger';
import { commands, type Feed, type FeedUpdate } from '@/lib/tauri-bindings';
import { useSyncStore } from '@/store/sync-store';
import { counterQueryKeys } from './counters';

const translate = i18n._.bind(i18n);

// Query keys for feeds
export const feedQueryKeys = {
  all: ['miniflux', 'feeds'] as const,
  lists: () => [...feedQueryKeys.all, 'list'] as const,
  list: () => [...feedQueryKeys.lists()] as const,
  category: (categoryId: string) => [...feedQueryKeys.all, 'category', categoryId] as const,
  detail: (id: string) => [...feedQueryKeys.all, 'detail', id] as const,
};

function isNotFoundApiError(errorMessage: string): boolean {
  const normalized = errorMessage.toLowerCase();
  return (
    normalized.includes('404 not found') ||
    normalized.includes('api error: 404') ||
    normalized.includes('status code: 404')
  );
}

async function syncMinifluxCache() {
  const syncResult = await commands.syncMiniflux();
  if (syncResult.status === 'error') {
    logger.warn('Feed mutation succeeded but follow-up sync failed', {
      error: syncResult.error,
    });
  }
}

function hasDefinedFeedUpdateValue(updates: FeedUpdate): boolean {
  return Object.values(updates).some((value) => value !== undefined);
}

export interface CreateFeedInput {
  feedUrl: string;
  categoryId: string | null;
  updates?: FeedUpdate;
}

/**
 * Hook to get all feeds
 */
export function useFeeds(enabled: boolean = true) {
  return useQuery({
    queryKey: feedQueryKeys.list(),
    queryFn: async (): Promise<Feed[]> => {
      logger.debug('Fetching feeds from Miniflux');
      const result = await commands.getFeeds();

      if (result.status === 'error') {
        logger.error('Failed to fetch feeds', {
          error: result.error,
        });
        toast.error(translate(msg`Failed to load feeds`), { description: result.error });
        throw new Error(result.error);
      }

      logger.info('Feeds fetched successfully', {
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
 * Hook to get feeds by category
 */
export function useCategoryFeeds(categoryId: string) {
  return useQuery({
    queryKey: feedQueryKeys.category(categoryId),
    queryFn: async (): Promise<Feed[]> => {
      logger.debug('Fetching feeds for category', { categoryId });
      const result = await commands.getCategoryFeeds(categoryId);

      if (result.status === 'error') {
        logger.error('Failed to fetch category feeds', {
          error: result.error,
          categoryId,
        });
        toast.error(translate(msg`Failed to load feeds`), { description: result.error });
        throw new Error(result.error);
      }

      logger.info('Category feeds fetched successfully', {
        categoryId,
        count: result.data.length,
      });
      return result.data;
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
    gcTime: 1000 * 60 * 10, // 10 minutes
  });
}

/**
 * Hook to create a new feed
 */
export function useCreateFeed() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ feedUrl, categoryId, updates }: CreateFeedInput) => {
      logger.debug('Creating feed', { feedUrl, categoryId, hasUpdates: !!updates });
      const result = await commands.createFeed(feedUrl, categoryId);

      if (result.status === 'error') {
        logger.error('Failed to create feed', {
          error: result.error,
          feedUrl,
        });
        toast.error(translate(msg`Failed to create feed`), { description: result.error });
        throw new Error(result.error);
      }

      if (updates && hasDefinedFeedUpdateValue(updates)) {
        const updateResult = await commands.updateFeed(result.data, updates);
        if (updateResult.status === 'error') {
          logger.warn('Feed created but failed to apply advanced fields', {
            feedId: result.data,
            error: updateResult.error,
          });
          toast.warning(translate(msg`Feed created with partial settings`), {
            description: updateResult.error,
          });
        }
      }

      logger.info('Feed created successfully', { feedId: result.data, hasUpdates: !!updates });
      return result.data;
    },
    onSuccess: async () => {
      await syncMinifluxCache();
      // Invalidate feeds queries
      queryClient.invalidateQueries({ queryKey: ['miniflux'] });
      queryClient.invalidateQueries({ queryKey: counterQueryKeys.all });
      toast.success(translate(msg`Feed created`));
    },
  });
}

/**
 * Hook to update a feed
 */
export function useUpdateFeed() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: FeedUpdate }) => {
      logger.debug('Updating feed', { id, updates });
      const result = await commands.updateFeed(id, updates);

      if (result.status === 'error') {
        logger.error('Failed to update feed', {
          error: result.error,
          id,
        });
        toast.error(translate(msg`Failed to update feed`), { description: result.error });
        throw new Error(result.error);
      }

      logger.info('Feed updated successfully', { id });
      return result.data;
    },
    onSuccess: async (_, { id }) => {
      await syncMinifluxCache();
      // Invalidate feeds queries
      queryClient.invalidateQueries({ queryKey: ['miniflux'] });
      queryClient.invalidateQueries({ queryKey: feedQueryKeys.detail(id) });
      queryClient.invalidateQueries({ queryKey: counterQueryKeys.all });
      toast.success(translate(msg`Feed updated`));
    },
  });
}

/**
 * Hook to delete a feed
 */
export function useDeleteFeed() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      logger.debug('Deleting feed', { id });
      const result = await commands.deleteFeed(id);

      if (result.status === 'error') {
        if (isNotFoundApiError(result.error)) {
          logger.warn('Feed not found during deletion, treating as already deleted', {
            id,
            error: result.error,
          });
          return { id, alreadyDeleted: true as const };
        }

        logger.error('Failed to delete feed', {
          error: result.error,
          id,
        });
        toast.error(translate(msg`Failed to delete feed`), { description: result.error });
        throw new Error(result.error);
      }

      logger.info('Feed deleted successfully', { id });
      return { id, alreadyDeleted: false as const };
    },
    onSuccess: async (result, id) => {
      await syncMinifluxCache();
      // Invalidate feeds queries
      queryClient.invalidateQueries({ queryKey: ['miniflux'] });
      queryClient.invalidateQueries({ queryKey: feedQueryKeys.detail(id) });
      queryClient.invalidateQueries({ queryKey: counterQueryKeys.all });

      if (result.alreadyDeleted) {
        logger.info('Feed was already removed on server; local state refreshed', { id });
      }

      toast.success(translate(msg`Feed deleted`));
    },
  });
}

/**
 * Hook to discover subscriptions from a source URL
 */
export function useSearchSources() {
  return useMutation({
    mutationFn: async (url: string) => {
      logger.debug('Searching sources from URL', { url });
      const result = await commands.discoverSubscriptions(url);

      if (result.status === 'error') {
        logger.error('Failed to discover sources', {
          error: result.error,
          url,
        });
        toast.error(translate(msg`Failed to search sources`), { description: result.error });
        throw new Error(result.error);
      }

      logger.info('Sources discovered successfully', {
        url,
        count: result.data.length,
      });
      return result.data;
    },
  });
}

/**
 * Hook to refresh a feed
 */
export function useRefreshFeed() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      logger.debug('Refreshing feed', { id });
      const result = await commands.refreshFeed(id);

      if (result.status === 'error') {
        logger.error('Failed to refresh feed', {
          error: result.error,
          id,
        });
        toast.error(translate(msg`Failed to refresh feed`), { description: result.error });
        throw new Error(result.error);
      }

      logger.info('Feed refreshed successfully', { id });
    },
    onSuccess: (_, id) => {
      // Invalidate feeds and entries queries
      queryClient.invalidateQueries({ queryKey: feedQueryKeys.lists() });
      queryClient.invalidateQueries({ queryKey: feedQueryKeys.detail(id) });
      queryClient.invalidateQueries({ queryKey: ['miniflux', 'entries'] });
      toast.success(translate(msg`Feed refreshed`));
    },
  });
}

/**
 * Hook to refresh all feeds
 */
export function useRefreshAllFeeds() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      logger.debug('Refreshing all feeds');
      const result = await commands.refreshAllFeeds();

      if (result.status === 'error') {
        logger.error('Failed to refresh all feeds', {
          error: result.error,
        });
        toast.error(translate(msg`Failed to refresh feeds`), { description: result.error });
        throw new Error(result.error);
      }

      logger.info('All feeds refreshed successfully');
    },
    onSuccess: () => {
      // Invalidate all Miniflux queries
      queryClient.invalidateQueries({ queryKey: ['miniflux'] });
      toast.success(translate(msg`All feeds refreshed`));
    },
  });
}

/**
 * Hook to sync Miniflux data (refresh all feeds + manage sync state)
 * This wraps refreshAllFeeds with sync store state management
 */
export function useSyncMiniflux() {
  const queryClient = useQueryClient();
  const startSync = useSyncStore((state) => state.startSync);
  const completeSync = useSyncStore((state) => state.completeSync);
  const failSync = useSyncStore((state) => state.failSync);

  return useMutation({
    mutationFn: async () => {
      logger.debug('Starting Miniflux sync');
      startSync();

      const result = await commands.syncMiniflux();

      if (result.status === 'error') {
        logger.error('Failed to sync Miniflux', {
          error: result.error,
        });
        throw new Error(result.error);
      }

      logger.info('Miniflux sync completed successfully');
    },
    onSuccess: () => {
      completeSync();
      // Invalidate all Miniflux queries
      queryClient.invalidateQueries({ queryKey: ['miniflux'] });
      queryClient.invalidateQueries({ queryKey: counterQueryKeys.all });
    },
    onError: (error: Error) => {
      failSync(error.message);
      toast.error(translate(msg`Sync failed`), { description: error.message });
    },
  });
}
