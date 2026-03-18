import {
  Alert01Icon,
  Download01Icon,
  HeadphonesIcon,
  InboxIcon,
  PlayIcon,
  Playlist03Icon,
  Refresh04Icon,
} from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react';
import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { AnimatePresence, motion } from 'motion/react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { FeedAvatar } from '@/components/miniflux';
import { NewEntryAnimationWrapper } from '@/components/miniflux/NewEntryAnimationWrapper';
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemHeader,
  ItemTitle,
} from '@/components/ui/item';
import { Skeleton } from '@/components/ui/skeleton';
import { extractThumbnail } from '@/lib/media-utils';
import {
  formatEntryTime,
  formatSectionDate,
  getEntryDateSectionType,
  groupEntriesByCalendarDate,
} from '@/lib/miniflux-utils';
import {
  buildPodcastDownloadFileName,
  formatDuration,
  getPodcastEnclosure,
} from '@/lib/podcast-utils';
import type { Enclosure, Entry, EntryFilters } from '@/lib/tauri-bindings';
import { commands } from '@/lib/tauri-bindings';
import { cn } from '@/lib/utils';
import { useEntries, usePrefetchEntry } from '@/services/miniflux';
import { usePreferences } from '@/services/preferences';
import { usePlayerStore } from '@/store/player-store';
import { useUIStore } from '@/store/ui-store';
import {
  type EntryListFilterStatus,
  EntryListFloatingFilterBar,
} from './EntryListFloatingFilterBar';

interface EntryListProps {
  filters?: EntryFilters;
  selectedEntryId?: string;
  onEntrySelect?: (entryId: string) => void;
  currentStatus?: EntryListFilterStatus;
  onStatusChange?: (status: EntryListFilterStatus) => void;
  onPullToRefresh?: () => void;
  isRefreshing?: boolean;
}

// Estimated height for section header shell
const SECTION_HEADER_HEIGHT = 36;

const PULL_TO_REFRESH_TRIGGER_DISTANCE = 128;
const PULL_TO_REFRESH_MAX_DISTANCE = 176;
const PULL_TO_REFRESH_HOLD_DISTANCE = 48;
const PULL_TO_REFRESH_PULL_GAIN = 0.78;
const PULL_TO_REFRESH_RELEASE_GAIN = 0.22;
const PULL_TO_REFRESH_DAMPING = 0.62;
const PULL_TO_REFRESH_TOP_TOLERANCE = 6;
const PULL_TO_REFRESH_RELEASE_DELAY_MS = 96;
const PULL_TO_REFRESH_SOFT_LIMIT = 72;
const PULL_TO_REFRESH_OVERFLOW_DAMPING = 0.24;

export function EntryList({
  filters = {},
  selectedEntryId,
  onEntrySelect,
  currentStatus,
  onStatusChange,
  onPullToRefresh,
  isRefreshing = false,
}: EntryListProps) {
  const { _, i18n } = useLingui();
  const { data: preferences } = usePreferences();
  const use24h = preferences?.time_format !== '12h';
  const {
    data: entriesData,
    isLoading,
    error,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useEntries(filters);
  const prefetchEntry = usePrefetchEntry();
  const [newEntryMap, setNewEntryMap] = useState<Map<string, number>>(() => new Map());
  const [routeChangeMap, setRouteChangeMap] = useState<Map<string, number>>(() => new Map());
  const isRouteChangeRef = useRef(false);
  const [listScrolling, setListScrolling] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);
  const [pullReady, setPullReady] = useState(false);
  const [isPulling, setIsPulling] = useState(false);
  const [pullRefreshPending, setPullRefreshPending] = useState(false);
  const [activeStickySectionKey, setActiveStickySectionKey] = useState<string | null>(null);
  const showFloatingFilterBar = Boolean(currentStatus && onStatusChange);

  const parentRef = useRef<HTMLDivElement>(null);
  const loadMoreRef = useRef<HTMLDivElement>(null);
  const sectionRefs = useRef(new Map<string, HTMLDivElement>());
  const previousEntryIdsRef = useRef<string[]>([]);
  const filterKeyRef = useRef<string>('');
  const removalTimersRef = useRef<Map<string, number>>(new Map());
  const lastScrollTopRef = useRef(0);
  const scrollStopTimerRef = useRef<number | null>(null);
  const pullDistanceRef = useRef(0);
  const pullReadyRef = useRef(false);
  const isPullingRef = useRef(false);
  const pullReleaseTimerRef = useRef<number | null>(null);
  const onPullToRefreshRef = useRef(onPullToRefresh);

  // Pull-to-refresh handlers
  const updatePullProgress = useCallback((nextDistance: number) => {
    const clamped = Math.max(0, Math.min(PULL_TO_REFRESH_MAX_DISTANCE, nextDistance));
    const ready = clamped >= PULL_TO_REFRESH_TRIGGER_DISTANCE;

    pullDistanceRef.current = clamped;
    pullReadyRef.current = ready;
    setPullDistance(clamped);
    setPullReady(ready);
  }, []);

  const resetPullGesture = useCallback(() => {
    isPullingRef.current = false;
    pullDistanceRef.current = 0;
    pullReadyRef.current = false;
    setIsPulling(false);
    setPullDistance(0);
    setPullReady(false);
  }, []);

  const releasePullGesture = useCallback(() => {
    if (!isPullingRef.current) {
      return;
    }

    const shouldRefresh =
      pullReadyRef.current && !isRefreshing && typeof onPullToRefreshRef.current === 'function';
    if (shouldRefresh) {
      setPullRefreshPending(true);
      onPullToRefreshRef.current?.();
    }

    resetPullGesture();
  }, [isRefreshing, resetPullGesture]);

  // Build list rows with section headers
  const listRows = useMemo(() => {
    const rows: Array<
      | { type: 'section'; key: string; title: string }
      | { type: 'entry'; key: string; entry: Entry; showSeparator: boolean }
    > = [];
    const dateField = filters.order === 'changed_at' ? 'changed_at' : 'published_at';
    const entrySections = groupEntriesByCalendarDate(entriesData?.entries ?? [], dateField);

    entrySections.forEach((section) => {
      const sectionType = getEntryDateSectionType(section.date);
      const sectionTitle =
        sectionType === 'today'
          ? _(msg`Today`)
          : sectionType === 'yesterday'
            ? _(msg`Yesterday`)
            : formatSectionDate(section.date, i18n.locale);

      rows.push({
        type: 'section',
        key: `section-${section.key}`,
        title: sectionTitle,
      });

      section.entries.forEach((entry, index) => {
        rows.push({
          type: 'entry',
          key: entry.id,
          entry,
          showSeparator: index < section.entries.length - 1,
        });
      });
    });

    return rows;
  }, [_, entriesData?.entries, filters.order, i18n.locale]);

  // Track new entries for animation
  const filtersKey = JSON.stringify(filters ?? {});

  useEffect(() => {
    if (filterKeyRef.current !== filtersKey) {
      filterKeyRef.current = filtersKey;
      previousEntryIdsRef.current = [];
      isRouteChangeRef.current = true;
      setNewEntryMap(new Map());
      setRouteChangeMap(new Map());
      removalTimersRef.current.forEach((timeoutId) => {
        window.clearTimeout(timeoutId);
      });
      removalTimersRef.current.clear();
    }
  }, [filtersKey]);

  useEffect(() => {
    const entries = entriesData?.entries;
    if (!entries) return;

    const nextIds = entries.map((entry) => entry.id);
    const prevIds = previousEntryIdsRef.current;
    previousEntryIdsRef.current = nextIds;

    if (prevIds.length === 0) {
      if (isRouteChangeRef.current) {
        isRouteChangeRef.current = false;
        setRouteChangeMap(new Map(nextIds.map((id, i) => [id, Math.min(i, 10)])));
      }
      return;
    }

    const prevSet = new Set(prevIds);
    const added = nextIds.filter((id) => !prevSet.has(id));
    if (added.length === 0) return;

    setNewEntryMap((current) => {
      const next = new Map(current);
      added.forEach((id, i) => {
        next.set(id, Math.min(i, 8));
      });
      return next;
    });

    added.forEach((id) => {
      const existingTimeout = removalTimersRef.current.get(id);
      if (existingTimeout) {
        window.clearTimeout(existingTimeout);
      }

      const timeoutId = window.setTimeout(() => {
        setNewEntryMap((current) => {
          const next = new Map(current);
          next.delete(id);
          return next;
        });
        removalTimersRef.current.delete(id);
      }, 1600);

      removalTimersRef.current.set(id, timeoutId);
    });
  }, [entriesData?.entries]);

  // Pull-to-refresh effect
  useEffect(() => {
    onPullToRefreshRef.current = onPullToRefresh;
  }, [onPullToRefresh]);

  useEffect(() => {
    if (!isRefreshing && pullRefreshPending) {
      setPullRefreshPending(false);
    }
  }, [isRefreshing, pullRefreshPending]);

  useEffect(() => {
    if (!onPullToRefresh) {
      return;
    }

    const scrollEl = parentRef.current;
    if (!scrollEl) {
      return;
    }

    const scheduleRelease = () => {
      if (pullReleaseTimerRef.current) {
        window.clearTimeout(pullReleaseTimerRef.current);
      }

      pullReleaseTimerRef.current = window.setTimeout(() => {
        releasePullGesture();
      }, PULL_TO_REFRESH_RELEASE_DELAY_MS);
    };

    const onWheel = (event: WheelEvent) => {
      if (event.ctrlKey || event.deltaY === 0 || isRefreshing) {
        return;
      }

      const atTop = scrollEl.scrollTop <= PULL_TO_REFRESH_TOP_TOLERANCE;
      const pullingFromTop = event.deltaY < 0 && (atTop || isPullingRef.current);

      if (pullingFromTop) {
        const dampingFactor =
          1 -
          Math.min(
            0.86,
            (pullDistanceRef.current / PULL_TO_REFRESH_MAX_DISTANCE) * PULL_TO_REFRESH_DAMPING
          );
        const nextDistance =
          pullDistanceRef.current +
          Math.abs(event.deltaY) * PULL_TO_REFRESH_PULL_GAIN * Math.max(0.2, dampingFactor);
        if (!isPullingRef.current) {
          isPullingRef.current = true;
          setIsPulling(true);
        }
        updatePullProgress(nextDistance);
        event.preventDefault();
        scheduleRelease();
        return;
      }

      if (!isPullingRef.current) {
        return;
      }

      const nextDistance =
        pullDistanceRef.current - Math.abs(event.deltaY) * PULL_TO_REFRESH_RELEASE_GAIN;
      updatePullProgress(nextDistance);
      if (nextDistance <= 0) {
        isPullingRef.current = false;
        setIsPulling(false);
      }
      event.preventDefault();
      scheduleRelease();
    };

    scrollEl.addEventListener('wheel', onWheel, { passive: false });
    return () => {
      scrollEl.removeEventListener('wheel', onWheel);
      if (pullReleaseTimerRef.current) {
        window.clearTimeout(pullReleaseTimerRef.current);
        pullReleaseTimerRef.current = null;
      }
      resetPullGesture();
    };
  }, [isRefreshing, onPullToRefresh, releasePullGesture, resetPullGesture, updatePullProgress]);

  // Cleanup timers
  useEffect(() => {
    return () => {
      removalTimersRef.current.forEach((timeoutId) => {
        window.clearTimeout(timeoutId);
      });
      removalTimersRef.current.clear();
      if (scrollStopTimerRef.current) {
        window.clearTimeout(scrollStopTimerRef.current);
        scrollStopTimerRef.current = null;
      }
      if (pullReleaseTimerRef.current) {
        window.clearTimeout(pullReleaseTimerRef.current);
        pullReleaseTimerRef.current = null;
      }
    };
  }, []);

  // Scroll detection for floating filter bar
  useEffect(() => {
    if (!showFloatingFilterBar) return;

    const scrollEl = parentRef.current;
    if (!scrollEl) return;

    const onScroll = () => {
      const nextTop = scrollEl.scrollTop;
      const previousTop = lastScrollTopRef.current;
      const delta = nextTop - previousTop;

      if (Math.abs(delta) >= 2) {
        setListScrolling(true);
        if (scrollStopTimerRef.current) {
          window.clearTimeout(scrollStopTimerRef.current);
        }
        scrollStopTimerRef.current = window.setTimeout(() => {
          setListScrolling(false);
        }, 140);
      }

      lastScrollTopRef.current = nextTop;
    };

    lastScrollTopRef.current = scrollEl.scrollTop;
    scrollEl.addEventListener('scroll', onScroll, { passive: true });

    return () => {
      scrollEl.removeEventListener('scroll', onScroll);
      if (scrollStopTimerRef.current) {
        window.clearTimeout(scrollStopTimerRef.current);
        scrollStopTimerRef.current = null;
      }
    };
  }, [showFloatingFilterBar]);

  // Keyboard navigation (j/k)
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      if (!entriesData?.entries) return;

      const currentIndex = entriesData.entries.findIndex((ent) => ent.id === selectedEntryId);

      if (e.key === 'j') {
        const nextEntry = entriesData.entries[currentIndex + 1];
        if (nextEntry) onEntrySelect?.(nextEntry.id);
      } else if (e.key === 'k') {
        const prevEntry = entriesData.entries[currentIndex - 1];
        if (prevEntry) onEntrySelect?.(prevEntry.id);
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [entriesData, selectedEntryId, onEntrySelect]);

  // Infinite scroll with IntersectionObserver
  useEffect(() => {
    if (!hasNextPage || isFetchingNextPage) return;

    const loadMoreElement = loadMoreRef.current;
    if (!loadMoreElement) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          fetchNextPage();
        }
      },
      {
        root: parentRef.current,
        rootMargin: '200px',
        threshold: 0,
      }
    );

    observer.observe(loadMoreElement);
    return () => observer.disconnect();
  }, [fetchNextPage, hasNextPage, isFetchingNextPage]);

  const handleEntryClick = (entryId: string) => {
    onEntrySelect?.(entryId);
  };

  const handleKeyDown = (entryId: string) => (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onEntrySelect?.(entryId);
    }
  };

  const handleEntryHover = (entryId: string) => {
    prefetchEntry(entryId);
  };

  const handlePlayPodcast = useCallback((entry: Entry, enclosure: Enclosure) => {
    usePlayerStore.getState().play(entry, enclosure);
  }, []);

  const handleDownloadPodcast = useCallback(
    async (entry: Entry, enclosure: Enclosure) => {
      const fileName = buildPodcastDownloadFileName(entry.title, enclosure);
      useUIStore.getState().setDownloadsOpen(true);
      toast.message(_(msg`Downloading`), { description: fileName });

      const result = await commands.downloadFile(enclosure.url, fileName, 'audio');
      if (result.status === 'error') {
        toast.error(_(msg`Download Failed`), { description: result.error });
      }
    },
    [_]
  );

  const skeletonKeys = ['one', 'two', 'three', 'four', 'five', 'six'];
  const showPullIndicator = Boolean(onPullToRefresh) && (isPulling || pullRefreshPending);
  const pullOffset = isPulling
    ? pullDistance
    : pullRefreshPending
      ? PULL_TO_REFRESH_HOLD_DISTANCE
      : 0;
  const pullVisualOffset =
    pullOffset <= PULL_TO_REFRESH_SOFT_LIMIT
      ? pullOffset
      : PULL_TO_REFRESH_SOFT_LIMIT +
        (pullOffset - PULL_TO_REFRESH_SOFT_LIMIT) * PULL_TO_REFRESH_OVERFLOW_DAMPING;
  const pullProgress = Math.min(1, pullVisualOffset / PULL_TO_REFRESH_TRIGGER_DISTANCE);
  const isPullToRefreshActive = isPulling || pullRefreshPending || isRefreshing;
  const activeStickySection = useMemo(() => {
    return (
      listRows.find(
        (row): row is Extract<(typeof listRows)[number], { type: 'section' }> =>
          row.type === 'section' && row.key === activeStickySectionKey
      ) ?? null
    );
  }, [activeStickySectionKey, listRows]);
  const firstSectionKey = useMemo(() => {
    return (
      listRows.find(
        (row): row is Extract<(typeof listRows)[number], { type: 'section' }> =>
          row.type === 'section'
      )?.key ?? null
    );
  }, [listRows]);

  const updateActiveStickySection = useCallback(() => {
    const scrollEl = parentRef.current;
    if (!scrollEl) {
      return;
    }

    const sectionKeys = listRows
      .filter(
        (row): row is Extract<(typeof listRows)[number], { type: 'section' }> =>
          row.type === 'section'
      )
      .map((row) => row.key);

    if (sectionKeys.length === 0) {
      setActiveStickySectionKey(null);
      return;
    }

    const currentScrollTop = scrollEl.scrollTop + 1;
    let nextActiveKey = sectionKeys[0] ?? null;

    for (const key of sectionKeys) {
      const sectionEl = sectionRefs.current.get(key);
      if (!sectionEl) {
        continue;
      }

      if (sectionEl.offsetTop <= currentScrollTop) {
        nextActiveKey = key;
      } else {
        break;
      }
    }

    setActiveStickySectionKey(nextActiveKey);
  }, [listRows]);

  useEffect(() => {
    const scrollEl = parentRef.current;
    if (!scrollEl) {
      return;
    }

    updateActiveStickySection();
    scrollEl.addEventListener('scroll', updateActiveStickySection, { passive: true });
    window.addEventListener('resize', updateActiveStickySection);

    return () => {
      scrollEl.removeEventListener('scroll', updateActiveStickySection);
      window.removeEventListener('resize', updateActiveStickySection);
    };
  }, [updateActiveStickySection]);

  if (isLoading) {
    return (
      <div className="relative h-full">
        <div className="space-y-3 p-4">
          {skeletonKeys.map((key) => (
            <div
              key={`entry-skeleton-${key}`}
              className="flex gap-4 rounded-lg border border-border/50 bg-muted/20 p-4"
            >
              <div className="flex-1 space-y-2">
                <Skeleton className="h-5 w-3/4" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-1/2" />
              </div>
              <Skeleton className="h-20 w-20 shrink-0 rounded-md" />
            </div>
          ))}
        </div>
        {showFloatingFilterBar && currentStatus && onStatusChange && (
          <EntryListFloatingFilterBar
            currentStatus={currentStatus}
            onStatusChange={onStatusChange}
            visible
          />
        )}
      </div>
    );
  }

  if (error) {
    return (
      <div className="relative h-full">
        <div className="flex flex-col items-center justify-center gap-3 p-8 text-center">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-destructive/10">
            <HugeiconsIcon icon={Alert01Icon} className="h-5 w-5 text-destructive" />
          </div>
          <div className="space-y-1">
            <p className="text-sm font-medium text-destructive">{_(msg`Failed to load entries`)}</p>
            <p className="text-xs text-muted-foreground">
              {_(msg`Check your connection and try again`)}
            </p>
          </div>
        </div>
        {showFloatingFilterBar && currentStatus && onStatusChange && (
          <EntryListFloatingFilterBar
            currentStatus={currentStatus}
            onStatusChange={onStatusChange}
            visible
          />
        )}
      </div>
    );
  }

  if (!entriesData?.entries?.length) {
    return (
      <div className="relative h-full">
        <div className="flex flex-col items-center justify-center gap-3 p-8 pt-24 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
            <HugeiconsIcon icon={InboxIcon} className="h-6 w-6 text-muted-foreground/60" />
          </div>
          <div className="space-y-1">
            <p className="text-sm font-medium text-muted-foreground">{_(msg`No entries found`)}</p>
            <p className="text-xs text-muted-foreground/60">
              {_(msg`Try changing the filter or syncing new content`)}
            </p>
          </div>
        </div>
        {showFloatingFilterBar && currentStatus && onStatusChange && (
          <EntryListFloatingFilterBar
            currentStatus={currentStatus}
            onStatusChange={onStatusChange}
            visible
          />
        )}
      </div>
    );
  }

  return (
    <div className="relative h-full min-h-0 overflow-hidden">
      <div className="mx-auto flex h-full min-h-0 w-full max-w-[822px] flex-col">
        {activeStickySection && !isPullToRefreshActive ? (
          <div
            data-testid="entry-list-sticky-shell"
            className="pointer-events-none relative z-25 shrink-0 overflow-hidden bg-transparent text-foreground"
            style={{
              height: SECTION_HEADER_HEIGHT,
            }}
          >
            <div className="relative h-full w-full px-2 py-2">
              <div
                data-testid="entry-list-section-mask"
                className="pointer-events-none absolute inset-0"
                style={{
                  // biome-ignore lint/style/useNamingConvention: WebKit vendor-prefixed CSS property
                  WebkitMaskImage:
                    'linear-gradient(to bottom, rgba(0, 0, 0, 1) 0%, rgba(0, 0, 0, 0.98) 62%, rgba(0, 0, 0, 0.7) 82%, rgba(0, 0, 0, 0) 100%)',
                  maskImage:
                    'linear-gradient(to bottom, rgba(0, 0, 0, 1) 0%, rgba(0, 0, 0, 0.98) 62%, rgba(0, 0, 0, 0.7) 82%, rgba(0, 0, 0, 0) 100%)',
                }}
                aria-hidden="true"
              />
              <AnimatePresence mode="wait" initial={false}>
                <motion.h2
                  key={activeStickySection.key}
                  data-testid="entry-list-sticky-title"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
                  className="relative px-1 text-[0.68rem] font-semibold tracking-[0.1em] text-foreground/92 uppercase drop-shadow-[0_1px_8px_rgba(0,0,0,0.42)]"
                >
                  {activeStickySection.title}
                </motion.h2>
              </AnimatePresence>
            </div>
          </div>
        ) : null}

        <div
          ref={parentRef}
          data-testid="entry-list-scroll-container"
          className={cn(
            'min-h-0 flex-1 overflow-y-auto overflow-x-hidden pb-3',
            showFloatingFilterBar && 'pb-20'
          )}
        >
          {onPullToRefresh && (
            <div
              className="pointer-events-none sticky top-0 z-20 flex items-center justify-center"
              style={{
                height: showPullIndicator ? `${pullVisualOffset}px` : '0px',
                transition: isPulling
                  ? 'height 72ms linear'
                  : 'height 280ms cubic-bezier(0.175, 0.885, 0.32, 1.08)',
              }}
            >
              <div
                className="flex size-7 items-center justify-center rounded-full bg-popover/65 ring-1 ring-foreground/10 shadow-lg backdrop-blur-2xl backdrop-saturate-150"
                style={{
                  transform: `scale(${showPullIndicator ? 1 : 0.5})`,
                  opacity: showPullIndicator ? pullProgress : 0,
                  transition: isPulling
                    ? 'transform 72ms linear, opacity 90ms linear'
                    : 'transform 280ms cubic-bezier(0.175, 0.885, 0.32, 1.08), opacity 220ms ease',
                }}
              >
                <HugeiconsIcon
                  icon={Refresh04Icon}
                  className={cn(
                    'h-3.5 w-3.5 text-muted-foreground transition-[color] duration-200',
                    (isRefreshing || pullRefreshPending) && 'animate-spin',
                    pullReady && !isRefreshing && !pullRefreshPending && 'text-foreground'
                  )}
                  style={
                    isRefreshing || pullRefreshPending
                      ? undefined
                      : {
                          transform: `rotate(${Math.round(pullProgress * 260)}deg)`,
                        }
                  }
                />
              </div>
            </div>
          )}
          <div
            style={{
              transform: pullOffset > 0 ? `translateY(${pullVisualOffset}px)` : undefined,
              transition: isPulling
                ? 'transform 72ms linear'
                : 'transform 280ms cubic-bezier(0.175, 0.885, 0.32, 1.08)',
            }}
          >
            <>
              {listRows.map((row) => {
                if (row.type === 'section') {
                  if (row.key === firstSectionKey) {
                    return null;
                  }

                  return (
                    <div
                      key={row.key}
                      data-section-key={row.key}
                      ref={(node) => {
                        if (node) {
                          sectionRefs.current.set(row.key, node);
                        } else {
                          sectionRefs.current.delete(row.key);
                        }
                      }}
                      className="relative bg-transparent"
                    >
                      <div className="px-2 pt-2 pb-2">
                        <h2 className="px-1 text-[0.68rem] font-semibold tracking-[0.1em] text-foreground/70 uppercase">
                          {row.title}
                        </h2>
                      </div>
                    </div>
                  );
                }

                const entry = row.entry;
                const isNew = newEntryMap.has(entry.id);
                const staggerIndex = newEntryMap.get(entry.id) ?? 0;
                const routeChangeIndex = routeChangeMap.get(entry.id);
                const thumbnailUrl = extractThumbnail(entry);
                const podcastEnclosure = getPodcastEnclosure(entry);
                const podcastDuration = podcastEnclosure?.length
                  ? formatDuration(Number(podcastEnclosure.length))
                  : null;

                return (
                  <NewEntryAnimationWrapper
                    key={entry.id}
                    isNew={isNew}
                    staggerIndex={staggerIndex}
                    routeChangeIndex={routeChangeIndex}
                  >
                    <button
                      type="button"
                      onClick={() => handleEntryClick(entry.id)}
                      onKeyDown={handleKeyDown(entry.id)}
                      onMouseEnter={() => handleEntryHover(entry.id)}
                      className="w-full cursor-pointer border-none bg-transparent text-left focus:outline-none"
                    >
                      <Item
                        variant={selectedEntryId === entry.id ? 'outline' : 'default'}
                        className={cn(
                          'relative group p-4 transition-all duration-300 ease-out',
                          'hover:border-border/50 hover:bg-black/[0.04] dark:hover:bg-white/[0.07]',
                          selectedEntryId === entry.id &&
                            'bg-black/[0.06] dark:bg-white/10 shadow-md',
                          isNew && 'border-primary/50 bg-primary/5 ring-1 ring-primary/20'
                        )}
                      >
                        <ItemHeader>
                          <div className="flex w-full items-center justify-between gap-2 text-xs text-muted-foreground/60">
                            <div className="flex min-w-0 items-center gap-2">
                              {entry.feed.site_url && (
                                <FeedAvatar
                                  className="size-4!"
                                  domain={entry.feed.site_url}
                                  title={entry.feed.title}
                                />
                              )}
                              <span className="max-w-[120px] truncate">{entry.feed.title}</span>
                            </div>
                            <div className="flex shrink-0 items-center gap-2">
                              {podcastEnclosure ? (
                                <div className="flex items-center gap-1">
                                  <button
                                    type="button"
                                    className="inline-flex size-5 cursor-pointer items-center justify-center rounded-full border-none bg-transparent p-0 text-muted-foreground/80 transition-colors hover:bg-black/[0.06] dark:hover:bg-white/10 hover:text-foreground"
                                    title={_(msg`Download`)}
                                    data-testid="podcast-indicator-download"
                                    onClick={(event) => {
                                      event.preventDefault();
                                      event.stopPropagation();
                                      handleDownloadPodcast(entry, podcastEnclosure);
                                    }}
                                  >
                                    <HugeiconsIcon icon={Download01Icon} className="size-3" />
                                  </button>
                                  <button
                                    type="button"
                                    className="inline-flex size-5 cursor-pointer items-center justify-center rounded-full border-none bg-transparent p-0 text-muted-foreground/80 transition-colors hover:bg-black/[0.06] dark:hover:bg-white/10 hover:text-foreground"
                                    title={_(msg`Play`)}
                                    data-testid="podcast-indicator-play"
                                    onClick={(event) => {
                                      event.preventDefault();
                                      event.stopPropagation();
                                      handlePlayPodcast(entry, podcastEnclosure);
                                    }}
                                  >
                                    <HugeiconsIcon icon={PlayIcon} className="size-3" />
                                  </button>
                                  <button
                                    type="button"
                                    className="inline-flex size-5 cursor-pointer items-center justify-center rounded-full border-none bg-transparent p-0 text-muted-foreground/80 transition-colors hover:bg-black/[0.06] dark:hover:bg-white/10 hover:text-foreground"
                                    title={_(msg`Add to playlist`)}
                                    data-testid="podcast-indicator-queue"
                                    onClick={(event) => {
                                      event.preventDefault();
                                      event.stopPropagation();
                                      usePlayerStore.getState().addToQueue(entry, podcastEnclosure);
                                      toast.message(_(msg`Added to playlist`), {
                                        description: entry.title,
                                      });
                                    }}
                                  >
                                    <HugeiconsIcon icon={Playlist03Icon} className="size-3" />
                                  </button>
                                  <span
                                    className="flex items-center gap-1"
                                    data-testid="podcast-indicator"
                                  >
                                    <HugeiconsIcon icon={HeadphonesIcon} className="size-3" />
                                    {podcastDuration || _(msg`Podcast`)}
                                  </span>
                                </div>
                              ) : (
                                entry.reading_time && (
                                  <span>{_(msg`${entry.reading_time} min read`)}</span>
                                )
                              )}
                              <span className="text-border">•</span>
                              <span className="text-xs text-muted-foreground/70">
                                {formatEntryTime(entry.published_at, use24h)}
                              </span>
                              {entry.status === 'unread' && (
                                <div className="h-2.5 w-2.5 rounded-full bg-primary/70 shadow-sm" />
                              )}
                            </div>
                          </div>
                        </ItemHeader>
                        <ItemContent className="basis-full min-w-0 space-y-1">
                          <ItemTitle
                            className={cn(
                              'line-clamp-2 w-full break-words font-semibold text-base leading-snug tracking-tight transition-colors',
                              entry.status === 'unread'
                                ? 'text-foreground'
                                : 'text-muted-foreground'
                            )}
                          >
                            {entry.title}
                          </ItemTitle>

                          {thumbnailUrl && (
                            <div className="relative mt-3 h-32 w-full shrink-0 overflow-hidden rounded-lg border border-border/30 bg-muted">
                              <img
                                src={thumbnailUrl}
                                alt=""
                                className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-105"
                                loading="lazy"
                              />
                            </div>
                          )}

                          <ItemDescription className="mt-3 line-clamp-3 break-all">
                            {entry.content
                              ?.replace(/<[^>]*>/g, '')
                              .replace(/&nbsp;/g, ' ')
                              .replace(/\s+/g, ' ')
                              .trim()}
                          </ItemDescription>
                        </ItemContent>

                        <ItemActions></ItemActions>
                      </Item>
                    </button>

                    {row.showSeparator && <div className="my-2" />}
                  </NewEntryAnimationWrapper>
                );
              })}
            </>

            <div ref={loadMoreRef} className="h-4" />

            {isFetchingNextPage && (
              <div className="space-y-3 px-3">
                {[1, 2, 3].map((i) => (
                  <div
                    key={`loading-skeleton-${i}`}
                    className="flex gap-4 rounded-lg border border-border/50 bg-muted/20 p-4"
                  >
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-4 w-24" />
                      <Skeleton className="h-5 w-3/4" />
                      <Skeleton className="h-4 w-full" />
                      <Skeleton className="h-4 w-2/3" />
                    </div>
                    <Skeleton className="h-20 w-20 shrink-0 rounded-md" />
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {showFloatingFilterBar && currentStatus && onStatusChange && (
        <EntryListFloatingFilterBar
          currentStatus={currentStatus}
          onStatusChange={onStatusChange}
          visible
          scrolling={listScrolling}
        />
      )}
    </div>
  );
}

export type { EntryListFilterStatus };
