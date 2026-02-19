import { Refresh04Icon } from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react';
import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { format } from 'date-fns';
import { AnimatePresence, motion } from 'motion/react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FeedAvatar } from '@/components/miniflux';
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemHeader,
  ItemTitle,
} from '@/components/ui/item';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { extractThumbnail } from '@/lib/media-utils';
import {
  formatEntryTime,
  getEntryDateSectionType,
  groupEntriesByCalendarDate,
} from '@/lib/miniflux-utils';
import type { Entry, EntryFilters } from '@/lib/tauri-bindings';
import { cn } from '@/lib/utils';
import { useEntries, usePrefetchEntry } from '@/services/miniflux';
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

// Estimated heights for content-visibility
const ENTRY_ESTIMATED_HEIGHT = 200;
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
  const { _ } = useLingui();
  const {
    data: entriesData,
    isLoading,
    error,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useEntries(filters);
  const prefetchEntry = usePrefetchEntry();
  const [newEntryIds, setNewEntryIds] = useState<Set<string>>(() => new Set());
  const [listScrolling, setListScrolling] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);
  const [pullReady, setPullReady] = useState(false);
  const [isPulling, setIsPulling] = useState(false);
  const [pullRefreshPending, setPullRefreshPending] = useState(false);
  const showFloatingFilterBar = Boolean(currentStatus && onStatusChange);

  const parentRef = useRef<HTMLDivElement>(null);
  const loadMoreRef = useRef<HTMLDivElement>(null);
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
    const entrySections = groupEntriesByCalendarDate(entriesData?.entries ?? []);

    entrySections.forEach((section) => {
      const sectionType = getEntryDateSectionType(section.date);
      const sectionTitle =
        sectionType === 'today'
          ? _(msg`Today`)
          : sectionType === 'yesterday'
            ? _(msg`Yesterday`)
            : format(section.date, 'EEEE, MMMM d, yyyy');

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
  }, [_, entriesData?.entries]);

  // Track new entries for animation
  const filtersKey = JSON.stringify(filters ?? {});

  useEffect(() => {
    if (filterKeyRef.current !== filtersKey) {
      filterKeyRef.current = filtersKey;
      previousEntryIdsRef.current = [];
      setNewEntryIds(new Set());
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
      return;
    }

    const prevSet = new Set(prevIds);
    const added = nextIds.filter((id) => !prevSet.has(id));
    if (added.length === 0) return;

    setNewEntryIds((current) => {
      const next = new Set(current);
      added.forEach((id) => {
        next.add(id);
      });
      return next;
    });

    added.forEach((id) => {
      const existingTimeout = removalTimersRef.current.get(id);
      if (existingTimeout) {
        window.clearTimeout(existingTimeout);
      }

      const timeoutId = window.setTimeout(() => {
        setNewEntryIds((current) => {
          const next = new Set(current);
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
  const pullLabel =
    isRefreshing || pullRefreshPending
      ? _(msg`Refreshing...`)
      : pullReady
        ? _(msg`Release to refresh`)
        : _(msg`Pull to refresh`);

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
        <div className="p-4 text-destructive">{_(msg`Failed to load entries`)}</div>
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
        <div className="p-4 text-muted-foreground">{_(msg`No entries found`)}</div>
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
    <div className="relative h-full">
      <div
        ref={parentRef}
        className={cn('mx-auto h-full w-full overflow-auto pb-3', showFloatingFilterBar && 'pb-20')}
        style={{
          maxWidth: '822px',
        }}
      >
        {onPullToRefresh && (
          <>
            <div
              className="pointer-events-none sticky top-0 z-20 bg-background"
              style={{
                height: showPullIndicator ? `${pullVisualOffset}px` : '0px',
                transition: isPulling
                  ? 'height 72ms linear'
                  : 'height 280ms cubic-bezier(0.175, 0.885, 0.32, 1.08)',
              }}
            />
            <div className="pointer-events-none sticky top-0 z-30 flex h-0 justify-center overflow-visible">
              <div
                className={cn(
                  'inline-flex items-center gap-2 rounded-full bg-background/90 px-3 py-1.5 text-xs text-muted-foreground shadow-sm backdrop-blur-sm',
                  pullReady && !isRefreshing && !pullRefreshPending && 'text-foreground'
                )}
                style={{
                  transform: `translateY(${Math.max(0, pullVisualOffset - 24)}px) scale(${
                    showPullIndicator ? 1 : 0.95
                  })`,
                  opacity: showPullIndicator ? 1 : 0,
                  transition: isPulling
                    ? 'transform 72ms linear, opacity 90ms linear'
                    : 'transform 280ms cubic-bezier(0.175, 0.885, 0.32, 1.08), opacity 220ms ease',
                }}
              >
                <HugeiconsIcon
                  icon={Refresh04Icon}
                  className={cn(
                    'h-3.5 w-3.5 transition-transform duration-200',
                    (isRefreshing || pullRefreshPending) && 'animate-spin'
                  )}
                  style={
                    isRefreshing || pullRefreshPending
                      ? undefined
                      : {
                          transform: `rotate(${Math.round(pullProgress * 260)}deg)`,
                        }
                  }
                />
                <span>{pullLabel}</span>
              </div>
            </div>
          </>
        )}

        <div
          style={{
            transform: pullOffset > 0 ? `translateY(${pullVisualOffset}px)` : undefined,
            transition: isPulling
              ? 'transform 72ms linear'
              : 'transform 280ms cubic-bezier(0.175, 0.885, 0.32, 1.08)',
          }}
        >
          <AnimatePresence mode="popLayout">
            {listRows.map((row) => {
              if (row.type === 'section') {
                return (
                  <div
                    key={row.key}
                    className="sticky top-0 z-10 bg-background"
                    style={{
                      contentVisibility: 'auto',
                      containIntrinsicSize: `${SECTION_HEADER_HEIGHT}px`,
                    }}
                  >
                    <div className="px-2 pt-2 pb-2">
                      <h2 className="px-1 text-[0.68rem] font-semibold tracking-[0.1em] text-muted-foreground/75 uppercase">
                        {row.title}
                      </h2>
                    </div>
                  </div>
                );
              }

              const entry = row.entry;
              const isNew = newEntryIds.has(entry.id);
              const thumbnailUrl = extractThumbnail(entry);

              return (
                <motion.div
                  key={entry.id}
                  className="px-3"
                  layout
                  initial={isNew ? { opacity: 0, y: -16, scale: 0.98 } : { opacity: 0, y: 12 }}
                  whileInView={{ opacity: 1, y: 0, scale: 1 }}
                  viewport={{ once: true, margin: '-50px' }}
                  exit={{ opacity: 0, y: -8, scale: 0.98 }}
                  transition={{
                    duration: isNew ? 0.35 : 0.25,
                    ease: [0.4, 0, 0.2, 1],
                  }}
                  style={{
                    contentVisibility: 'auto',
                    containIntrinsicSize: `${ENTRY_ESTIMATED_HEIGHT}px`,
                  }}
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
                        'hover:border-border/50 hover:bg-accent/40',
                        selectedEntryId === entry.id && 'bg-accent shadow-md',
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
                            {entry.reading_time && <span>{entry.reading_time} min</span>}
                            <span className="text-border">•</span>
                            <span className="text-xs text-muted-foreground/70">
                              {formatEntryTime(entry.published_at)}
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
                            entry.status === 'unread' ? 'text-foreground' : 'text-muted-foreground'
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

                        <ItemDescription className="mt-3 line-clamp-3 break-all whitespace-pre-wrap">
                          {entry.content?.replace(/<[^>]*>/g, '')}
                        </ItemDescription>
                      </ItemContent>

                      <ItemActions></ItemActions>
                    </Item>
                  </button>

                  {row.showSeparator && <Separator className="my-2" />}
                </motion.div>
              );
            })}
          </AnimatePresence>

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
