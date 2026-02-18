import {
  Add01Icon,
  FileDownloadIcon,
  FileUploadIcon,
  RefreshIcon,
  Search01Icon,
} from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react';
import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import type { ColumnDef } from '@tanstack/react-table';
import { Button } from '@/components/ui/button';
import { DataTable } from '@/components/ui/data-table';
import { Input } from '@/components/ui/input';
import { Tooltip, TooltipPanel, TooltipTrigger } from '@/components/ui/tooltip';
import type { Feed } from '@/lib/tauri-bindings';
import { cn } from '@/lib/utils';

interface FeedsPaneProps {
  feeds: Feed[];
  filteredFeeds: Feed[];
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onAddFeed: () => void;
  onRefreshAll: () => void;
  onExportOpml: () => void;
  onImportOpml: () => void;
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
  onExportOpml,
  onImportOpml,
  isRefreshingAll,
  columns,
}: FeedsPaneProps) {
  const { _ } = useLingui();

  return (
    <section className="min-w-0 space-y-3 p-1">
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
          <Tooltip>
            <TooltipTrigger>
              <Button className="h-9" variant="ghost" onClick={onImportOpml}>
                <HugeiconsIcon icon={FileUploadIcon} className="size-4" />
              </Button>
            </TooltipTrigger>
            <TooltipPanel>{_(msg`Import OPML`)}</TooltipPanel>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger>
              <Button className="h-9" variant="ghost" onClick={onExportOpml}>
                <HugeiconsIcon icon={FileDownloadIcon} className="size-4" />
              </Button>
            </TooltipTrigger>
            <TooltipPanel>{_(msg`Export OPML`)}</TooltipPanel>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger>
              <Button
                className="h-9"
                variant="ghost"
                onClick={onRefreshAll}
                disabled={isRefreshingAll}
              >
                <HugeiconsIcon
                  icon={RefreshIcon}
                  className={cn('size-4', isRefreshingAll && 'animate-spin')}
                />
              </Button>
            </TooltipTrigger>
            <TooltipPanel>
              {isRefreshingAll ? _(msg`Refreshing...`) : _(msg`Refresh all`)}
            </TooltipPanel>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger>
              <Button className="h-9" variant="ghost" onClick={onAddFeed}>
                <HugeiconsIcon icon={Add01Icon} className="size-4" />
              </Button>
            </TooltipTrigger>
            <TooltipPanel>{_(msg`Add feed`)}</TooltipPanel>
          </Tooltip>
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
