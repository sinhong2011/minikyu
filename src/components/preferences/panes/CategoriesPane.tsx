import {
  Add01Icon,
  CheckmarkCircle02Icon,
  Delete02Icon,
  Edit02Icon,
  RefreshIcon,
  Search01Icon,
} from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react';
import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tooltip, TooltipPanel, TooltipTrigger } from '@/components/ui/tooltip';
import type { Category } from '@/lib/tauri-bindings';
import { cn } from '@/lib/utils';

interface CategoriesPaneProps {
  categories: Category[];
  filteredCategories: Category[];
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onAddCategory: () => void;
  onEditCategory: (category: Category) => void;
  onDeleteCategory: (category: Category) => void;
  onMarkAsRead: (category: Category) => void;
  onRefreshCategory: (category: Category) => void;
  isRefreshingCategoryId: string | null;
}

export function CategoriesPane({
  categories,
  filteredCategories,
  searchQuery,
  onSearchChange,
  onAddCategory,
  onEditCategory,
  onDeleteCategory,
  onMarkAsRead,
  onRefreshCategory,
  isRefreshingCategoryId,
}: CategoriesPaneProps) {
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
            placeholder={_(msg`Search categories...`)}
            className="h-9 w-full pl-9"
          />
        </div>
        <Tooltip>
          <TooltipTrigger>
            <Button className="h-9" variant="ghost" onClick={onAddCategory}>
              <HugeiconsIcon icon={Add01Icon} className="size-4" />
            </Button>
          </TooltipTrigger>
          <TooltipPanel>{_(msg`Add category`)}</TooltipPanel>
        </Tooltip>
      </div>
      <div className="min-w-0 space-y-2">
        {categories.length === 0 ? (
          <div className="text-sm text-muted-foreground">{_(msg`No categories yet`)}</div>
        ) : filteredCategories.length === 0 ? (
          <div className="text-sm text-muted-foreground">{_(msg`No categories found`)}</div>
        ) : (
          filteredCategories.map((category) => (
            <div
              key={category.id}
              className="flex min-w-0 items-center justify-between rounded-md border px-3 py-2"
            >
              <span className="min-w-0 flex-1 truncate text-sm">{category.title}</span>
              <div className="flex shrink-0 items-center gap-1">
                <Tooltip>
                  <TooltipTrigger>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => onRefreshCategory(category)}
                      disabled={isRefreshingCategoryId === String(category.id)}
                    >
                      <HugeiconsIcon
                        icon={RefreshIcon}
                        className={cn(
                          'size-4',
                          isRefreshingCategoryId === String(category.id) && 'animate-spin'
                        )}
                      />
                    </Button>
                  </TooltipTrigger>
                  <TooltipPanel>
                    {isRefreshingCategoryId === String(category.id)
                      ? _(msg`Refreshing...`)
                      : _(msg`Refresh feeds`)}
                  </TooltipPanel>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger
                    render={
                      <Button size="sm" variant="ghost" onClick={() => onMarkAsRead(category)} />
                    }
                  >
                    <HugeiconsIcon icon={CheckmarkCircle02Icon} className="size-4" />
                  </TooltipTrigger>
                  <TooltipPanel>{_(msg`Mark as read`)}</TooltipPanel>
                </Tooltip>
                <Button size="sm" variant="ghost" onClick={() => onEditCategory(category)}>
                  <HugeiconsIcon icon={Edit02Icon} className="size-4" />
                </Button>
                <Button size="sm" variant="ghost" onClick={() => onDeleteCategory(category)}>
                  <HugeiconsIcon icon={Delete02Icon} className="size-4 text-destructive" />
                </Button>
              </div>
            </div>
          ))
        )}
      </div>
    </section>
  );
}
