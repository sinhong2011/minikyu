import {
  CheckmarkCircle02Icon,
  Delete01Icon,
  Search01Icon,
  Sorting01Icon,
  WifiOffIcon,
} from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react';
import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { useSearch } from '@tanstack/react-router';
import { confirm } from '@tauri-apps/plugin-dialog';
import { AnimatePresence, motion } from 'motion/react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import {
  Menu,
  MenuGroup,
  MenuGroupLabel,
  MenuItem,
  MenuPanel,
  MenuSeparator,
  MenuTrigger,
} from '@/components/animate-ui/components/base/menu';
import { MainWindowContent } from '@/components/layout/MainWindowContent';
import { Button } from '@/components/ui/button';
import { useAudioEngine } from '@/hooks/use-audio-engine';
import { useAutoSync } from '@/hooks/use-auto-sync';
import { usePlayerCommandListener } from '@/hooks/use-player-command-listener';
import { useSyncProgressListener } from '@/hooks/use-sync-progress-listener';
import { resetAccountState } from '@/lib/account-reset';
import { logger } from '@/lib/logger';
import { queryClient } from '@/lib/query-client';
import type { EntryFilters } from '@/lib/tauri-bindings';
import { commands } from '@/lib/tauri-bindings';
import { cn } from '@/lib/utils';
import { useAccounts, useActiveAccount } from '@/services/miniflux/accounts';
import { useIsConnected } from '@/services/miniflux/auth';
import { useCategories, useMarkCategoryAsRead } from '@/services/miniflux/categories';
import { useUnreadCounts } from '@/services/miniflux/counters';
import { useEntries, usePrefetchEntry } from '@/services/miniflux/entries';
import { useMarkFeedAsRead, useSyncMiniflux } from '@/services/miniflux/feeds';
import { useLastReadingEntry, useSaveLastReading } from '@/services/reading-state';
import { useSyncStore } from '@/store/sync-store';
import { useUIStore } from '@/store/ui-store';
import { ConnectionDialog } from './ConnectionDialog';
import { EntryFiltersUI } from './EntryFilters';
import { EntryList, type EntryListFilterStatus } from './EntryList';

type FilterType = 'all' | 'starred' | 'today' | 'history';

type SortOrder = 'published_at' | 'changed_at';
type SortDirection = 'asc' | 'desc';

export function MinifluxLayout() {
  const { _, i18n } = useLingui();
  useAudioEngine();
  useAutoSync();
  usePlayerCommandListener();
  const search = useSearch({ from: '/' });
  const filter: FilterType = search.filter || 'all';
  const categoryId = search.categoryId;
  const feedId = search.feedId;
  const { data: isConnected, isLoading } = useIsConnected();
  const { data: activeAccount } = useActiveAccount();
  const { data: allAccounts = [] } = useAccounts();
  const { data: categories } = useCategories();
  const { data: unreadCounts } = useUnreadCounts();
  const showConnectionDialog = useUIStore((state) => state.showConnectionDialog);
  const setShowConnectionDialog = useUIStore((state) => state.setShowConnectionDialog);
  const selectedEntryId = useUIStore((state) => state.selectedEntryId);
  const setSelectedEntryId = useUIStore((state) => state.setSelectedEntryId);
  const searchFiltersVisible = useUIStore((state) => state.searchFiltersVisible);
  const toggleSearchFilters = useUIStore((state) => state.toggleSearchFilters);
  const [localFilters, setLocalFilters] = useState<EntryFilters>({});
  const [hasInteractedBottomFilter, setHasInteractedBottomFilter] = useState(false);
  const [entryTransitionDirection, setEntryTransitionDirection] = useState<'forward' | 'backward'>(
    'forward'
  );
  const [sortOrder, setSortOrder] = useState<SortOrder>(
    filter === 'history' ? 'changed_at' : 'published_at'
  );
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  // Default sort order: history uses changed_at desc, others use published_at asc
  useEffect(() => {
    if (filter === 'history') {
      setSortOrder('changed_at');
      setSortDirection('asc');
    } else {
      setSortOrder('published_at');
      setSortDirection('asc');
    }
  }, [filter]);

  const syncMiniflux = useSyncMiniflux();
  const markFeedAsRead = useMarkFeedAsRead();
  const markCategoryAsRead = useMarkCategoryAsRead();
  const syncing = useSyncStore((state) => state.syncing);
  const hasAutoSyncedRef = useRef(false);
  const suppressAutoSelectRef = useRef(false);
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
  const showBottomFilterTab = filter !== 'starred' && filter !== 'history';
  const prefetchEntry = usePrefetchEntry();
  const { data: lastReadingEntry } = useLastReadingEntry();
  const saveLastReading = useSaveLastReading();
  const countFormatter = new Intl.NumberFormat(i18n.locale, {
    notation: 'compact',
    maximumFractionDigits: 1,
  });

  // Merge router filters with local filters
  const mergedFilters: EntryFilters = useMemo(
    () =>
      ({
        // biome-ignore lint/style/useNamingConvention: API field name
        ...(categoryId ? { category_id: Number(categoryId) } : {}),
        // biome-ignore lint/style/useNamingConvention: API field name
        ...(feedId ? { feed_id: Number(feedId) } : {}),
        ...(filter === 'starred' ? { starred: true } : {}),
        ...(filter === 'history' ? { status: 'read' } : {}),
        ...(shouldDefaultToUnread ? { status: 'unread' as const } : {}),
        ...localFilters, // <-- localFilters spreads first
        // Use selected sort order and direction
        order: sortOrder,
        direction: sortDirection,
      }) as EntryFilters,
    [categoryId, feedId, filter, shouldDefaultToUnread, localFilters, sortOrder, sortDirection]
  );

  // Get entries for logging - needed to log entry data on selection
  const { data: entriesData } = useEntries(mergedFilters);
  const totalEntries = Number(entriesData?.total ?? '0');
  const hasCachedEntries = Number.isFinite(totalEntries) && totalEntries > 0;
  const hasCachedCategories = (categories?.length ?? 0) > 0;
  const hasCachedUnreadCounts =
    Number(unreadCounts?.total ?? '0') > 0 ||
    Number(unreadCounts?.today ?? '0') > 0 ||
    (unreadCounts?.by_feed?.length ?? 0) > 0 ||
    (unreadCounts?.by_category?.length ?? 0) > 0;
  const hasActiveAccount = Boolean(activeAccount);
  const hasCachedContent =
    hasCachedEntries || hasCachedCategories || hasCachedUnreadCounts || hasActiveAccount;

  // Snapshot entry order when user selects an entry, so prev/next navigation
  // stays stable even if the list refreshes (e.g. marking read removes from unread list).
  const navigationSnapshotRef = useRef<string[]>([]);

  // Update snapshot when entries data changes AND the selected entry is still in the list.
  // This keeps the snapshot fresh for new selections while preserving it during reads.
  useEffect(() => {
    if (!entriesData?.entries?.length) return;
    const ids = entriesData.entries.map((e) => e.id);
    // Only update snapshot if no entry is selected or the selected entry exists in the new list
    if (!selectedEntryId || ids.includes(selectedEntryId)) {
      navigationSnapshotRef.current = ids;
    }
  }, [entriesData?.entries, selectedEntryId]);

  // Calculate prev/next from the snapshot, not live data
  const snapshotIds = navigationSnapshotRef.current;
  const currentIndex = selectedEntryId ? snapshotIds.indexOf(selectedEntryId) : -1;
  const hasPrev = currentIndex > 0;
  const hasNext = currentIndex >= 0 && currentIndex < snapshotIds.length - 1;
  const nextEntryId = hasNext ? snapshotIds[currentIndex + 1] : undefined;
  const nextEntryTitle = nextEntryId
    ? entriesData?.entries?.find((e) => e.id === nextEntryId)?.title
    : undefined;

  const handleNavigatePrev = () => {
    if (hasPrev) {
      const prevId = snapshotIds[currentIndex - 1];
      if (prevId) {
        handleEntrySelect(prevId);
      }
    }
  };

  const handleNavigateNext = () => {
    if (hasNext) {
      const nextId = snapshotIds[currentIndex + 1];
      if (nextId) {
        handleEntrySelect(nextId);
      }
    }
  };

  const handleClose = () => {
    suppressAutoSelectRef.current = true;
    setSelectedEntryId(undefined);
  };

  // Handle entry selection with logging - logs entry details when user selects an entry
  const handleEntrySelect = (entryId: string) => {
    suppressAutoSelectRef.current = false;

    // Use snapshot for transition direction
    if (selectedEntryId && selectedEntryId !== entryId) {
      const previousIndex = snapshotIds.indexOf(selectedEntryId);
      const nextIndex = snapshotIds.indexOf(entryId);

      if (previousIndex !== -1 && nextIndex !== -1) {
        setEntryTransitionDirection(nextIndex > previousIndex ? 'forward' : 'backward');
      }
    }

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

      // Save last reading entry.
      saveLastReading.mutate({
        // biome-ignore lint/style/useNamingConvention: API field name
        entry_id: String(entry.id),
        timestamp: String(Date.now()),
      });
    } else {
      logger.warn('Entry selected but not found in data', { entryId });
    }

    setSelectedEntryId(entryId);

    // Update snapshot to include the new entry's position from live data
    if (entriesData?.entries) {
      const liveIds = entriesData.entries.map((e) => e.id);
      if (liveIds.includes(entryId)) {
        navigationSnapshotRef.current = liveIds;
      }
    }

    // Prefetch adjacent entries from snapshot
    const idx = navigationSnapshotRef.current.indexOf(entryId);
    if (idx !== -1) {
      if (idx > 0) {
        const prevId = navigationSnapshotRef.current[idx - 1];
        if (prevId) prefetchEntry(prevId);
      }
      if (idx < navigationSnapshotRef.current.length - 1) {
        const nextId = navigationSnapshotRef.current[idx + 1];
        if (nextId) prefetchEntry(nextId);
      }
    }
  };

  useEffect(() => {
    if (selectedEntryId) {
      suppressAutoSelectRef.current = false;
      return;
    }

    if (suppressAutoSelectRef.current) {
      return;
    }

    if (lastReadingEntry) {
      setEntryTransitionDirection('forward');
      logger.info('Auto-selecting last reading entry', {
        entryId: lastReadingEntry.entry_id,
        timestamp: lastReadingEntry.timestamp,
      });
      setSelectedEntryId(lastReadingEntry.entry_id);
    }
  }, [lastReadingEntry, selectedEntryId, setSelectedEntryId]);

  // Reset state when account changes (skip initial load from undefined → first account)
  const activeAccountId = activeAccount?.id;
  const prevAccountIdRef = useRef<string | undefined>(activeAccountId);
  const hasInitialAccountRef = useRef(false);
  useEffect(() => {
    if (prevAccountIdRef.current === activeAccountId) return;
    const isInitialLoad = !hasInitialAccountRef.current && activeAccountId != null;
    prevAccountIdRef.current = activeAccountId;
    if (isInitialLoad) {
      hasInitialAccountRef.current = true;
      return;
    }
    hasInitialAccountRef.current = true;
    hasAutoSyncedRef.current = false;
    suppressAutoSelectRef.current = false;
    setSelectedEntryId(undefined);
  }, [activeAccountId, setSelectedEntryId]);

  // Auto-sync on connect or account switch
  // biome-ignore lint/correctness/useExhaustiveDependencies: activeAccountId triggers sync for new account
  useEffect(() => {
    if (!isConnected) {
      hasAutoSyncedRef.current = false;
      return;
    }

    if (!syncing && !hasAutoSyncedRef.current) {
      hasAutoSyncedRef.current = true;
      syncMiniflux.mutate();
    }
  }, [activeAccountId, isConnected, syncing, syncMiniflux]);

  const handlePullToRefresh = useCallback(() => {
    if (!isConnected || syncing) {
      return;
    }

    syncMiniflux.mutate();
  }, [isConnected, syncing, syncMiniflux]);

  const handleFlushHistory = async () => {
    // Show confirmation dialog
    const confirmed = await confirm(
      _(
        msg`Are you sure you want to flush history? This will delete all read entries from the Miniflux server.`
      ),
      { title: _(msg`Flush History`), kind: 'warning' }
    );

    if (!confirmed) {
      return;
    }

    const result = await commands.flushHistory();

    if (result.status === 'error') {
      toast.error(_(msg`Failed to flush history`), {
        description: result.error,
      });
      return;
    }

    queryClient.invalidateQueries({ queryKey: ['miniflux'] });

    toast.success(_(msg`History flushed`), {
      description: _(msg`All read entries have been deleted`),
    });
  };

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center">
          <div className="text-lg font-medium">{_(msg`Loading...`)}</div>
        </div>
      </div>
    );
  }

  // When offline and no local cache is available, history/starred cannot be shown
  if (!isConnected && !hasCachedContent && (filter === 'history' || filter === 'starred')) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center max-w-md">
          <HugeiconsIcon
            icon={WifiOffIcon}
            className="mx-auto mb-4 size-12 text-muted-foreground"
          />
          <h2 className="text-2xl font-bold mb-2">{_(msg`Offline Mode`)}</h2>
          <p className="text-muted-foreground mb-4">
            {filter === 'history'
              ? _(msg`History page is only available when connected to Miniflux server.`)
              : _(msg`Starred items page is only available when connected to Miniflux server.`)}
          </p>
          <p className="text-sm text-muted-foreground">
            {_(msg`Please connect to your server to use this feature.`)}
          </p>
        </div>
      </div>
    );
  }

  const handleReconnectAccount = async (accountId: string) => {
    try {
      const result = await commands.switchMinifluxAccount(accountId);
      if (result.status === 'ok') {
        await resetAccountState();
      } else {
        logger.error('Failed to reconnect account:', { error: result.error });
        toast.error(_(msg`Failed to reconnect account`));
      }
    } catch (error) {
      logger.error('Error reconnecting account:', { error });
      toast.error(_(msg`Failed to reconnect account`));
    }
  };

  const getDomain = (url: string) => {
    try {
      return new URL(url).hostname;
    } catch {
      return url;
    }
  };

  if (!isConnected && !hasCachedContent) {
    const inactiveAccounts = allAccounts.filter((a) => !a.is_active);

    return (
      <div className="flex h-full items-center justify-center">
        <div className="flex flex-col items-center max-w-xs w-full">
          <h2 className="text-2xl font-bold mb-1">{_(msg`Welcome to Miniflux`)}</h2>
          <p className="text-sm text-muted-foreground mb-6">
            {inactiveAccounts.length > 0
              ? _(msg`Reconnect to an existing account or add a new one`)
              : _(msg`Connect to your Miniflux server to get started`)}
          </p>
          {inactiveAccounts.length > 0 && (
            <div className="flex flex-col gap-1.5 w-full mb-4">
              {inactiveAccounts.map((account) => (
                <button
                  key={account.id}
                  type="button"
                  className="flex items-center gap-3 rounded-lg border border-border/50 px-3 py-2.5 text-left transition-colors hover:bg-accent/50 hover:border-border"
                  onClick={() => handleReconnectAccount(account.id)}
                >
                  <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary/10 text-primary text-xs font-semibold shrink-0">
                    {account.username.slice(0, 2).toUpperCase()}
                  </div>
                  <div className="flex flex-col min-w-0">
                    <span className="text-sm font-medium truncate">{account.username}</span>
                    <span className="text-[11px] text-muted-foreground truncate">
                      {getDomain(account.server_url)}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          )}
          <Button
            variant={inactiveAccounts.length > 0 ? 'ghost' : 'default'}
            size="sm"
            onClick={() => setShowConnectionDialog(true)}
          >
            {inactiveAccounts.length > 0 ? _(msg`Add New Account`) : _(msg`Connect to Server`)}
          </Button>
          <ConnectionDialog open={showConnectionDialog} onOpenChange={setShowConnectionDialog} />
        </div>
      </div>
    );
  }

  const getFilterCount = () => {
    if (!entriesData) {
      return null;
    }

    const total = Number(entriesData.total);
    if (Number.isNaN(total)) {
      return null;
    }

    return total;
  };

  const getUnreadFilterCount = () => {
    if (!unreadCounts) {
      return null;
    }

    if (categoryId) {
      const categoryCount = unreadCounts.by_category?.find((c) => c.category_id === categoryId);
      const unread = Number(categoryCount?.unread_count);
      return Number.isNaN(unread) ? null : unread;
    }

    if (feedId) {
      const feedCount = unreadCounts.by_feed?.find((f) => f.feed_id === feedId);
      const unread = Number(feedCount?.unread_count);
      return Number.isNaN(unread) ? null : unread;
    }

    if (filter === 'all' || filter === 'today') {
      const unread = Number(filter === 'all' ? unreadCounts.total : unreadCounts.today);
      return Number.isNaN(unread) ? null : unread;
    }

    return null;
  };

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

  const formatCountSummary = (count: number | null, label: string) => {
    if (count == null) {
      return null;
    }

    return `${countFormatter.format(count)} ${label}`;
  };

  const getFilterCountSummary = () => {
    if (categoryId || feedId || filter === 'all' || filter === 'today') {
      return formatCountSummary(getUnreadFilterCount(), _(msg`unread items`));
    }

    if (filter === 'starred') {
      return formatCountSummary(getFilterCount(), _(msg`starred items`));
    }

    if (filter === 'history') {
      return formatCountSummary(getFilterCount(), _(msg`history items`));
    }

    return null;
  };

  const handleBottomFilterChange = (status: EntryListFilterStatus) => {
    setHasInteractedBottomFilter(true);
    setLocalFilters({
      ...localFilters,
      status: status === 'all' || status === 'starred' ? null : status,
      starred: status === 'starred' ? true : null,
    });
  };
  const filterTitle = getFilterTitle();
  const filterCountSummary = getFilterCountSummary();

  return (
    <MainWindowContent
      onNavigatePrev={handleNavigatePrev}
      onNavigateNext={handleNavigateNext}
      onClose={handleClose}
      hasPrev={hasPrev}
      hasNext={hasNext}
      nextEntryTitle={nextEntryTitle}
      entryTransitionDirection={entryTransitionDirection}
    >
      <div className="flex flex-col h-full relative">
        <div className="px-2.5 pt-2 pb-3 flex items-center justify-between">
          <div className="flex flex-col overflow-hidden">
            <AnimatePresence mode="wait">
              <motion.h1
                key={filterTitle}
                className="text-xl font-semibold"
                initial={{ opacity: 0, x: -30, scale: 0.96 }}
                animate={{ opacity: 1, x: 0, scale: 1 }}
                exit={{ opacity: 0, x: 30, scale: 0.96 }}
                transition={{
                  duration: 0.35,
                  ease: [0.22, 1, 0.36, 1],
                }}
              >
                {filterTitle}
              </motion.h1>
            </AnimatePresence>
            <AnimatePresence mode="wait">
              {filterCountSummary && (
                <motion.p
                  key={filterCountSummary}
                  className="text-xs text-muted-foreground"
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 8 }}
                  transition={{
                    duration: 0.3,
                    delay: 0.1,
                    ease: 'easeOut',
                  }}
                >
                  {filterCountSummary}
                </motion.p>
              )}
            </AnimatePresence>
          </div>
          <div className="flex items-center gap-2">
            {(feedId || categoryId) && (
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => {
                  if (feedId) {
                    markFeedAsRead.mutateAsync(feedId).catch(() => {});
                  } else if (categoryId) {
                    markCategoryAsRead.mutateAsync(categoryId).catch(() => {});
                  }
                }}
                title={_(msg`Mark all as read`)}
              >
                <HugeiconsIcon icon={CheckmarkCircle02Icon} className="h-4 w-4" />
              </Button>
            )}
            {filter === 'history' && (
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={handleFlushHistory}
                title={_(msg`Flush history`)}
              >
                <HugeiconsIcon icon={Delete01Icon} className="h-4 w-4" />
              </Button>
            )}
            <Menu>
              <MenuTrigger
                className="flex h-8 w-8 items-center justify-center rounded-lg transition-colors hover:bg-accent"
                title={_(msg`Sort by`)}
              >
                <HugeiconsIcon icon={Sorting01Icon} className="h-4 w-4" />
              </MenuTrigger>
              <MenuPanel>
                <MenuGroup>
                  <MenuGroupLabel>{_(msg`Sort by`)}</MenuGroupLabel>
                  <MenuItem
                    onClick={() => setSortOrder('published_at')}
                    className={cn(sortOrder === 'published_at' && 'bg-white/10')}
                  >
                    {_(msg`Published date`)}
                  </MenuItem>
                  <MenuItem
                    onClick={() => setSortOrder('changed_at')}
                    className={cn(sortOrder === 'changed_at' && 'bg-white/10')}
                  >
                    {_(msg`Last read date`)}
                  </MenuItem>
                </MenuGroup>
                <MenuSeparator />
                <MenuGroup>
                  <MenuGroupLabel>{_(msg`Direction`)}</MenuGroupLabel>
                  <MenuItem
                    onClick={() => setSortDirection('asc')}
                    className={cn(sortDirection === 'asc' && 'bg-white/10')}
                  >
                    {_(msg`Ascending`)}
                  </MenuItem>
                  <MenuItem
                    onClick={() => setSortDirection('desc')}
                    className={cn(sortDirection === 'desc' && 'bg-white/10')}
                  >
                    {_(msg`Descending`)}
                  </MenuItem>
                </MenuGroup>
              </MenuPanel>
            </Menu>
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
              className="overflow-hidden"
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
            currentStatus={showBottomFilterTab ? currentStatus : undefined}
            onStatusChange={showBottomFilterTab ? handleBottomFilterChange : undefined}
            onPullToRefresh={handlePullToRefresh}
            isRefreshing={syncing}
          />
        </div>
      </div>
      <ConnectionDialog open={showConnectionDialog} onOpenChange={setShowConnectionDialog} />
    </MainWindowContent>
  );
}
