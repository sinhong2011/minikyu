import {
  CheckmarkCircle02Icon,
  Delete01Icon,
  FilterIcon,
  Search01Icon,
  Sorting01Icon,
  WifiOffIcon,
} from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react';
import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { useNavigate, useRouter, useSearch } from '@tanstack/react-router';

import { AnimatePresence, motion } from 'motion/react';
import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import { confirm } from '@/lib/dialog';
import { capabilities } from '@/lib/platform';
import { logger } from '@/lib/logger';
import { queryClient } from '@/lib/query-client';
import type { EntryFilters } from '@/lib/tauri-bindings';
import { commands } from '@/lib/tauri-bindings';
import { cn } from '@/lib/utils';
import { useAccounts, useActiveAccount } from '@/services/miniflux/accounts';
import { useIsConnected } from '@/services/miniflux/auth';
import { useCategories, useMarkCategoryAsRead } from '@/services/miniflux/categories';
import { useUnreadCounts } from '@/services/miniflux/counters';
import { useEntries, usePrefetchEntry, useToggleEntryRead } from '@/services/miniflux/entries';
import { useMarkFeedAsRead, useSyncMiniflux } from '@/services/miniflux/feeds';
import { useLastReadingEntry, useSaveLastReading } from '@/services/reading-state';
import { useSyncIndicator } from '@/hooks/use-sync-indicator';
import { useSyncStore } from '@/store/sync-store';
import { useIsMobile } from '@/hooks/use-mobile';
import { useUIStore } from '@/store/ui-store';

const ConnectionDialog = lazy(() =>
  import('./ConnectionDialog').then((m) => ({ default: m.ConnectionDialog }))
);

import { EntryFiltersUI } from './EntryFilters';
import { EntryList, type EntryListFilterStatus } from './EntryList';

type FilterType = 'all' | 'starred' | 'today' | 'history';

type SortOrder = 'published_at' | 'changed_at';
type SortDirection = 'asc' | 'desc';

const STATUS_SEGMENTS = [
  { value: 'all', label: msg`All` },
  { value: 'unread', label: msg`Unread` },
  { value: 'starred', label: msg`Starred` },
] as const;

export function MinifluxLayout() {
  const { _, i18n } = useLingui();
  useAudioEngine();
  useAutoSync();
  usePlayerCommandListener();
  const search = useSearch({ from: '/' });
  const navigate = useNavigate({ from: '/' });
  const router = useRouter();
  // True while the open reader owes its history entry to a push we made —
  // lets ✕ use history.back() so the stack stays balanced. Deep links
  // (?entry= on load) never push, so ✕ falls back to a replace.
  const readerPushedRef = useRef(false);
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
  const searchFiltersVisible = useUIStore((state) => state.searchFiltersVisible);
  const toggleSearchFilters = useUIStore((state) => state.toggleSearchFilters);
  const [entryTransitionDirection, setEntryTransitionDirection] = useState<'forward' | 'backward'>(
    'forward'
  );
  const selectedEntryId = search.entry;

  // Sort, status and the search/date filters are all read straight from the
  // URL. An absent param means "this view's default", so switching views —
  // the sidebar links replace the whole search object — resets them without
  // an effect, and every combination stays linkable and reload-safe.
  const sortOrder: SortOrder =
    search.sort ?? (filter === 'history' ? 'changed_at' : 'published_at');
  const sortDirection: SortDirection = search.dir ?? 'desc';
  const searchQuery = search.q;
  const afterFilter = search.after;

  /** Write one or more search params, keeping the rest of the URL intact. */
  const updateSearch = useCallback(
    (patch: Partial<typeof search>, options?: { replace?: boolean }) => {
      navigate({
        search: (prev) => ({ ...prev, ...patch }),
        replace: options?.replace ?? true,
        resetScroll: false,
      });
    },
    [navigate]
  );

  const syncMiniflux = useSyncMiniflux();
  const markFeedAsRead = useMarkFeedAsRead();
  const markCategoryAsRead = useMarkCategoryAsRead();
  const syncing = useSyncStore((state) => state.syncing);
  const { status: syncStatus, icon: syncIcon, title: syncTitle } = useSyncIndicator();
  const hasAutoSyncedRef = useRef(false);
  const suppressAutoSelectRef = useRef(false);
  const isMobile = useIsMobile();
  useSyncProgressListener();
  // Starred and History already pin a status, so they have no default of their
  // own; every other view starts on unread.
  const showBottomFilterTab = filter !== 'starred' && filter !== 'history';
  const currentStatus: EntryListFilterStatus =
    search.status ?? (showBottomFilterTab ? 'unread' : 'all');
  const prefetchEntry = usePrefetchEntry();
  const { data: lastReadingEntry } = useLastReadingEntry();
  const saveLastReading = useSaveLastReading();
  const toggleEntryRead = useToggleEntryRead();
  const countFormatter = new Intl.NumberFormat(i18n.locale, {
    notation: 'compact',
    maximumFractionDigits: 1,
  });

  // "Today" spans the local calendar day; after/before are unix seconds
  // compared against published_at (same window as the sidebar's today count).
  // Primitive deps keep mergedFilters stable until the day rolls over.
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(startOfDay);
  endOfDay.setDate(endOfDay.getDate() + 1);
  const todayAfter = String(Math.floor(startOfDay.getTime() / 1000));
  const todayBefore = String(Math.floor(endOfDay.getTime() / 1000));

  // Merge router filters with local filters
  const mergedFilters: EntryFilters = useMemo(
    () =>
      ({
        ...(categoryId ? { category_id: Number(categoryId) } : {}),
        ...(feedId ? { feed_id: Number(feedId) } : {}),
        ...(filter === 'starred' ? { starred: true } : {}),
        ...(filter === 'history' ? { status: 'read' } : {}),
        ...(filter === 'today' ? { after: todayAfter, before: todayBefore } : {}),
        // The status tab only applies where it is shown; on Starred and
        // History the view's own status wins.
        ...(currentStatus === 'unread' ? { status: 'unread' as const } : {}),
        ...(currentStatus === 'starred' ? { starred: true } : {}),
        // An explicit date filter overrides Today's window, as before.
        ...(searchQuery ? { search: searchQuery } : {}),
        ...(afterFilter ? { after: afterFilter } : {}),
        order: sortOrder,
        direction: sortDirection,
      }) as EntryFilters,
    [
      categoryId,
      feedId,
      filter,
      todayAfter,
      todayBefore,
      currentStatus,
      searchQuery,
      afterFilter,
      sortOrder,
      sortDirection,
    ]
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
    if (readerPushedRef.current) {
      // Balanced with the push in handleEntrySelect; the URL→store effect
      // performs the actual close when the router pops.
      readerPushedRef.current = false;
      router.history.back();
      return;
    }
    // Deep-linked or restored sessions have no entry to pop.
    updateSearch({ entry: undefined });
  };

  // A close — the ✕, or the browser's Back — must not be undone by the
  // resume-last-reading effect below. Watching the URL covers both, since the
  // URL is now the only thing that closes the reader.
  //
  // An account switch also clears ?entry=, but there the reader *should*
  // reopen on the new account's last article, so that case opts out.
  const previousEntryRef = useRef(search.entry);
  const accountResetRef = useRef(false);
  useEffect(() => {
    if (previousEntryRef.current && !search.entry) {
      suppressAutoSelectRef.current = !accountResetRef.current;
      readerPushedRef.current = false;
    }
    accountResetRef.current = false;
    previousEntryRef.current = search.entry;
  }, [search.entry]);

  const handleEntrySelect = (entryId: string) => {
    suppressAutoSelectRef.current = false;

    // One history entry per reading session: push when the reader opens,
    // replace while flipping prev/next inside it. Back (or swipe-back) then
    // closes the reader; the URL stays a shareable deep link throughout.
    const opening = !selectedEntryId;
    updateSearch({ entry: entryId }, { replace: !opening });
    if (opening) readerPushedRef.current = true;

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

      // Mark unread entries as read on selection
      if (entry.status === 'unread') {
        toggleEntryRead.mutate(entry.id);
      }

      // Save last reading entry.
      saveLastReading.mutate({
        entry_id: String(entry.id),
        timestamp: String(Date.now()),
      });
    } else {
      logger.warn('Entry selected but not found in data', { entryId });
    }

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

    // Phones are single-pane: auto-opening the reader would hijack the whole
    // screen (hiding the list and tab bar) the moment the app loads. Desktop
    // restores the last entry into the side pane, where it is unobtrusive.
    if (isMobile) {
      return;
    }

    if (lastReadingEntry) {
      setEntryTransitionDirection('forward');
      logger.info('Auto-selecting last reading entry', {
        entryId: lastReadingEntry.entry_id,
        timestamp: lastReadingEntry.timestamp,
      });
      // Replace, never push: a restored session is not somewhere the user
      // navigated to, so Back must still leave the view rather than undo it.
      updateSearch({ entry: lastReadingEntry.entry_id });
    }
  }, [lastReadingEntry, selectedEntryId, updateSearch, isMobile]);

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
    accountResetRef.current = true;
    updateSearch({ entry: undefined });
  }, [activeAccountId, updateSearch]);

  // Auto-sync on connect or account switch
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
    const getErrorMessage = (error: unknown): string => {
      if (error instanceof Error) return error.message;
      if (typeof error === 'string') return error;
      try {
        return JSON.stringify(error);
      } catch {
        return String(error);
      }
    };

    try {
      const result = await commands.switchMinifluxAccount(accountId);
      if (result.status === 'ok') {
        try {
          await resetAccountState();
        } catch (resetError) {
          logger.warn('Reconnect switch succeeded but state reset had non-fatal errors:', {
            error: resetError,
            message: getErrorMessage(resetError),
          });
        }
        toast.success(_(msg`Switched account`));

        // Best-effort background reconnect to refresh account identity/cache when online.
        // Do not block UI on keyring/network prompts.
        void commands
          .autoReconnectMiniflux()
          .then(async (reconnectResult) => {
            if (reconnectResult.status === 'ok') {
              try {
                await resetAccountState();
              } catch (resetError) {
                logger.warn('Background reconnect reset had non-fatal errors:', {
                  error: resetError,
                  message: getErrorMessage(resetError),
                });
              }
            } else {
              logger.warn('Background reconnect after switch failed:', {
                error: reconnectResult.error,
                message: getErrorMessage(reconnectResult.error),
              });
            }
          })
          .catch((reconnectError) => {
            logger.warn('Background reconnect after switch threw:', {
              error: reconnectError,
              message: getErrorMessage(reconnectError),
            });
          });
      } else {
        logger.error('Failed to reconnect account:', {
          error: result.error,
          message: getErrorMessage(result.error),
        });
        toast.error(_(msg`Failed to reconnect account`));
      }
    } catch (error) {
      logger.error('Error reconnecting account:', { error, message: getErrorMessage(error) });
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
    // Reconnecting switches the active account through Rust. Without a
    // multi-account store there is never a second account to switch to, so the
    // list stays empty and the welcome screen offers only "connect".
    const inactiveAccounts = capabilities.multiAccount
      ? allAccounts.filter((a) => !a.is_active)
      : [];

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
                  className="flex items-center gap-3 rounded-lg border border-border/50 px-3 py-2.5 text-left transition-colors hover:bg-black/[0.04] dark:hover:bg-white/[0.07] hover:border-border"
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
          {showConnectionDialog && (
            <Suspense>
              <ConnectionDialog
                open={showConnectionDialog}
                onOpenChange={setShowConnectionDialog}
              />
            </Suspense>
          )}
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
      const feedEntry = entriesData?.entries?.find((e) => e.feed_id === feedId);
      return feedEntry?.feed?.title || _(msg`Feed`);
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

  // `all` is written out rather than dropped, so it stays distinguishable from
  // "untouched" after a reload. Replace keeps Back for leaving the view rather
  // than un-toggling filters.
  const handleBottomFilterChange = (status: EntryListFilterStatus) => {
    updateSearch({ status });
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
        <div className="px-2.5 pt-2 pb-3 flex items-center justify-between max-sm:px-4 max-sm:pt-[max(0.75rem,env(safe-area-inset-top))]">
          <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
            <AnimatePresence mode="wait">
              <motion.h1
                key={filterTitle}
                className="max-w-full truncate text-xl font-semibold"
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
          <div className="flex shrink-0 items-center gap-2 max-sm:gap-1">
            {/* Phones: read-status filter as a popover; desktop keeps the floating pill. */}
            {showBottomFilterTab && currentStatus && (
              <Menu>
                <MenuTrigger
                  className="relative flex size-10 items-center justify-center rounded-lg transition-colors hover:bg-black/[0.06] dark:hover:bg-white/10 sm:hidden"
                  title={_(msg`Filter`)}
                >
                  <HugeiconsIcon icon={FilterIcon} className="h-4 w-4" />
                  {/* dot = a non-default filter is active */}
                  {currentStatus !== 'all' && (
                    <span className="absolute top-1.5 right-1.5 size-1.5 rounded-full bg-primary" />
                  )}
                </MenuTrigger>
                <MenuPanel>
                  <MenuGroup>
                    <MenuGroupLabel>{_(msg`Show`)}</MenuGroupLabel>
                    {STATUS_SEGMENTS.map((segment) => (
                      <MenuItem
                        key={segment.value}
                        onClick={() => handleBottomFilterChange(segment.value)}
                        className={cn(currentStatus === segment.value && 'bg-white/10')}
                      >
                        {_(segment.label)}
                      </MenuItem>
                    ))}
                  </MenuGroup>
                </MenuPanel>
              </Menu>
            )}
            {/* Phones: the app header is gone, so sync lives here. */}
            <Button
              variant="ghost"
              size="icon"
              className={cn(
                'size-10 sm:hidden',
                syncStatus === 'failed' ? 'text-destructive' : 'text-foreground/70'
              )}
              title={syncTitle}
              onClick={() => {
                if (!syncing) syncMiniflux.mutate();
              }}
            >
              <HugeiconsIcon
                icon={syncIcon}
                className={cn(
                  'h-4 w-4 transition-[transform,color,opacity] duration-200',
                  syncStatus === 'syncing' && 'sync-indicator-active',
                  syncStatus === 'completed' && 'sync-indicator-completed',
                  syncStatus === 'failed' && 'sync-indicator-failed'
                )}
              />
            </Button>
            {(feedId || categoryId) && (
              <Button
                variant="ghost"
                size="icon"
                className="size-10 sm:size-8"
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
                className="size-10 sm:size-8"
                onClick={handleFlushHistory}
                title={_(msg`Flush history`)}
              >
                <HugeiconsIcon icon={Delete01Icon} className="h-4 w-4" />
              </Button>
            )}
            <Menu>
              <MenuTrigger
                className="flex size-10 sm:size-8 items-center justify-center rounded-lg transition-colors hover:bg-black/[0.06] dark:hover:bg-white/10"
                title={_(msg`Sort by`)}
              >
                <HugeiconsIcon icon={Sorting01Icon} className="h-4 w-4" />
              </MenuTrigger>
              <MenuPanel>
                <MenuGroup>
                  <MenuGroupLabel>{_(msg`Sort by`)}</MenuGroupLabel>
                  <MenuItem
                    onClick={() => updateSearch({ sort: 'published_at' })}
                    className={cn(sortOrder === 'published_at' && 'bg-white/10')}
                  >
                    {_(msg`Published date`)}
                  </MenuItem>
                  <MenuItem
                    onClick={() => updateSearch({ sort: 'changed_at' })}
                    className={cn(sortOrder === 'changed_at' && 'bg-white/10')}
                  >
                    {_(msg`Last read date`)}
                  </MenuItem>
                </MenuGroup>
                <MenuSeparator />
                <MenuGroup>
                  <MenuGroupLabel>{_(msg`Direction`)}</MenuGroupLabel>
                  <MenuItem
                    onClick={() => updateSearch({ dir: 'asc' })}
                    className={cn(sortDirection === 'asc' && 'bg-white/10')}
                  >
                    {_(msg`Ascending`)}
                  </MenuItem>
                  <MenuItem
                    onClick={() => updateSearch({ dir: 'desc' })}
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
              className={cn(
                'size-10 sm:size-8',
                searchFiltersVisible && 'text-primary bg-primary/10'
              )}
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
                onFiltersChange={(f: EntryFilters) =>
                  updateSearch({
                    q: f.search || undefined,
                    after: f.after ?? undefined,
                  })
                }
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
      {showConnectionDialog && (
        <Suspense>
          <ConnectionDialog open={showConnectionDialog} onOpenChange={setShowConnectionDialog} />
        </Suspense>
      )}
    </MainWindowContent>
  );
}
