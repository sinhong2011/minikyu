import { RefreshIcon, Search01Icon } from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react';
import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { useSearch } from '@tanstack/react-router';
import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useRef, useState } from 'react';
import { MainWindowContent } from '@/components/layout/MainWindowContent';
import { SyncProgressPopover } from '@/components/sync/SyncProgressPopover';
import { Button } from '@/components/ui/button';
import { useSyncProgressListener } from '@/hooks/use-sync-progress-listener';
import { logger } from '@/lib/logger';
import type { EntryFilters } from '@/lib/tauri-bindings';
import { cn } from '@/lib/utils';
import { useIsConnected } from '@/services/miniflux/auth';
import { useCategories } from '@/services/miniflux/categories';
import { useEntries, usePrefetchEntry } from '@/services/miniflux/entries';
import { useSyncMiniflux } from '@/services/miniflux/feeds';
import { useLastReadingEntry, useSaveLastReading } from '@/services/reading-state';
import { useSyncStore } from '@/store/sync-store';
import { useUIStore } from '@/store/ui-store';
import { ConnectionDialog } from './ConnectionDialog';
import { EntryFiltersUI } from './EntryFilters';
import { EntryList, type EntryListFilterStatus } from './EntryList';

type FilterType = 'all' | 'starred' | 'today' | 'history';

export function MinifluxLayout() {
  const { _ } = useLingui();
  const search = useSearch({ from: '/' });
  const filter: FilterType = search.filter || 'all';
  const categoryId = search.categoryId;
  const feedId = search.feedId;
  const { data: isConnected, isLoading } = useIsConnected();
  const { data: categories } = useCategories(isConnected ?? false);
  const [showConnectionDialog, setShowConnectionDialog] = useState(false);
  const selectedEntryId = useUIStore((state) => state.selectedEntryId);
  const setSelectedEntryId = useUIStore((state) => state.setSelectedEntryId);
  const searchFiltersVisible = useUIStore((state) => state.searchFiltersVisible);
  const toggleSearchFilters = useUIStore((state) => state.toggleSearchFilters);
  const [localFilters, setLocalFilters] = useState<EntryFilters>({});
  const [hasInteractedBottomFilter, setHasInteractedBottomFilter] = useState(false);
  const syncMiniflux = useSyncMiniflux();
  const syncing = useSyncStore((state) => state.syncing);
  const hasAutoSyncedRef = useRef(false);
  useSyncProgressListener();
  const hasExplicitStatusFilter = localFilters.starred != null || localFilters.status != null;
  const shouldDefaultToUnread =
    !hasInteractedBottomFilter &&
    !hasExplicitStatusFilter &&
    filter !== 'starred' &&
    filter !== 'history';
  const currentStatus = localFilters.starred
    ? 'starred'
    : localFilters.status === 'unread' || shouldDefaultToUnread
      ? 'unread'
      : 'all';
  const prefetchEntry = usePrefetchEntry();
  const { data: lastReadingEntry } = useLastReadingEntry();
  const saveLastReading = useSaveLastReading();

  // Merge router filters with local filters
  const mergedFilters: EntryFilters = {
    // biome-ignore lint/style/useNamingConvention: API field name
    ...(categoryId ? { category_id: Number(categoryId) } : {}),
    // biome-ignore lint/style/useNamingConvention: API field name
    ...(feedId ? { feed_id: Number(feedId) } : {}),
    ...(filter === 'starred' ? { starred: true } : {}),
    ...(filter === 'history' ? { status: 'read' } : {}),
    ...(shouldDefaultToUnread ? { status: 'unread' as const } : {}),
    order: 'published_at',
    direction: 'desc',
    ...localFilters,
  } as EntryFilters;

  // Get entries for logging - needed to log entry data on selection
  const { data: entriesData } = useEntries(mergedFilters);

  // Calculate prev/next navigation
  const currentIndex = entriesData?.entries?.findIndex((e) => e.id === selectedEntryId) ?? -1;
  const hasPrev = currentIndex > 0;
  const hasNext = currentIndex >= 0 && currentIndex < (entriesData?.entries?.length ?? 0) - 1;

  const handleNavigatePrev = () => {
    if (hasPrev && entriesData?.entries) {
      const prevEntry = entriesData.entries[currentIndex - 1];
      if (prevEntry) {
        handleEntrySelect(prevEntry.id);
      }
    }
  };

  const handleNavigateNext = () => {
    if (hasNext && entriesData?.entries) {
      const nextEntry = entriesData.entries[currentIndex + 1];
      if (nextEntry) {
        handleEntrySelect(nextEntry.id);
      }
    }
  };

  // Handle entry selection with logging - logs entry details when user selects an entry
  const handleEntrySelect = (entryId: string) => {
    const entry = entriesData?.entries?.find((e) => e.id === entryId);

    if (entry) {
      logger.info('Entry selected', {
        id: entry.id,
        title: entry.title,
        feed: entry.feed.title,
        status: entry.status,
        starred: entry.starred,
        url: entry.url,
        publishedAt: entry.published_at,
      });

      // Save last reading entry (no scroll position)
      saveLastReading.mutate({
        // biome-ignore lint/style/useNamingConvention: API field name
        entry_id: String(entry.id),
        timestamp: String(Date.now()),
      });
    } else {
      logger.warn('Entry selected but not found in data', { entryId });
    }

    setSelectedEntryId(entryId);

    if (entriesData?.entries) {
      const idx = entriesData.entries.findIndex((e) => e.id === entryId);
      if (idx !== -1) {
        if (idx > 0) {
          const prev = entriesData.entries[idx - 1];
          if (prev) prefetchEntry(prev.id);
        }
        if (idx < entriesData.entries.length - 1) {
          const next = entriesData.entries[idx + 1];
          if (next) prefetchEntry(next.id);
        }
      }
    }
  };

  useEffect(() => {
    if (lastReadingEntry && entriesData?.entries && !selectedEntryId) {
      const entryExists = entriesData.entries.find(
        (e) => String(e.id) === lastReadingEntry.entry_id
      );
      if (entryExists) {
        logger.info('Auto-selecting last reading entry', {
          entryId: lastReadingEntry.entry_id,
          timestamp: lastReadingEntry.timestamp,
        });
        setSelectedEntryId(lastReadingEntry.entry_id);
      }
    }
  }, [lastReadingEntry, entriesData, selectedEntryId, setSelectedEntryId]);

  useEffect(() => {
    if (!isConnected) {
      hasAutoSyncedRef.current = false;
      return;
    }

    if (!syncing && !hasAutoSyncedRef.current) {
      hasAutoSyncedRef.current = true;
      syncMiniflux.mutate();
    }
  }, [isConnected, syncing, syncMiniflux]);

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center">
          <div className="text-lg font-medium">{_(msg`Loading...`)}</div>
        </div>
      </div>
    );
  }

  if (!isConnected) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center max-w-md">
          <h2 className="text-2xl font-bold mb-2">{_(msg`Welcome to Miniflux`)}</h2>
          <p className="text-muted-foreground mb-4">
            {_(msg`Connect to your Miniflux server to get started`)}
          </p>
          <Button onClick={() => setShowConnectionDialog(true)}>{_(msg`Connect to Server`)}</Button>
          <ConnectionDialog open={showConnectionDialog} onOpenChange={setShowConnectionDialog} />
        </div>
      </div>
    );
  }

  const getFilterTitle = () => {
    if (categoryId) {
      const category = categories?.find((c) => c.id.toString() === categoryId);
      return category?.title || _(msg`Category`);
    }

    if (feedId) {
      return _(msg`Feed`);
    }

    switch (filter) {
      case 'all':
        return _(msg`All`);
      case 'starred':
        return _(msg`Starred`);
      case 'today':
        return _(msg`Today`);
      case 'history':
        return _(msg`History`);
      default:
        return _(msg`All`);
    }
  };

  const handleBottomFilterChange = (status: EntryListFilterStatus) => {
    setHasInteractedBottomFilter(true);
    setLocalFilters({
      ...localFilters,
      status: status === 'all' || status === 'starred' ? null : status,
      starred: status === 'starred' ? true : null,
    });
  };

  return (
    <MainWindowContent
      onNavigatePrev={handleNavigatePrev}
      onNavigateNext={handleNavigateNext}
      hasPrev={hasPrev}
      hasNext={hasNext}
    >
      <div className="flex flex-col h-full relative">
        <div className="border-b px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-semibold">{getFilterTitle()}</h1>
          </div>
          <div className="flex items-center gap-2">
            <SyncProgressPopover>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => {
                  if (!syncing) {
                    syncMiniflux.mutate();
                  }
                }}
                title={syncing ? _(msg`Syncing...`) : _(msg`Sync`)}
              >
                <HugeiconsIcon
                  icon={RefreshIcon}
                  className={cn('h-4 w-4', syncing && 'animate-spin')}
                />
              </Button>
            </SyncProgressPopover>
            <Button
              variant="ghost"
              size="icon"
              className={cn('h-8 w-8', searchFiltersVisible && 'text-primary bg-primary/10')}
              onClick={toggleSearchFilters}
              title={_(msg`Search`)}
            >
              <HugeiconsIcon icon={Search01Icon} className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <AnimatePresence>
          {searchFiltersVisible && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden border-b"
            >
              <EntryFiltersUI
                filters={mergedFilters}
                onFiltersChange={(f: EntryFilters) => setLocalFilters({ ...localFilters, ...f })}
                hideToggleBar
              />
            </motion.div>
          )}
        </AnimatePresence>
        <div className="flex-1 overflow-hidden">
          <EntryList
            filters={mergedFilters}
            selectedEntryId={selectedEntryId}
            onEntrySelect={handleEntrySelect}
            currentStatus={currentStatus}
            onStatusChange={handleBottomFilterChange}
          />
        </div>
      </div>
    </MainWindowContent>
  );
}
