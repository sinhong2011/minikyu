import { useInfiniteQuery } from '@tanstack/react-query';
import { useCallback, useRef } from 'react';
import { logger } from '@/lib/logger';
import { commands, type Entry, type EntryFilters, type EntryResponse } from '@/lib/tauri-bindings';
import { entryQueryKeys } from '@/services/miniflux/entries';

const MAX_POOL_SIZE = 500;
const ENTRIES_PAGE_SIZE = 100;

/** Zen Mode's unread pool, scoped under the shared entry-list key namespace. */
export const zenModeEntriesQueryKey = [
  ...entryQueryKeys.lists(),
  { scope: 'zen-mode', status: 'unread' },
] as const;

/**
 * Flatten paged results into Zen Mode's candidate pool.
 *
 * Offset pagination can hand back the same entry twice when the pool shifts
 * mid-scroll, hence the dedupe. Read entries are dropped here rather than
 * refetched: the read-status patch written by useToggleEntryRead /
 * useMarkEntryRead lands in this cache too, so anything read — in Zen Mode or
 * any other view — stops being a candidate immediately.
 */
export function selectUnreadPool(pages: EntryResponse[]): Entry[] {
  const seenIds = new Set<string>();
  const unread: Entry[] = [];

  for (const page of pages) {
    for (const entry of page.entries ?? []) {
      if (entry.status === 'read' || seenIds.has(entry.id)) continue;
      seenIds.add(entry.id);
      unread.push(entry);
      if (unread.length >= MAX_POOL_SIZE) return unread;
    }
  }

  return unread;
}

/**
 * Weight entries by recency for random selection:
 * - Today: 3x weight
 * - This week: 2x weight
 * - Older: 1x weight
 */
function getEntryWeight(entry: Entry): number {
  const publishedAt = new Date(entry.published_at);
  const now = new Date();
  const daysSincePublished = (now.getTime() - publishedAt.getTime()) / (1000 * 60 * 60 * 24);

  if (daysSincePublished < 1) return 3;
  if (daysSincePublished < 7) return 2;
  return 1;
}

function selectWeightedRandomEntry(entries: Entry[], excludeIds: Set<string>): Entry | null {
  const availableEntries = entries.filter((e) => !excludeIds.has(e.id));

  if (availableEntries.length === 0) return null;

  const weightedPool: { entry: Entry; cumulativeWeight: number }[] = [];
  let totalWeight = 0;

  for (const entry of availableEntries) {
    const weight = getEntryWeight(entry);
    totalWeight += weight;
    weightedPool.push({ entry, cumulativeWeight: totalWeight });
  }

  const random = Math.random() * totalWeight;

  for (const item of weightedPool) {
    if (random < item.cumulativeWeight) return item.entry;
  }

  return weightedPool[weightedPool.length - 1]?.entry ?? null;
}

/**
 * Hook to get a random unread entry from all accounts
 * using weighted random selection based on recency
 */
export function useRandomEntry() {
  const seenEntryIds = useRef<Set<string>>(new Set());

  const query = useInfiniteQuery({
    // Nested under entryQueryKeys.lists() so the prefixed cache writes in
    // useToggleEntryRead / useMarkEntryRead reach this pool too — an entry read
    // in Zen Mode (or anywhere else) drops out of it without a refetch.
    queryKey: zenModeEntriesQueryKey,
    initialPageParam: 0,
    queryFn: async ({ pageParam }): Promise<EntryResponse> => {
      const filters: EntryFilters = {
        status: 'unread',
        limit: String(ENTRIES_PAGE_SIZE),
        offset: String(pageParam),
        order: 'published_at',
        direction: 'desc',
      };

      logger.debug('Fetching entries for Zen Mode', { filters });
      const result = await commands.getEntriesList(filters);

      if (result.status === 'error') {
        const isNotConnected = result.error === 'Not connected to Miniflux server';
        if (!isNotConnected) {
          logger.error('Failed to fetch entries for Zen Mode', { error: result.error });
        }
        throw new Error(result.error);
      }

      logger.debug('Fetched entries for Zen Mode', {
        count: result.data.entries?.length ?? 0,
        total: result.data.total,
      });

      return result.data;
    },
    getNextPageParam: (lastPage, allPages) => {
      const total = Number(lastPage.total ?? '0');
      const loadedCount = allPages.reduce((count, page) => count + (page.entries?.length ?? 0), 0);

      if (loadedCount >= MAX_POOL_SIZE || loadedCount >= total) {
        return undefined;
      }

      return loadedCount;
    },
    select: (data): Entry[] => selectUnreadPool(data.pages),
    staleTime: 1000 * 60 * 2,
    gcTime: 1000 * 60 * 5,
  });

  const entries = query.data ?? [];

  const getRandomEntry = useCallback(
    (excludeIds: string[] = []): Entry | null => {
      const excludeSet = new Set(excludeIds);
      return selectWeightedRandomEntry(entries, excludeSet);
    },
    [entries]
  );

  const getNextRandomEntry = useCallback((): Entry | null => {
    const entry = selectWeightedRandomEntry(entries, seenEntryIds.current);
    if (entry) seenEntryIds.current.add(entry.id);
    return entry;
  }, [entries]);

  const markEntryAsSeen = useCallback((entryId: string) => {
    seenEntryIds.current.add(entryId);
  }, []);

  const resetSeenEntries = useCallback(() => {
    seenEntryIds.current = new Set();
  }, []);

  return {
    entries,
    hasEntries: entries.length > 0,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    error: query.error,
    getRandomEntry,
    getNextRandomEntry,
    markEntryAsSeen,
    resetSeenEntries,
    refetch: query.refetch,
  };
}
