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
} from '@/components/animate-ui/primitives/base/collapsible';
import { FeedAvatar, UserNav } from '@/components/miniflux';
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
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarSeparator,
} from '@/components/ui/sidebar';
import { cn } from '@/lib/utils';
import { useCategories, useCategoryFeeds, useIsConnected } from '@/services/miniflux';

interface AppSidebarProps {
  children?: React.ReactNode;
  className?: string;
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
      <SidebarMenuSub className="space-y-1 pt-1">
        {filteredFeeds.map((feed) => (
          <SidebarMenuSubItem key={feed.id}>
            <Link to="/" search={{ feedId: feed.id.toString() }}>
              {({ isActive }) => (
                <SidebarMenuSubButton asChild isActive={isActive}>
                  <div className="flex items-center gap-2 w-full">
                    <FeedAvatar className="size-5!" domain={feed.site_url} title={feed.title} />
                    <span className="truncate text-md">{feed.title}</span>
                  </div>
                </SidebarMenuSubButton>
              )}
            </Link>
          </SidebarMenuSubItem>
        ))}
      </SidebarMenuSub>
    </CollapsiblePanel>
  );
}

export function AppSidebar({ children, className }: AppSidebarProps) {
  const { _ } = useLingui();
  const { data: isConnected, isLoading: connectionLoading } = useIsConnected();
  const { data: categories, isLoading: categoriesLoading } = useCategories(isConnected ?? false);

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
                          asChild
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
                        </SidebarMenuButton>
                      )}
                    </Link>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <Link to="/" search={{ filter: 'today' }}>
                      {({ isActive }) => (
                        <SidebarMenuButton asChild tooltip={_(msg`Today`)} isActive={isActive}>
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
                        </SidebarMenuButton>
                      )}
                    </Link>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <Link to="/" search={{ filter: 'starred' }}>
                      {({ isActive }) => (
                        <SidebarMenuButton asChild tooltip={_(msg`Starred`)} isActive={isActive}>
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
                        <SidebarMenuButton asChild tooltip={_(msg`History`)} isActive={isActive}>
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
          <SidebarGroupLabel>{_(msg`Categories`)}</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu className="space-y-1">
              {categoriesLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <SidebarMenuItem key={i}>
                    <SidebarMenuButton disabled>
                      <HugeiconsIcon icon={Folder01Icon} className="opacity-50" />
                      <div className="bg-muted h-3 w-20 animate-pulse rounded" />
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))
              ) : !isConnected ? (
                <SidebarMenuItem>
                  <SidebarMenuButton disabled>
                    <HugeiconsIcon icon={Folder01Icon} />
                    <span>{_(msg`Not Connected`)}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ) : (
                categories?.map((category) => (
                  <Collapsible key={category.id} defaultOpen={false} className="group/collapsible">
                    <SidebarMenuItem className="">
                      <Link to="/" search={{ categoryId: category.id.toString() }}>
                        {({ isActive }) => (
                          <SidebarMenuButton asChild tooltip={category.title} isActive={isActive}>
                            <HugeiconsIcon
                              icon={Folder01Icon}
                              className={cn(
                                'transition-colors duration-200',
                                isActive ? 'text-primary' : 'text-sidebar-foreground/70'
                              )}
                            />
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
                      <CollapsibleTrigger render={<SidebarMenuAction showOnHover />}>
                        <HugeiconsIcon
                          icon={ArrowRight01Icon}
                          className="transition-transform duration-300 group-data-[state=open]/collapsible:rotate-90"
                        />
                      </CollapsibleTrigger>
                      <CategoryFeeds categoryId={category.id} />
                    </SidebarMenuItem>
                  </Collapsible>
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
