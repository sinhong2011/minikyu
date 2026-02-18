import {
  Add01Icon,
  AlertCircleIcon,
  Delete02Icon,
  Edit02Icon,
  FileDownloadIcon,
  FileUploadIcon,
  RefreshIcon,
  Search01Icon,
} from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react';
import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { Button } from '@/components/ui/button';
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
  onEditFeed: (feed: Feed) => void;
  onDeleteFeed: (feed: Feed) => void;
  onRefreshAll: () => void;
  onExportOpml: () => void;
  onImportOpml: () => void;
  isRefreshingAll: boolean;
}

function formatRelativeTime(dateString: string | null | undefined): string {
  if (!dateString) return '';

  try {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  } catch {
    return '';
  }
}

export function FeedsPane({
  feeds,
  filteredFeeds,
  searchQuery,
  onSearchChange,
  onAddFeed,
  onEditFeed,
  onDeleteFeed,
  onRefreshAll,
  onExportOpml,
  onImportOpml,
  isRefreshingAll,
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
          <div className="space-y-1">
            {filteredFeeds.map((feed) => {
              const hasError = (feed.parsing_error_count ?? 0) > 0;
              const checkedTime = formatRelativeTime(feed.checked_at);

              return (
                <div
                  key={feed.id}
                  className={cn(
                    'flex min-w-0 items-center gap-3 rounded-md border px-3 py-2',
                    hasError && 'border-destructive/50 bg-destructive/5'
                  )}
                >
                  {/* Feed Info */}
                  <div className="min-w-0 flex-1 overflow-hidden">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-sm font-medium">{feed.title}</span>
                      {feed.disabled && (
                        <span className="text-xs text-muted-foreground">(disabled)</span>
                      )}
                    </div>
                    <span className="block truncate text-xs text-muted-foreground">
                      {feed.feed_url}
                    </span>
                    {hasError && feed.parsing_error_message && (
                      <div className="mt-1 flex items-center gap-1 text-xs text-destructive">
                        <HugeiconsIcon icon={AlertCircleIcon} className="size-3" />
                        <span className="truncate">{feed.parsing_error_message}</span>
                      </div>
                    )}
                  </div>

                  {/* Category */}
                  <div className="hidden w-32 shrink-0 md:block">
                    {feed.category ? (
                      <span className="truncate text-sm text-muted-foreground">
                        {feed.category.title}
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground italic">
                        {_(msg`Uncategorized`)}
                      </span>
                    )}
                  </div>

                  {/* Last Checked */}
                  <div className="hidden w-20 shrink-0 text-right lg:block">
                    <span className="text-xs text-muted-foreground">{checkedTime}</span>
                  </div>

                  {/* Status indicator */}
                  <div className="hidden w-6 shrink-0 sm:block">
                    {hasError && (
                      <Tooltip>
                        <TooltipTrigger>
                          <HugeiconsIcon
                            icon={AlertCircleIcon}
                            className="size-4 text-destructive"
                          />
                        </TooltipTrigger>
                        <TooltipPanel>
                          {feed.parsing_error_count} {_(msg`error(s)`)}
                        </TooltipPanel>
                      </Tooltip>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex shrink-0 items-center gap-1">
                    <Button size="sm" variant="ghost" onClick={() => onEditFeed(feed)}>
                      <HugeiconsIcon icon={Edit02Icon} className="size-4" />
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => onDeleteFeed(feed)}>
                      <HugeiconsIcon icon={Delete02Icon} className="size-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
