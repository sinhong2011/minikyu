import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { useEffect, useRef } from 'react';
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
import { formatRelativeTime } from '@/lib/miniflux-utils';
import type { EntryFilters } from '@/lib/tauri-bindings';
import { cn } from '@/lib/utils';
import { useEntries, usePrefetchEntry } from '@/services/miniflux';
import { useUIStore } from '@/store/ui-store';

interface EntryListProps {
  filters?: EntryFilters;
  selectedEntryId?: string;
  onEntrySelect?: (entryId: string) => void;
}

export function EntryList({ filters = {}, selectedEntryId, onEntrySelect }: EntryListProps) {
  const { _ } = useLingui();
  const { data: entriesData, isLoading, error } = useEntries(filters);
  const prefetchEntry = usePrefetchEntry();
  const selectionMode = useUIStore((state) => state.selectionMode);

  const parentRef = useRef<HTMLDivElement>(null);

  // Virtualizer configuration
  const virtualizer = useVirtualizer({
    count: entriesData?.entries?.length ?? 0,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 200, // Initial estimate for entry card height
    overscan: 5, // Render 5 extra items above/below viewport
  });

  const virtualItems = virtualizer.getVirtualItems();

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
      <div className="space-y-3 p-4">
        {skeletonKeys.map((key) => (
          <div
            key={`entry-skeleton-${key}`}
            className="flex gap-4 p-4 rounded-lg border border-border/50 bg-muted/20"
          >
            <div className="flex-1 space-y-2">
              <Skeleton className="h-5 w-3/4" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-1/2" />
            </div>
            <Skeleton className="h-20 w-20 rounded-md shrink-0" />
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return <div className="p-4 text-destructive">{_(msg`Failed to load entries`)}</div>;
  }

  if (!entriesData?.entries?.length) {
    return <div className="p-4 text-muted-foreground">{_(msg`No entries found`)}</div>;
  }

  return (
    <div
      ref={parentRef}
      className="h-full overflow-auto py-3 mx-auto w-full"
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
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            transform: `translateY(${virtualItems[0]?.start ?? 0}px)`,
          }}
        >
          {virtualItems.map((virtualItem) => {
            const entry = entriesData.entries?.[virtualItem.index];
            if (!entry) return null;

            return (
              <div key={virtualItem.key} className="px-3">
                <button
                  type="button"
                  onClick={() => handleEntryClick(entry.id)}
                  onKeyDown={handleKeyDown(entry.id)}
                  onMouseEnter={() => handleEntryHover(entry.id)}
                  className="w-full text-left border-none bg-transparent cursor-pointer focus:outline-none"
                >
                  <Item
                    variant={selectedEntryId === entry.id ? 'outline' : 'default'}
                    className={cn(
                      'relative group transition-all duration-300 ease-out p-4',
                      'hover:border-border/50 hover:bg-accent/40',
                      selectedEntryId === entry.id && 'bg-accent shadow-md',

                      selectionMode && 'pl-12'
                    )}
                    ref={virtualizer.measureElement}
                  >
                    <ItemHeader>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground/60 w-full justify-between">
                        <div className="flex gap-2 items-center">
                          {entry.feed.site_url && (
                            <FeedAvatar
                              className="size-4!"
                              domain={entry.feed.site_url}
                              title={entry.feed.title}
                            />
                          )}
                          <span className="truncate max-w-[120px]">{entry.feed.title}</span>
                        </div>
                        <div className="flex gap-2 items-center">
                          {entry.reading_time && <span>{entry.reading_time} min</span>}
                          <span className="text-border">•</span>
                          <span className="text-xs text-muted-foreground/70">
                            {formatRelativeTime(entry.published_at)}
                          </span>
                          {entry.status === 'unread' && (
                            <div className="h-2.5 w-2.5 rounded-full bg-primary/70 shadow-sm" />
                          )}
                        </div>
                      </div>
                    </ItemHeader>
                    <ItemContent className="space-y-1 basis-full">
                      <ItemTitle
                        className={cn(
                          'font-semibold text-base leading-snug tracking-tight transition-colors',
                          entry.status === 'unread' ? 'text-foreground' : 'text-muted-foreground'
                        )}
                      >
                        {entry.title}
                      </ItemTitle>

                      {extractThumbnail(entry) && (
                        <div className="relative w-full h-32 shrink-0 rounded-lg overflow-hidden bg-muted border border-border/30 mt-3">
                          <img
                            src={extractThumbnail(entry) ?? ''}
                            alt=""
                            className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 ease-out group-hover:scale-105"
                            loading="lazy"
                          />
                        </div>
                      )}

                      <ItemDescription className="mt-3">
                        {entry.content?.replace(/<[^>]*>/g, '')}
                      </ItemDescription>
                    </ItemContent>

                    <ItemActions></ItemActions>
                  </Item>
                </button>

                {virtualItem.index < (entriesData.entries?.length ?? 0) - 1 && (
                  <Separator className="my-2" />
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
