import { Calendar01Icon, Clock01Icon, FilterIcon, Search01Icon } from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react';
import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { Button, buttonVariants } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import type { EntryFilters } from '@/lib/tauri-bindings';
import { cn } from '@/lib/utils';

interface EntryFiltersProps {
  filters: EntryFilters;
  onFiltersChange: (filters: EntryFilters) => void;
  className?: string;
  hideToggleBar?: boolean;
}

export function EntryFiltersUI({
  filters,
  onFiltersChange,
  className,
  hideToggleBar,
}: EntryFiltersProps) {
  const { _ } = useLingui();

  const handleStatusChange = (status: string | null) => {
    onFiltersChange({
      ...filters,
      status: status === 'all' ? null : status,
      starred: status === 'starred' ? true : null,
    });
  };

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onFiltersChange({
      ...filters,
      search: e.target.value || null,
    });
  };

  const currentStatus = filters.starred ? 'starred' : filters.status || 'all';

  return (
    <div className={cn('flex flex-col gap-2 p-2', className)}>
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <HugeiconsIcon
            icon={Search01Icon}
            className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground"
            strokeWidth={2}
          />
          <Input
            placeholder={_(msg`Search entries...`)}
            className="pl-9 h-9"
            value={filters.search || ''}
            onChange={handleSearchChange}
          />
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger
            className={cn(buttonVariants({ variant: 'outline', size: 'icon' }), 'h-9 w-9 shrink-0')}
          >
            <HugeiconsIcon icon={FilterIcon} strokeWidth={2} className="h-4 w-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuLabel>{_(msg`Date Range`)}</DropdownMenuLabel>
            <DropdownMenuItem onClick={() => onFiltersChange({ ...filters, after: null })}>
              <HugeiconsIcon icon={Clock01Icon} className="mr-2 h-4 w-4" strokeWidth={2} />
              {_(msg`Any time`)}
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => {
                const yesterday = Math.floor(Date.now() / 1000) - 86400;
                onFiltersChange({ ...filters, after: yesterday.toString() });
              }}
            >
              <HugeiconsIcon icon={Calendar01Icon} className="mr-2 h-4 w-4" strokeWidth={2} />
              {_(msg`Last 24 hours`)}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {!hideToggleBar && (
        <div className="flex gap-1 overflow-x-auto pb-1 no-scrollbar">
          <Button
            variant={currentStatus === 'all' ? 'secondary' : 'ghost'}
            size="sm"
            className="h-7 text-xs px-2 gap-1"
            onClick={() => handleStatusChange('all')}
          >
            {_(msg`All`)}
          </Button>
          <Button
            variant={currentStatus === 'unread' ? 'secondary' : 'ghost'}
            size="sm"
            className="h-7 text-xs px-2 gap-1"
            onClick={() => handleStatusChange('unread')}
          >
            {_(msg`Unread`)}
          </Button>
          <Button
            variant={currentStatus === 'starred' ? 'secondary' : 'ghost'}
            size="sm"
            className="h-7 text-xs px-2 gap-1"
            onClick={() => handleStatusChange('starred')}
          >
            {_(msg`Starred`)}
          </Button>
        </div>
      )}
    </div>
  );
}
