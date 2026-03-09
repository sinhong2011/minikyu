import {
  Add01Icon,
  ArrowRight01Icon,
  Calendar01Icon,
  CheckmarkCircle02Icon,
  Delete02Icon,
  FileDownloadIcon,
  FileUploadIcon,
  Folder01Icon,
  FolderTransferIcon,
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
import { confirm, open as openDialog, save as saveDialog } from '@tauri-apps/plugin-dialog';
import { readTextFile, writeTextFile } from '@tauri-apps/plugin-fs';
import { AnimatePresence, motion } from 'motion/react';
import * as React from 'react';
import { toast } from 'sonner';
import {
  Menu,
  MenuItem,
  MenuPanel,
  MenuSeparator,
  MenuSubmenu,
  MenuSubmenuPanel,
  MenuSubmenuTrigger,
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
  useSidebar,
} from '@/components/ui/sidebar';
import { logger } from '@/lib/logger';
import { queryClient } from '@/lib/query-client';
import type { Category, Feed } from '@/lib/tauri-bindings';
import { commands } from '@/lib/tauri-bindings';
import { cn } from '@/lib/utils';
import {
  useCategories,
  useCategoryFeeds,
  useCategoryUnreadCount,
  useDeleteCategory,
  useDeleteFeed,
  useFeedUnreadCount,
  useIsConnected,
  useMarkCategoryAsRead,
  useMarkFeedAsRead,
  useSyncMiniflux,
  useUnreadCounts,
  useUpdateFeed,
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
  const { mutateAsync: markFeedAsRead } = useMarkFeedAsRead();
  const updateFeed = useUpdateFeed();
  const { data: categories } = useCategories();
  const setFeedDialogState = useMinifluxSettingsDialogStore((state) => state.setFeedDialogState);

  const otherCategories = React.useMemo(
    () => categories?.filter((c) => String(c.id) !== String(feed.category?.id)) ?? [],
    [categories, feed.category?.id]
  );

  const handleDelete = async (event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    const confirmed = await confirm(
      _(msg`Are you sure you want to unsubscribe from "${feed.title}"?`),
      { title: _(msg`Unsubscribe Feed`), kind: 'warning' }
    );
    if (!confirmed) return;
    try {
      await deleteFeed(feed.id);
    } catch {
      // Error toast is handled in mutation hook; prevent unhandled rejections in event handler
    }
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 1, height: 'auto' }}
      exit={{ opacity: 0, height: 0, marginTop: 0, marginBottom: 0 }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
    >
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
                  <AnimatedBadge
                    count={unreadCount}
                    className="text-[12px]"
                    animateOnMount={false}
                  />
                </div>
                <div className="pointer-events-auto absolute inset-0 flex items-center justify-center scale-50 opacity-0 transition-all duration-200 group-hover/feed-item:scale-100 group-hover/feed-item:opacity-100">
                  <Menu>
                    <MenuTrigger
                      className="size-6 flex items-center justify-center rounded-md text-sidebar-foreground/70 hover:bg-black/[0.06] dark:hover:bg-white/10 hover:text-sidebar-foreground"
                      onClick={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                      }}
                    >
                      <HugeiconsIcon icon={MoreVerticalIcon} className="size-4" />
                    </MenuTrigger>
                    <MenuPanel side="right" align="start">
                      <MenuItem
                        onClick={() => {
                          markFeedAsRead(feed.id).catch(() => {});
                        }}
                      >
                        <HugeiconsIcon icon={CheckmarkCircle02Icon} />
                        {_(msg`Mark as read`)}
                      </MenuItem>
                      <MenuItem onClick={() => setFeedDialogState({ mode: 'edit', feed })}>
                        <HugeiconsIcon icon={PencilEdit02Icon} />
                        {_(msg`Edit`)}
                      </MenuItem>
                      {otherCategories.length > 0 && (
                        <MenuSubmenu>
                          <MenuSubmenuTrigger className="[&_svg:not([class*='text-'])]:text-muted-foreground gap-2 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4">
                            <HugeiconsIcon icon={FolderTransferIcon} />
                            {_(msg`Move to`)}
                          </MenuSubmenuTrigger>
                          <MenuSubmenuPanel>
                            {otherCategories.map((category) => (
                              <MenuItem
                                key={category.id}
                                onClick={() => {
                                  updateFeed.mutateAsync({
                                    id: feed.id,
                                    // biome-ignore lint/style/useNamingConvention: API field name
                                    updates: { category_id: category.id },
                                  });
                                }}
                              >
                                <HugeiconsIcon icon={Folder01Icon} />
                                {category.title}
                              </MenuItem>
                            ))}
                          </MenuSubmenuPanel>
                        </MenuSubmenu>
                      )}
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
    </motion.div>
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
        <AnimatePresence initial={false}>
          {filteredFeeds.map((feed) => (
            <FeedItem key={feed.id} feed={feed} />
          ))}
        </AnimatePresence>
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
  const { data: feeds } = useCategoryFeeds(category.id);
  const { mutateAsync: deleteCategory } = useDeleteCategory();
  const { mutateAsync: markCategoryAsRead } = useMarkCategoryAsRead();
  const setCategoryDialogState = useMinifluxSettingsDialogStore(
    (state) => state.setCategoryDialogState
  );

  const feedCount = feeds?.filter((f) => f.title.trim().toLowerCase() !== 'all').length ?? 0;

  const handleDelete = async (event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    if (feedCount > 0) {
      await confirm(
        _(
          msg`Cannot delete "${category.title}" because it still has ${String(feedCount)} feed(s). Move or remove all feeds first.`
        ),
        { title: _(msg`Category Not Empty`), kind: 'info' }
      );
      return;
    }
    const confirmed = await confirm(_(msg`Are you sure you want to delete "${category.title}"?`), {
      title: _(msg`Delete Category`),
      kind: 'warning',
    });
    if (!confirmed) return;
    try {
      await deleteCategory(category.id);
    } catch {
      // Error toast is handled in mutation hook; prevent unhandled rejections in event handler
    }
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 1, height: 'auto' }}
      exit={{ opacity: 0, height: 0, marginTop: 0, marginBottom: 0 }}
      transition={{ duration: 0.25, ease: 'easeOut' }}
    >
      <Collapsible key={category.id} defaultOpen={index === 0} className="group/collapsible">
        <SidebarMenuItem className="group/category-item relative">
          <Link to="/" search={{ categoryId: category.id.toString() }} className="min-w-0 flex-1">
            {({ isActive }) => (
              <SidebarMenuButton
                tooltip={category.title}
                isActive={isActive}
                className="pl-8 pr-10"
              >
                <span
                  className={cn(
                    'truncate transition-colors duration-200',
                    isActive
                      ? 'font-semibold text-sidebar-foreground'
                      : 'text-sidebar-foreground/80'
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
                  className="size-6 flex items-center justify-center rounded-md text-sidebar-foreground/70 hover:bg-black/[0.06] dark:hover:bg-white/10 hover:text-sidebar-foreground"
                  onClick={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                  }}
                >
                  <HugeiconsIcon icon={MoreVerticalIcon} className="size-4" />
                </MenuTrigger>
                <MenuPanel side="right" align="start">
                  <MenuItem
                    onClick={() => {
                      markCategoryAsRead(category.id).catch(() => {});
                    }}
                  >
                    <HugeiconsIcon icon={CheckmarkCircle02Icon} />
                    {_(msg`Mark as read`)}
                  </MenuItem>
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
                className="left-1 right-auto data-[state=open]:bg-black/[0.06] dark:data-[state=open]:bg-white/10 data-[state=open]:text-sidebar-accent-foreground"
              />
            }
          >
            <CategoryChevron />
          </CollapsibleTrigger>
          <CategoryFeeds categoryId={category.id} />
        </SidebarMenuItem>
      </Collapsible>
    </motion.div>
  );
}

function AppSidebarContent({ children, className }: AppSidebarProps) {
  const { _ } = useLingui();
  const { state: sidebarState, setOpen } = useSidebar();
  const { data: isConnected, isLoading: connectionLoading } = useIsConnected();
  const { data: categories, isLoading: categoriesLoading } = useCategories();
  const { data: unreadCounts } = useUnreadCounts();
  const syncMiniflux = useSyncMiniflux();
  const syncing = useSyncStore((state) => state.syncing);
  const setCategoryDialogState = useMinifluxSettingsDialogStore(
    (state) => state.setCategoryDialogState
  );
  const setFeedDialogState = useMinifluxSettingsDialogStore((state) => state.setFeedDialogState);

  const openAddFeedDialog = React.useCallback(
    (options?: { initialUrl?: string; openSearchTab?: boolean }) => {
      setFeedDialogState({
        mode: 'create',
        defaultCategoryId: null,
        initialFeedUrl: options?.initialUrl?.trim() ?? '',
        initialSearchOpen: options?.openSearchTab ?? false,
      });
    },
    [setFeedDialogState]
  );
  // Listen for command palette events to open feed/category dialogs directly
  React.useEffect(() => {
    const handleAddFeed = () => openAddFeedDialog();
    const handleAddCategory = () => setCategoryDialogState({ mode: 'create' });
    document.addEventListener('command:add-feed', handleAddFeed);
    document.addEventListener('command:add-category', handleAddCategory);
    return () => {
      document.removeEventListener('command:add-feed', handleAddFeed);
      document.removeEventListener('command:add-category', handleAddCategory);
    };
  }, [openAddFeedDialog, setCategoryDialogState]);

  const handleSync = React.useCallback(() => {
    if (!isConnected || syncing) {
      return;
    }
    syncMiniflux.mutate();
  }, [isConnected, syncing, syncMiniflux]);
  const handleShowCategories = React.useCallback(() => {
    setOpen(true);
  }, [setOpen]);
  const handleExportOpml = React.useCallback(async () => {
    try {
      const date = new Date().toISOString().split('T')[0];
      const filePath = await saveDialog({
        title: _(msg`Export OPML`),
        defaultPath: `miniflux-feeds-${date}.opml`,
        filters: [
          { name: 'OPML', extensions: ['opml'] },
          { name: 'XML', extensions: ['xml'] },
        ],
      });
      if (!filePath) return;

      const result = await commands.exportOpml();
      if (result.status === 'error') {
        toast.error(_(msg`Failed to export OPML`), { description: result.error });
        return;
      }

      await writeTextFile(filePath, result.data);
      queryClient.invalidateQueries({ queryKey: ['miniflux'] });
      toast.success(_(msg`OPML exported successfully`));
    } catch (error) {
      logger.error('Failed to export OPML', { error });
      toast.error(_(msg`Failed to export OPML`), {
        description: error instanceof Error ? error.message : String(error),
      });
    }
  }, [_]);

  const handleImportOpml = React.useCallback(async () => {
    try {
      const filePath = await openDialog({
        title: _(msg`Import OPML`),
        multiple: false,
        filters: [
          { name: 'OPML', extensions: ['opml'] },
          { name: 'XML', extensions: ['xml'] },
          { name: 'All Files', extensions: ['*'] },
        ],
      });
      if (!filePath) return;

      const opmlContent = await readTextFile(filePath);
      const result = await commands.importOpml(opmlContent);
      if (result.status === 'error') {
        toast.error(_(msg`Failed to import OPML`), { description: result.error });
        return;
      }

      queryClient.invalidateQueries({ queryKey: ['miniflux'] });
      toast.success(_(msg`OPML imported successfully`));
    } catch (error) {
      logger.error('Failed to import OPML', { error });
      toast.error(_(msg`Failed to import OPML`), {
        description: error instanceof Error ? error.message : String(error),
      });
    }
  }, [_]);

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
                <MenuItem onClick={() => openAddFeedDialog({ openSearchTab: true })}>
                  <HugeiconsIcon icon={Search01Icon} />
                  {_(msg`Search Source`)}
                </MenuItem>
                <MenuItem onClick={() => setCategoryDialogState({ mode: 'create' })}>
                  <HugeiconsIcon icon={Folder01Icon} />
                  {_(msg`Add Category`)}
                </MenuItem>
                <MenuSeparator />
                <MenuItem onClick={handleExportOpml}>
                  <HugeiconsIcon icon={FileDownloadIcon} />
                  {_(msg`Export OPML`)}
                </MenuItem>
                <MenuItem onClick={handleImportOpml}>
                  <HugeiconsIcon icon={FileUploadIcon} />
                  {_(msg`Import OPML`)}
                </MenuItem>
              </MenuPanel>
            </Menu>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent className="flex min-h-0 flex-col gap-0">
        <SidebarGroup className="sticky top-0 z-10 bg-sidebar">
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
                  <SidebarMenuButton tooltip={_(msg`Add Feed`)} onClick={() => openAddFeedDialog()}>
                    <HugeiconsIcon icon={Add01Icon} className="text-sidebar-foreground/70" />
                    <span>{_(msg`Add Feed`)}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        {!isCollapsed && (
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
                ) : categories && categories.length > 0 ? (
                  <AnimatePresence initial={false}>
                    {categories.map((category, index) => (
                      <CategoryItem key={category.id} category={category} index={index} />
                    ))}
                  </AnimatePresence>
                ) : !isConnected ? (
                  <SidebarMenuItem>
                    <SidebarMenuButton disabled>
                      <span>{_(msg`Offline cached data`)}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ) : null}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
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
