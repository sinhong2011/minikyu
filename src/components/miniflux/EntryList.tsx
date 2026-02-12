import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { defaultRangeExtractor, type Range, useVirtualizer } from '@tanstack/react-virtual';
import { format } from 'date-fns';
import { motion } from 'motion/react';
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
}

type EntryListRow =
  | {
      type: 'section';
      key: string;
      title: string;
    }
  | {
      type: 'entry';
      key: string;
      entry: Entry;
      showSeparator: boolean;
    };

export function EntryList({
  filters = {},
  selectedEntryId,
  onEntrySelect,
  currentStatus,
  onStatusChange,
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
  const selectionMode = useUIStore((state) => state.selectionMode);
  const [newEntryIds, setNewEntryIds] = useState<Set<string>>(() => new Set());
  const [listScrolling, setListScrolling] = useState(false);
  const showFloatingFilterBar = Boolean(currentStatus && onStatusChange);

  const parentRef = useRef<HTMLDivElement>(null);
  const previousEntryIdsRef = useRef<string[]>([]);
  const filterKeyRef = useRef<string>('');
  const removalTimersRef = useRef<Map<string, number>>(new Map());
  const lastScrollTopRef = useRef(0);
  const scrollStopTimerRef = useRef<number | null>(null);
  const activeStickyIndexRef = useRef(0);

  // Build list rows with section headers
  const listRows = useMemo(() => {
    const rows: EntryListRow[] = [];
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

  // Track which rows are sticky section headers
  const stickyIndexes = useMemo(
    () =>
      listRows.flatMap((row, index) => {
        return row.type === 'section' ? [index] : [];
      }),
    [listRows]
  );

  // Range extractor: ensures active sticky header stays in viewport
  const rangeExtractor = useCallback(
    (range: Range) => {
      if (stickyIndexes.length === 0) {
        return defaultRangeExtractor(range);
      }

      activeStickyIndexRef.current =
        [...stickyIndexes].reverse().find((index) => range.startIndex >= index) ??
        stickyIndexes[0] ??
        0;

      const next = new Set([activeStickyIndexRef.current, ...defaultRangeExtractor(range)]);
      return [...next].sort((a, b) => a - b);
    },
    [stickyIndexes]
  );

  const estimateEntrySize = (index: number) => {
    const row = listRows[index];
    if (!row) return 200;

    if (row.type === 'section') {
      return 28;
    }

    const entry = row.entry;

    const hasThumbnail = Boolean(extractThumbnail(entry));
    const heightWithThumbnail = 320;
    const heightWithoutThumbnail = 190;

    return hasThumbnail ? heightWithThumbnail : heightWithoutThumbnail;
  };

  // Virtualizer configuration
  const virtualizer = useVirtualizer({
    count: listRows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: estimateEntrySize,
    overscan: 5,
    rangeExtractor,
  });

  const virtualItems = virtualizer.getVirtualItems();

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
    };
  }, []);

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

  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        selectionMode
      ) {
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
  }, [entriesData, selectedEntryId, onEntrySelect, selectionMode]);

  useEffect(() => {
    if (!hasNextPage || isFetchingNextPage || listRows.length === 0) {
      return;
    }

    const lastVisibleItem = virtualItems[virtualItems.length - 1];
    if (!lastVisibleItem) {
      return;
    }

    const prefetchThreshold = 6;
    if (lastVisibleItem.index >= listRows.length - prefetchThreshold) {
      fetchNextPage();
    }
  }, [fetchNextPage, hasNextPage, isFetchingNextPage, listRows.length, virtualItems]);

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
          contain: 'strict',
          maxWidth: '822px',
        }}
      >
        <div
          style={{
            height: `${virtualizer.getTotalSize()}px`,
            width: '100%',
            position: 'relative',
          }}
        >
          {virtualItems.map((virtualItem) => {
            const row = listRows[virtualItem.index];
            if (!row) return null;

            if (row.type === 'section') {
              const isActiveSticky = activeStickyIndexRef.current === virtualItem.index;
              return (
                <motion.div
                  key={row.key}
                  data-index={virtualItem.index}
                  ref={virtualizer.measureElement}
                  className="py-0"
                  style={{
                    position: isActiveSticky ? 'sticky' : 'absolute',
                    top: isActiveSticky ? 0 : virtualItem.start,
                    left: 0,
                    width: '100%',
                    zIndex: isActiveSticky ? 20 : 'auto',
                  }}
                  animate={{
                    opacity: isActiveSticky ? 1 : 0.6,
                    scale: isActiveSticky ? 1 : 0.98,
                  }}
                  transition={{
                    duration: 0.15,
                    ease: 'easeOut',
                  }}
                >
                  <div className="rounded-lg bg-background px-2 pt-2 pb-2 transition-colors duration-200">
                    <h2 className="px-1 text-[0.68rem] font-semibold tracking-[0.1em] text-muted-foreground/75 uppercase">
                      {row.title}
                    </h2>
                  </div>
                </motion.div>
              );
            }

            const entry = row.entry;
            const isNew = newEntryIds.has(entry.id);

            return (
              <motion.div
                key={entry.id}
                data-index={virtualItem.index}
                ref={virtualizer.measureElement}
                className="px-3"
                style={{
                  position: 'absolute',
                  top: virtualItem.start,
                  left: 0,
                  width: '100%',
                }}
                initial={isNew ? { opacity: 0, y: -6 } : false}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2, ease: 'easeOut' }}
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
                      selectionMode && 'pl-12',
                      isNew && 'border-primary/40 bg-primary/5'
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

                      {extractThumbnail(entry) && (
                        <div className="relative mt-3 h-32 w-full shrink-0 overflow-hidden rounded-lg border border-border/30 bg-muted">
                          <img
                            src={extractThumbnail(entry) ?? ''}
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
        </div>
      </div>
      {isFetchingNextPage && (
        <div className="px-4 pb-3 text-xs text-muted-foreground">{_(msg`Loading...`)}</div>
      )}
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
