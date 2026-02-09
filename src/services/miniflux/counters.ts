import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';
import { toast } from 'sonner';
import { logger } from '@/lib/logger';
import { commands } from '@/lib/tauri-bindings';

export const counterQueryKeys = {
  all: ['unread-counters'] as const,
} as const;

export function useUnreadCounts() {
  return useQuery({
    queryKey: counterQueryKeys.all,
    queryFn: async () => {
      logger.debug('Fetching unread counts');
      const result = await commands.getUnreadCounts();

      if (result.status === 'error') {
        const errorMessage = `Failed to fetch unread counts: ${result.error}`;
        logger.error(errorMessage);
        toast.error(errorMessage);
        throw new Error(result.error);
      }

      return result.data;
    },
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });
}

export function useCategoryUnreadCount(categoryId: number) {
  const { data } = useUnreadCounts();

  return useMemo(() => {
    if (!data) return 0;
    const category = data.by_category?.find((c) => Number(c.category_id) === categoryId);
    return category ? Number(category.unread_count) : 0;
  }, [data, categoryId]);
}

export function useFeedUnreadCount(feedId: number) {
  const { data } = useUnreadCounts();

  return useMemo(() => {
    if (!data) return 0;
    const feed = data.by_feed?.find((f) => Number(f.feed_id) === feedId);
    return feed ? Number(feed.unread_count) : 0;
  }, [data, feedId]);
}

export function useInvalidateCounters() {
  const queryClient = useQueryClient();

  return () => {
    queryClient.invalidateQueries({ queryKey: counterQueryKeys.all });
  };
}
