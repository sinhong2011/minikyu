import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { logger } from '@/lib/logger';
import {
  commands,
  type Entry,
  type EntryFilters,
  type EntryResponse,
  type EntryUpdate,
} from '@/lib/tauri-bindings';
import { counterQueryKeys } from './counters';

// Query keys for entries
export const entryQueryKeys = {
  all: ['miniflux', 'entries'] as const,
  lists: () => [...entryQueryKeys.all, 'list'] as const,
  list: (filters: EntryFilters) => [...entryQueryKeys.lists(), filters] as const,
  detail: (id: string) => [...entryQueryKeys.all, 'detail', id] as const,
};

const ENTRIES_PAGE_SIZE = 100;

export function getNextEntriesOffset(
  pages: Array<{ total: string; entries?: Array<unknown> | null }>
): number | undefined {
  const lastPageCount = pages[pages.length - 1]?.entries?.length ?? 0;
  if (pages.length > 0 && lastPageCount === 0) {
    return undefined;
  }

  const total = Number(pages[0]?.total ?? '0');

  if (!Number.isFinite(total) || total <= 0) {
    return undefined;
  }

  const loadedCount = pages.reduce((count, page) => count + (page.entries?.length ?? 0), 0);

  if (loadedCount >= total) {
    return undefined;
  }

  return loadedCount;
}

/**
 * Hook to get entries with filters
 */
export function useEntries(filters: EntryFilters = {}) {
  return useInfiniteQuery({
    queryKey: entryQueryKeys.list(filters),
    initialPageParam: 0,
    queryFn: async ({ pageParam }): Promise<EntryResponse> => {
      const paginationFilters: EntryFilters = {
        ...filters,
        limit: String(ENTRIES_PAGE_SIZE),
        offset: String(pageParam),
      };

      logger.debug('Fetching entries from Miniflux', { filters: paginationFilters });
      const result = await commands.getEntries(paginationFilters);

      if (result.status === 'error') {
        // Don't show toast for expected "not connected" state
        const isNotConnected = result.error === 'Not connected to Miniflux server';

        if (isNotConnected) {
          logger.debug('Miniflux not connected (expected on first launch)', {
            error: result.error,
            filters: paginationFilters,
          });
        } else {
          logger.error('Failed to fetch entries', {
            error: result.error,
            filters: paginationFilters,
          });
          toast.error('Failed to load entries', {
            description: result.error,
          });
        }
        throw new Error(result.error);
      }

      logger.info('Entries fetched successfully', {
        count: result.data.entries?.length ?? 0,
        total: result.data.total,
        offset: pageParam,
      });
      return result.data;
    },
    getNextPageParam: (_, allPages) => getNextEntriesOffset(allPages),
    select: (data): EntryResponse => {
      const entries = data.pages.flatMap((page) => page.entries ?? []);
      const total = data.pages[0]?.total ?? '0';

      return {
        total,
        entries,
      };
    },
    staleTime: 1000 * 60 * 2, // 2 minutes
    gcTime: 1000 * 60 * 5, // 5 minutes
  });
}

/**
 * Hook to get a single entry
 */
export function useEntry(id: string) {
  return useQuery({
    queryKey: entryQueryKeys.detail(id),
    queryFn: async (): Promise<Entry> => {
      logger.debug('Fetching entry', { id });
      const result = await commands.getEntry(id);

      if (result.status === 'error') {
        logger.error('Failed to fetch entry', {
          error: result.error,
          id,
        });
        toast.error('Failed to load entry', {
          description: result.error,
        });
        throw new Error(result.error);
      }

      if (!result.data) {
        logger.error('Entry data is null or undefined', { id });
        throw new Error('Entry not found: data is missing');
      }

      logger.info('Entry fetched successfully', { id });
      return result.data;
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
    gcTime: 1000 * 60 * 10, // 10 minutes
  });
}

/**
 * Hook to prefetch an entry on hover
 * This allows preloading entry data before the user clicks
 */
export function usePrefetchEntry() {
  const queryClient = useQueryClient();

  return (id: string) => {
    // Only prefetch if data is not already in cache
    const existingData = queryClient.getQueryData(entryQueryKeys.detail(id));

    if (!existingData) {
      logger.debug('Prefetching entry', { id });
      queryClient.prefetchQuery({
        queryKey: entryQueryKeys.detail(id),
        queryFn: async (): Promise<Entry> => {
          const result = await commands.getEntry(id);

          if (result.status === 'error') {
            logger.debug('Failed to prefetch entry', {
              error: result.error,
              id,
            });
            throw new Error(result.error);
          }

          if (!result.data) {
            logger.debug('Entry data is null or undefined during prefetch', { id });
            throw new Error('Entry not found: data is missing');
          }

          logger.debug('Entry prefetched successfully', { id });
          return result.data;
        },
        staleTime: 1000 * 60 * 5, // 5 minutes
        gcTime: 1000 * 60 * 10, // 10 minutes
      });
    }
  };
}

/**
 * Hook to toggle entry read status
 */
export function useToggleEntryRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string): Promise<string> => {
      logger.debug('Toggling entry read status', { id });
      const result = await commands.toggleEntryRead(id);

      if (result.status === 'error') {
        const isNotConnected = result.error === 'Not connected to Miniflux server';

        if (!isNotConnected) {
          logger.error('Failed to toggle entry read status', {
            error: result.error,
            id,
          });
          toast.error('Failed to update read status', {
            description: result.error,
          });
        }
        throw new Error(result.error);
      }

      logger.info('Entry read status toggled', { id, newStatus: result.data });
      return result.data;
    },
    onSuccess: (newStatus, id) => {
      queryClient.setQueryData(entryQueryKeys.detail(id), (old: Entry | undefined) => {
        if (old) {
          return { ...old, status: newStatus };
        }
        return old;
      });

      queryClient.setQueriesData<{ pages: EntryResponse[] }>(
        { queryKey: entryQueryKeys.lists() },
        (data) => {
          if (!data?.pages) return data;
          return {
            ...data,
            pages: data.pages.map((page) => ({
              ...page,
              entries: page.entries?.map((entry) =>
                entry.id === id ? { ...entry, status: newStatus } : entry
              ),
            })),
          };
        }
      );

      queryClient.invalidateQueries({ queryKey: counterQueryKeys.all });
    },
  });
}

/**
 * Hook to mark entry as read
 * @deprecated Use useToggleEntryRead instead
 */
export function useMarkEntryRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      logger.debug('Marking entry as read', { id });
      const result = await commands.markEntryRead(id);

      if (result.status === 'error') {
        const isNotConnected = result.error === 'Not connected to Miniflux server';

        if (!isNotConnected) {
          logger.error('Failed to mark entry as read', {
            error: result.error,
            id,
          });
          toast.error('Failed to mark as read', {
            description: result.error,
          });
        }
        throw new Error(result.error);
      }

      logger.info('Entry marked as read', { id });
    },
    onSuccess: (_, id) => {
      queryClient.setQueryData(entryQueryKeys.detail(id), (old: Entry | undefined) => {
        if (old) {
          return { ...old, status: 'read' };
        }
        return old;
      });

      queryClient.setQueriesData<{ pages: EntryResponse[] }>(
        { queryKey: entryQueryKeys.lists() },
        (data) => {
          if (!data?.pages) return data;
          return {
            ...data,
            pages: data.pages.map((page) => ({
              ...page,
              entries: page.entries?.map((entry) =>
                entry.id === id ? { ...entry, status: 'read' } : entry
              ),
            })),
          };
        }
      );

      queryClient.invalidateQueries({ queryKey: counterQueryKeys.all });
    },
  });
}

/**
 * Hook to mark multiple entries as read
 */
export function useMarkEntriesRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (ids: string[]) => {
      logger.debug('Marking entries as read', { count: ids.length });
      const result = await commands.markEntriesRead(ids);

      if (result.status === 'error') {
        logger.error('Failed to mark entries as read', {
          error: result.error,
          count: ids.length,
        });
        toast.error('Failed to mark as read', {
          description: result.error,
        });
        throw new Error(result.error);
      }

      logger.info('Entries marked as read', { count: ids.length });
    },
    onSuccess: (_, ids) => {
      ids.forEach((id) => {
        queryClient.setQueryData(entryQueryKeys.detail(id), (old: Entry | undefined) => {
          if (old) {
            return { ...old, status: 'read' };
          }
          return old;
        });
      });

      queryClient.setQueriesData<{ pages: EntryResponse[] }>(
        { queryKey: entryQueryKeys.lists() },
        (data) => {
          if (!data?.pages) return data;
          const idSet = new Set(ids);
          return {
            ...data,
            pages: data.pages.map((page) => ({
              ...page,
              entries: page.entries?.map((entry) =>
                idSet.has(entry.id) ? { ...entry, status: 'read' } : entry
              ),
            })),
          };
        }
      );

      queryClient.invalidateQueries({ queryKey: counterQueryKeys.all });
      toast.success(`${ids.length} entries marked as read`);
    },
  });
}

/**
 * Hook to toggle entry star
 */
export function useToggleEntryStar() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string): Promise<boolean> => {
      logger.debug('Toggling entry star', { id });
      const result = await commands.toggleEntryStar(id);

      if (result.status === 'error') {
        const isNotConnected = result.error === 'Not connected to Miniflux server';

        if (!isNotConnected) {
          logger.error('Failed to toggle entry star', {
            error: result.error,
            id,
          });
          toast.error('Failed to toggle star', {
            description: result.error,
          });
        }
        throw new Error(result.error);
      }

      logger.info('Entry star toggled', { id, newStatus: result.data });
      return result.data;
    },
    onSuccess: (newStatus, id) => {
      queryClient.setQueryData(entryQueryKeys.detail(id), (old: Entry | undefined) => {
        if (old) {
          return { ...old, starred: newStatus };
        }
        return old;
      });

      queryClient.setQueriesData<{ pages: EntryResponse[] }>(
        { queryKey: entryQueryKeys.lists() },
        (data) => {
          if (!data?.pages) return data;
          return {
            ...data,
            pages: data.pages.map((page) => ({
              ...page,
              entries: page.entries?.map((entry) =>
                entry.id === id ? { ...entry, starred: newStatus } : entry
              ),
            })),
          };
        }
      );

      queryClient.invalidateQueries({ queryKey: counterQueryKeys.all });
    },
  });
}

/**
 * Hook to update entry
 */
export function useUpdateEntry() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: EntryUpdate }) => {
      logger.debug('Updating entry', { id, updates });
      const result = await commands.updateEntry(id, updates);

      if (result.status === 'error') {
        logger.error('Failed to update entry', {
          error: result.error,
          id,
        });
        toast.error('Failed to update entry', {
          description: result.error,
        });
        throw new Error(result.error);
      }

      logger.info('Entry updated successfully', { id });
      return result.data;
    },
    onSuccess: (_, { id }) => {
      // Invalidate entry queries
      queryClient.invalidateQueries({ queryKey: entryQueryKeys.detail(id) });
      queryClient.invalidateQueries({ queryKey: entryQueryKeys.lists() });
      toast.success('Entry updated');
    },
  });
}

/**
 * Hook to fetch original article content
 */
export function useFetchEntryContent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, updateContent }: { id: string; updateContent: boolean }) => {
      logger.debug('Fetching entry content', { id, updateContent });
      const result = await commands.fetchEntryContent(id, updateContent);

      if (result.status === 'error') {
        logger.error('Failed to fetch entry content', {
          error: result.error,
          id,
        });
        toast.error('Failed to fetch content', {
          description: result.error,
        });
        throw new Error(result.error);
      }

      logger.info('Entry content fetched successfully', { id });
      return result.data;
    },
    onSuccess: (_, { id }) => {
      // Invalidate entry queries
      queryClient.invalidateQueries({ queryKey: entryQueryKeys.detail(id) });
      queryClient.invalidateQueries({ queryKey: entryQueryKeys.lists() });
    },
  });
}
