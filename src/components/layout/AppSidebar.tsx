import {
  ArrowRight01Icon,
  Calendar01Icon,
  FavouriteIcon,
  Folder01Icon,
  RssIcon,
  Timer01Icon,
} from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react';
import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { Link } from '@tanstack/react-router';
import * as React from 'react';
import {
  Collapsible,
  CollapsiblePanel,
  CollapsibleTrigger,
  useCollapsible,
} from '@/components/animate-ui/primitives/base/collapsible';
import { FeedAvatar, UserNav } from '@/components/miniflux';
import { AnimatedBadge } from '@/components/ui/badge-count';
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
} from '@/components/ui/sidebar';
import { cn } from '@/lib/utils';
import {
  useCategories,
  useCategoryFeeds,
  useCategoryUnreadCount,
  useFeedUnreadCount,
  useIsConnected,
  useUnreadCounts,
} from '@/services/miniflux';

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

function CategoryItem({ category, index }: { category: any; index: number }) {
  const unreadCount = useCategoryUnreadCount(Number(category.id));

  return (
    <Collapsible key={category.id} defaultOpen={index === 0} className="group/collapsible">
      <SidebarMenuItem>
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
              <SidebarMenuBadge>
                <AnimatedBadge count={unreadCount} />
              </SidebarMenuBadge>
            </SidebarMenuButton>
          )}
        </Link>
        <CollapsibleTrigger
          render={
            <SidebarMenuAction
              aria-label={`Toggle ${category.title}`}
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

function FeedItem({ feed }: { feed: any }) {
  const unreadCount = useFeedUnreadCount(Number(feed.id));

  return (
    <SidebarMenuSubItem key={feed.id}>
      <Link to="/" search={{ feedId: feed.id.toString() }} className="block w-full">
        {({ isActive }) => (
          <SidebarMenuSubButton isActive={isActive} className="w-full pr-[10px]">
            <div className="flex w-full min-w-0 items-center gap-2">
              <FeedAvatar className="size-5!" domain={feed.site_url} title={feed.title} />
              <span className="min-w-0 flex-1 truncate text-md">{feed.title}</span>
              <span className="shrink-0 text-xs tabular-nums">
                <AnimatedBadge count={unreadCount} animateOnMount={false} />
              </span>
            </div>
          </SidebarMenuSubButton>
        )}
      </Link>
    </SidebarMenuSubItem>
  );
}

function CategoryFeeds({ categoryId }: { categoryId: string }) {
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
            <div className="ml-4 h-7 flex items-center px-2">
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
            <div className="ml-4 text-xs text-destructive px-2 py-1.5">
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
      <SidebarMenuSub className="space-y-1 pt-1 ml-3.5 mr-0 pl-2.5 pr-0">
        {filteredFeeds.map((feed) => (
          <FeedItem key={feed.id} feed={feed} />
        ))}
      </SidebarMenuSub>
    </CollapsiblePanel>
  );
}

export function AppSidebar({ children, className }: AppSidebarProps) {
  const { _ } = useLingui();
  const { data: isConnected, isLoading: connectionLoading } = useIsConnected();
  const { data: categories, isLoading: categoriesLoading } = useCategories(isConnected ?? false);
  const { data: unreadCounts } = useUnreadCounts();

  return (
    <Sidebar
      side="left"
      variant="sidebar"
      collapsible="icon"
      className={cn(className, 'h-full relative')}
    >
      <SidebarHeader className="flex flex-row items-center justify-between px-4 py-2">
        <div className="flex items-center gap-2.5">
          <div className="bg-primary/10 flex size-6 items-center justify-center rounded-md"></div>
          <span className="font-semibold tracking-tight group-data-[collapsible=icon]:hidden">
            {_(msg`Minikyu`)}
          </span>
        </div>
      </SidebarHeader>

      <SidebarContent className="gap-0 flex flex-col min-h-0">
        <SidebarGroup className="sticky top-0 z-10 bg-background">
          <SidebarGroupLabel>{_(msg`Views`)}</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu className="gap-1">
              {connectionLoading ? (
                <SidebarMenuItem>
                  <SidebarMenuButton disabled>
                    <HugeiconsIcon icon={RssIcon} className="animate-pulse" />
                    <span>Loading...</span>
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
                            <AnimatedBadge count={Number(unreadCounts?.total ?? 0)} />
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
                            <AnimatedBadge count={Number(unreadCounts?.today ?? 0)} />
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
                            icon={FavouriteIcon}
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
                    <span>{_(msg`Not Connected`)}</span>
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

        {children}
      </SidebarContent>

      <SidebarFooter className="mt-auto border-sidebar-border/50 p-3 shrink-0">
        <UserNav />
      </SidebarFooter>
    </Sidebar>
  );
}
