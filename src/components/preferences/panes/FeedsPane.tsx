import { Add01Icon, RefreshIcon, Search01Icon } from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react';
import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import type { ColumnDef } from '@tanstack/react-table';
import { Button } from '@/components/ui/button';
import { DataTable } from '@/components/ui/data-table';
import { Input } from '@/components/ui/input';
import type { Feed } from '@/lib/tauri-bindings';
import { cn } from '@/lib/utils';

interface FeedsPaneProps {
  feeds: Feed[];
  filteredFeeds: Feed[];
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onAddFeed: () => void;
  onRefreshAll: () => void;
  isRefreshingAll: boolean;
  columns: ColumnDef<Feed>[];
}

export function FeedsPane({
  feeds,
  filteredFeeds,
  searchQuery,
  onSearchChange,
  onAddFeed,
  onRefreshAll,
  isRefreshingAll,
  columns,
}: FeedsPaneProps) {
  const { _ } = useLingui();

  return (
    <section className="min-w-0 space-y-3">
      <div className="flex items-center gap-2">
        <div className="relative min-w-0 flex-1">
          <HugeiconsIcon
            icon={Search01Icon}
            className="pointer-events-none absolute left-2.5 top-2.5 size-4 text-muted-foreground"
          />
          <Input
            value={searchQuery}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder={_(msg`Search feeds...`)}
            className="h-9 w-full pl-9"
          />
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button size="lg" variant="outline" onClick={onRefreshAll} disabled={isRefreshingAll}>
            <HugeiconsIcon
              icon={RefreshIcon}
              className={cn('mr-1.5 size-4', isRefreshingAll && 'animate-spin')}
            />
            {isRefreshingAll ? _(msg`Refreshing...`) : _(msg`Refresh all`)}
          </Button>
          <Button size="lg" variant="outline" onClick={onAddFeed}>
            <HugeiconsIcon icon={Add01Icon} className="mr-1.5 size-4" />
            {_(msg`Add feed`)}
          </Button>
        </div>
      </div>
      <div className="min-w-0 space-y-2">
        {feeds.length === 0 ? (
          <div className="text-sm text-muted-foreground">{_(msg`No feeds yet`)}</div>
        ) : filteredFeeds.length === 0 ? (
          <div className="text-sm text-muted-foreground">{_(msg`No feeds found`)}</div>
        ) : (
          <DataTable columns={columns} data={filteredFeeds} />
        )}
      </div>
    </section>
  );
}
