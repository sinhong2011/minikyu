import {
  Add01Icon,
  ArrowRight01Icon,
  Calendar01Icon,
  Delete02Icon,
  Folder01Icon,
  MoreVerticalIcon,
  PencilEdit02Icon,
  RefreshIcon,
  RssIcon,
  Search01Icon,
  StarIcon,
  Timer01Icon,
} from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react';
import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { Link } from '@tanstack/react-router';
import * as React from 'react';
import {
  Menu,
  MenuItem,
  MenuPanel,
  MenuTrigger,
} from '@/components/animate-ui/components/base/menu';
import {
  Collapsible,
  CollapsiblePanel,
  CollapsibleTrigger,
  useCollapsible,
} from '@/components/animate-ui/primitives/base/collapsible';
import { AppLogo } from '@/components/brand/AppLogo';
import { FeedAvatar, UserNav } from '@/components/miniflux';
import { FeedCategoryDialogProvider } from '@/components/miniflux/settings/FeedCategoryDialogProvider';
import { useMinifluxSettingsDialogStore } from '@/components/miniflux/settings/store';
import { AnimatedBadge } from '@/components/ui/badge-count';
import { Button } from '@/components/ui/button';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarSeparator,
  useSidebar,
} from '@/components/ui/sidebar';
import type { Category, Feed } from '@/lib/tauri-bindings';
import { cn } from '@/lib/utils';
import {
  useCategories,
  useCategoryFeeds,
  useCategoryUnreadCount,
  useDeleteCategory,
  useDeleteFeed,
  useFeedUnreadCount,
  useIsConnected,
  useSyncMiniflux,
  useUnreadCounts,
} from '@/services/miniflux';
import { useSyncStore } from '@/store/sync-store';

interface AppSidebarProps {
  children?: React.ReactNode;
  className?: string;
}

const categorySkeletonKeys = Array.from({ length: 5 }, (_, index) => `category-skeleton-${index}`);

function CategoryChevron() {
  const { isOpen } = useCollapsible();

  return (
    <HugeiconsIcon
      icon={ArrowRight01Icon}
      className={cn('transition-transform duration-300', isOpen && 'rotate-90')}
    />
  );
}

interface FeedItemProps {
  feed: Feed;
}

function FeedItem({ feed }: FeedItemProps) {
  const { _ } = useLingui();
  const unreadCount = useFeedUnreadCount(Number(feed.id));
  const { mutateAsync: deleteFeed } = useDeleteFeed();
  const setFeedDialogState = useMinifluxSettingsDialogStore((state) => state.setFeedDialogState);

  const handleDelete = async (event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    if (confirm(_(msg`Are you sure you want to unsubscribe from this feed?`))) {
      try {
        await deleteFeed(feed.id);
      } catch {
        // Error toast is handled in mutation hook; prevent unhandled rejections in event handler
      }
    }
  };

  return (
    <SidebarMenuSubItem key={feed.id}>
      <Link to="/" search={{ feedId: feed.id.toString() }} className="block w-full">
        {({ isActive }) => (
          <div className="group/feed-item relative">
            <SidebarMenuSubButton isActive={isActive} className="w-full pr-8">
              <div className="flex w-full min-w-0 items-center gap-2">
                <FeedAvatar className="size-5!" domain={feed.site_url} title={feed.title} />
                <span className="min-w-0 flex-1 truncate text-md">{feed.title}</span>
              </div>
            </SidebarMenuSubButton>
            <div className="pointer-events-none absolute right-2 top-1/2 flex size-6 -translate-y-1/2 items-center justify-center">
              <div className="flex items-center justify-center transition-all duration-200 group-hover/feed-item:scale-50 group-hover/feed-item:opacity-0">
                <AnimatedBadge count={unreadCount} className="text-[12px]" animateOnMount={false} />
              </div>
              <div className="pointer-events-auto absolute inset-0 flex items-center justify-center scale-50 opacity-0 transition-all duration-200 group-hover/feed-item:scale-100 group-hover/feed-item:opacity-100">
                <Menu>
                  <MenuTrigger
                    className="size-6 flex items-center justify-center rounded-md text-sidebar-foreground/70 hover:bg-sidebar-accent-foreground/10 hover:text-sidebar-foreground"
                    onClick={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                    }}
                  >
                    <HugeiconsIcon icon={MoreVerticalIcon} className="size-4" />
                  </MenuTrigger>
                  <MenuPanel side="right" align="start">
                    <MenuItem onClick={() => setFeedDialogState({ mode: 'edit', feed })}>
                      <HugeiconsIcon icon={PencilEdit02Icon} />
                      {_(msg`Edit`)}
                    </MenuItem>
                    <MenuItem variant="destructive" onClick={handleDelete}>
                      <HugeiconsIcon icon={Delete02Icon} />
                      {_(msg`Unsubscribe`)}
                    </MenuItem>
                  </MenuPanel>
                </Menu>
              </div>
            </div>
          </div>
        )}
      </Link>
    </SidebarMenuSubItem>
  );
}

interface CategoryFeedsProps {
  categoryId: string;
}

function CategoryFeeds({ categoryId }: CategoryFeedsProps) {
  const { _ } = useLingui();
  const { data: feeds, isLoading, error } = useCategoryFeeds(categoryId);

  const filteredFeeds = React.useMemo(() => {
    return feeds?.filter((feed) => feed.title.trim().toLowerCase() !== 'all') ?? [];
  }, [feeds]);

  if (isLoading) {
    return (
      <CollapsiblePanel>
        <SidebarMenuSub>
          <SidebarMenuSubItem>
            <div className="ml-4 flex h-7 items-center px-2">
              <div className="bg-muted h-3 w-16 animate-pulse rounded" />
            </div>
          </SidebarMenuSubItem>
        </SidebarMenuSub>
      </CollapsiblePanel>
    );
  }

  if (error) {
    return (
      <CollapsiblePanel>
        <SidebarMenuSub>
          <SidebarMenuSubItem>
            <div className="ml-4 px-2 py-1.5 text-xs text-destructive">
              {_(msg`Failed to load feeds`)}
            </div>
          </SidebarMenuSubItem>
        </SidebarMenuSub>
      </CollapsiblePanel>
    );
  }

  if (filteredFeeds.length === 0) {
    return null;
  }

  return (
    <CollapsiblePanel>
      <SidebarMenuSub className="ml-3.5 mr-0 space-y-1 pl-2.5 pr-0 pt-1">
        {filteredFeeds.map((feed) => (
          <FeedItem key={feed.id} feed={feed} />
        ))}
      </SidebarMenuSub>
    </CollapsiblePanel>
  );
}

interface CategoryItemProps {
  category: Category;
  index: number;
}

function CategoryItem({ category, index }: CategoryItemProps) {
  const { _ } = useLingui();
  const unreadCount = useCategoryUnreadCount(Number(category.id));
  const { mutateAsync: deleteCategory } = useDeleteCategory();
  const setCategoryDialogState = useMinifluxSettingsDialogStore(
    (state) => state.setCategoryDialogState
  );

  const handleDelete = async (event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    if (confirm(_(msg`Are you sure you want to delete this category and all its feeds?`))) {
      try {
        await deleteCategory(category.id);
      } catch {
        // Error toast is handled in mutation hook; prevent unhandled rejections in event handler
      }
    }
  };

  return (
    <Collapsible key={category.id} defaultOpen={index === 0} className="group/collapsible">
      <SidebarMenuItem className="group/category-item relative">
        <Link to="/" search={{ categoryId: category.id.toString() }} className="min-w-0 flex-1">
          {({ isActive }) => (
            <SidebarMenuButton tooltip={category.title} isActive={isActive} className="pl-8 pr-10">
              <span
                className={cn(
                  'truncate transition-colors duration-200',
                  isActive ? 'font-semibold text-sidebar-foreground' : 'text-sidebar-foreground/80'
                )}
              >
                {category.title}
              </span>
            </SidebarMenuButton>
          )}
        </Link>
        <div className="pointer-events-none absolute right-2 top-1.5 flex size-6 items-center justify-center">
          <div className="flex items-center justify-center transition-all duration-200 group-hover/category-item:scale-50 group-hover/category-item:opacity-0">
            <AnimatedBadge count={unreadCount} className="text-[12px]" />
          </div>
          <div className="pointer-events-auto absolute inset-0 flex items-center justify-center scale-50 opacity-0 transition-all duration-200 group-hover/category-item:scale-100 group-hover/category-item:opacity-100">
            <Menu>
              <MenuTrigger
                className="size-6 flex items-center justify-center rounded-md text-sidebar-foreground/70 hover:bg-sidebar-accent-foreground/10 hover:text-sidebar-foreground"
                onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                }}
              >
                <HugeiconsIcon icon={MoreVerticalIcon} className="size-4" />
              </MenuTrigger>
              <MenuPanel side="right" align="start">
                <MenuItem onClick={() => setCategoryDialogState({ mode: 'edit', category })}>
                  <HugeiconsIcon icon={PencilEdit02Icon} />
                  {_(msg`Edit`)}
                </MenuItem>
                <MenuItem variant="destructive" onClick={handleDelete}>
                  <HugeiconsIcon icon={Delete02Icon} />
                  {_(msg`Delete`)}
                </MenuItem>
              </MenuPanel>
            </Menu>
          </div>
        </div>
        <CollapsibleTrigger
          render={
            <SidebarMenuAction
              aria-label={_(msg`Toggle category feeds`)}
              className="left-1 right-auto data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
            />
          }
        >
          <CategoryChevron />
        </CollapsibleTrigger>
        <CategoryFeeds categoryId={category.id} />
      </SidebarMenuItem>
    </Collapsible>
  );
}

function AppSidebarContent({ children, className }: AppSidebarProps) {
  const { _ } = useLingui();
  const { state: sidebarState, setOpen } = useSidebar();
  const { data: isConnected, isLoading: connectionLoading } = useIsConnected();
  const { data: categories, isLoading: categoriesLoading } = useCategories(isConnected ?? false);
  const { data: unreadCounts } = useUnreadCounts();
  const syncMiniflux = useSyncMiniflux();
  const syncing = useSyncStore((state) => state.syncing);
  const setCategoryDialogState = useMinifluxSettingsDialogStore(
    (state) => state.setCategoryDialogState
  );
  const setFeedDialogState = useMinifluxSettingsDialogStore((state) => state.setFeedDialogState);

  const openAddFeedDialog = React.useCallback(
    (initialUrl?: string) => {
      setFeedDialogState({
        mode: 'create',
        defaultCategoryId: null,
        initialFeedUrl: initialUrl?.trim() ?? '',
      });
    },
    [setFeedDialogState]
  );
  const handleSync = React.useCallback(() => {
    if (!isConnected || syncing) {
      return;
    }
    syncMiniflux.mutate();
  }, [isConnected, syncing, syncMiniflux]);
  const handleShowCategories = React.useCallback(() => {
    setOpen(true);
  }, [setOpen]);
  const headerActionButtonClass = 'h-8 w-8';
  const headerRefreshIconClass = 'h-4 w-4';
  const headerAddIconClass = 'h-[18px] w-[18px]';
  const isCollapsed = sidebarState === 'collapsed';

  return (
    <Sidebar
      side="left"
      variant="sidebar"
      collapsible="icon"
      className={cn(className, 'relative h-full')}
    >
      <SidebarHeader className="px-3 py-2 group-data-[collapsible=icon]:px-0">
        <div className="flex items-center gap-2">
          <AppLogo
            className="min-w-0 flex-1 justify-start group-data-[collapsible=icon]:justify-center"
            markClassName="size-7"
            wordmarkClassName="group-data-[collapsible=icon]:hidden"
          />
          <div className="flex items-center gap-1 group-data-[collapsible=icon]:hidden">
            <Button
              variant="ghost"
              size="icon"
              className={headerActionButtonClass}
              onClick={handleSync}
              title={syncing ? _(msg`Syncing...`) : _(msg`Sync`)}
              disabled={!isConnected || syncing}
            >
              <HugeiconsIcon
                icon={RefreshIcon}
                className={cn(headerRefreshIconClass, syncing && 'animate-spin')}
              />
            </Button>
            <Menu>
              <MenuTrigger
                render={
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className={headerActionButtonClass}
                    aria-label={_(msg`Category actions`)}
                    title={_(msg`Category actions`)}
                  />
                }
              >
                <HugeiconsIcon icon={Add01Icon} className={headerAddIconClass} />
              </MenuTrigger>
              <MenuPanel side="bottom" align="end">
                <MenuItem onClick={() => openAddFeedDialog()}>
                  <HugeiconsIcon icon={RssIcon} />
                  {_(msg`Add Feed`)}
                </MenuItem>
                <MenuItem onClick={() => openAddFeedDialog('')}>
                  <HugeiconsIcon icon={Search01Icon} />
                  {_(msg`Search Source`)}
                </MenuItem>
                <MenuItem onClick={() => setCategoryDialogState({ mode: 'create' })}>
                  <HugeiconsIcon icon={Folder01Icon} />
                  {_(msg`Add Category`)}
                </MenuItem>
              </MenuPanel>
            </Menu>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent className="flex min-h-0 flex-col gap-0">
        <SidebarGroup className="sticky top-0 z-10 bg-background">
          <SidebarGroupLabel>{_(msg`Views`)}</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu className="gap-1">
              {connectionLoading ? (
                <SidebarMenuItem>
                  <SidebarMenuButton disabled>
                    <HugeiconsIcon icon={RssIcon} className="animate-pulse" />
                    <span>{_(msg`Loading...`)}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ) : (
                <>
                  <SidebarMenuItem>
                    <Link to="/" activeOptions={{ exact: true }}>
                      {({ isActive }) => (
                        <SidebarMenuButton
                          className="flex"
                          tooltip={_(msg`All`)}
                          isActive={isActive}
                        >
                          <HugeiconsIcon
                            icon={RssIcon}
                            className={cn(
                              'transition-colors duration-200',
                              isActive ? 'text-primary' : 'text-sidebar-foreground/70'
                            )}
                          />
                          <span className={cn(isActive && 'font-semibold text-sidebar-foreground')}>
                            {_(msg`All`)}
                          </span>
                          <SidebarMenuBadge>
                            <AnimatedBadge
                              count={Number(unreadCounts?.total ?? 0)}
                              className="text-[12px]"
                            />
                          </SidebarMenuBadge>
                        </SidebarMenuButton>
                      )}
                    </Link>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <Link to="/" search={{ filter: 'today' }}>
                      {({ isActive }) => (
                        <SidebarMenuButton tooltip={_(msg`Today`)} isActive={isActive}>
                          <HugeiconsIcon
                            icon={Calendar01Icon}
                            className={cn(
                              'transition-colors duration-200',
                              isActive ? 'text-primary' : 'text-sidebar-foreground/70'
                            )}
                          />
                          <span className={cn(isActive && 'font-semibold text-sidebar-foreground')}>
                            {_(msg`Today`)}
                          </span>
                          <SidebarMenuBadge>
                            <AnimatedBadge
                              count={Number(unreadCounts?.today ?? 0)}
                              className="text-[12px]"
                            />
                          </SidebarMenuBadge>
                        </SidebarMenuButton>
                      )}
                    </Link>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <Link to="/" search={{ filter: 'starred' }}>
                      {({ isActive }) => (
                        <SidebarMenuButton tooltip={_(msg`Starred`)} isActive={isActive}>
                          <HugeiconsIcon
                            icon={StarIcon}
                            className={cn(
                              'transition-colors duration-200',
                              isActive ? 'text-primary' : 'text-sidebar-foreground/70'
                            )}
                          />
                          <span className={cn(isActive && 'font-semibold text-sidebar-foreground')}>
                            {_(msg`Starred`)}
                          </span>
                        </SidebarMenuButton>
                      )}
                    </Link>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <Link to="/" search={{ filter: 'history' }}>
                      {({ isActive }) => (
                        <SidebarMenuButton tooltip={_(msg`History`)} isActive={isActive}>
                          <HugeiconsIcon
                            icon={Timer01Icon}
                            className={cn(
                              'transition-colors duration-200',
                              isActive ? 'text-primary' : 'text-sidebar-foreground/70'
                            )}
                          />
                          <span className={cn(isActive && 'font-semibold text-sidebar-foreground')}>
                            {_(msg`History`)}
                          </span>
                        </SidebarMenuButton>
                      )}
                    </Link>
                  </SidebarMenuItem>
                </>
              )}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {isCollapsed && (
          <>
            <SidebarSeparator className="mx-0 sticky top-0 z-10 bg-background" />
            <SidebarGroup className="pt-2">
              <SidebarGroupContent>
                <SidebarMenu className="gap-1">
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      tooltip={_(msg`Browse categories`)}
                      onClick={handleShowCategories}
                    >
                      <HugeiconsIcon icon={Folder01Icon} className="text-sidebar-foreground/70" />
                      <span>{_(msg`Browse categories`)}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      tooltip={_(msg`Add Feed`)}
                      onClick={() => openAddFeedDialog()}
                    >
                      <HugeiconsIcon icon={Add01Icon} className="text-sidebar-foreground/70" />
                      <span>{_(msg`Add Feed`)}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </>
        )}

        {!isCollapsed && (
          <>
            <SidebarSeparator className="mx-0 sticky top-0 z-10 bg-background" />

            <SidebarGroup>
              <SidebarGroupLabel className="gap-2 text-sm font-normal text-sidebar-foreground/80">
                <HugeiconsIcon icon={Folder01Icon} />
                <span className="leading-none">{_(msg`Categories`)}</span>
              </SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu className="space-y-1">
                  {categoriesLoading ? (
                    categorySkeletonKeys.map((key) => (
                      <SidebarMenuItem key={key}>
                        <SidebarMenuButton disabled>
                          <div className="bg-muted h-3 w-20 animate-pulse rounded" />
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    ))
                  ) : !isConnected ? (
                    <SidebarMenuItem>
                      <SidebarMenuButton disabled>
                        <span>{_(msg`Offline cached data`)}</span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ) : (
                    categories?.map((category, index) => (
                      <CategoryItem key={category.id} category={category} index={index} />
                    ))
                  )}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </>
        )}

        {children}
      </SidebarContent>

      <SidebarFooter
        className={cn('mt-auto shrink-0 border-sidebar-border/50', isCollapsed ? 'p-2' : 'p-3')}
      >
        <UserNav compact={isCollapsed} />
      </SidebarFooter>
    </Sidebar>
  );
}

export function AppSidebar(props: AppSidebarProps) {
  return (
    <FeedCategoryDialogProvider>
      <AppSidebarContent {...props} />
    </FeedCategoryDialogProvider>
  );
}
