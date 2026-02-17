import {
  Alert01Icon,
  Delete02Icon,
  Edit02Icon,
  Folder01Icon,
  Key01Icon,
  RefreshIcon,
  RssIcon,
  UserGroupIcon,
} from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react';
import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import type { ColumnDef } from '@tanstack/react-table';
import * as React from 'react';
import { toast } from 'sonner';
import { CategoriesPane } from '@/components/preferences/panes/CategoriesPane';
import { FeedsPane } from '@/components/preferences/panes/FeedsPane';
import { UsersPane } from '@/components/preferences/panes/UsersPane';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
} from '@/components/ui/sidebar';
import { Tooltip, TooltipPanel, TooltipTrigger } from '@/components/ui/tooltip';
import { queryClient } from '@/lib/query-client';
import { commands, type Feed } from '@/lib/tauri-bindings';
import { cn } from '@/lib/utils';
import {
  useCategories,
  useCreateMinifluxUser,
  useCurrentUser,
  useDeleteCategory,
  useDeleteFeed,
  useDeleteMinifluxUser,
  useFeeds,
  useIsConnected,
  useMinifluxUsers,
  useRefreshAllFeeds,
  useRefreshFeed,
  useUpdateMinifluxUser,
} from '@/services/miniflux';
import { useActiveAccount } from '@/services/miniflux/accounts';
import { DeleteEntityDialog } from './settings/DeleteEntityDialog';
import type {
  DeleteDialogState,
  MinifluxSettingsPane,
  UserDialogState,
} from './settings/dialog-state';
import {
  MinifluxSettingsDialogProviderBoundary,
  useMinifluxSettingsDialogStore,
} from './settings/store';
import { UserFormDialog } from './settings/UserFormDialog';

interface MinifluxSettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const settingsNavigationItems = [
  {
    id: 'categories' as const,
    label: msg`Categories`,
    icon: Folder01Icon,
  },
  {
    id: 'feeds' as const,
    label: msg`Feeds`,
    icon: RssIcon,
  },
  {
    id: 'users' as const,
    label: msg`Users`,
    icon: UserGroupIcon,
  },
  {
    id: 'token' as const,
    label: msg`API token`,
    icon: Key01Icon,
  },
] as const;

function MinifluxSettingsDialogContent({ open, onOpenChange }: MinifluxSettingsDialogProps) {
  const { _ } = useLingui();
  const { data: isConnected } = useIsConnected();
  const { data: currentAccount } = useActiveAccount();
  const { data: currentUser } = useCurrentUser();
  const { data: categories = [] } = useCategories((isConnected ?? false) && open);
  const { data: feeds = [] } = useFeeds((isConnected ?? false) && open);
  const { data: users = [], isError: usersError } = useMinifluxUsers(
    (isConnected ?? false) && open && (currentUser?.is_admin ?? false)
  );

  const deleteCategory = useDeleteCategory();

  const deleteFeed = useDeleteFeed();
  const refreshFeed = useRefreshFeed();
  const refreshAllFeeds = useRefreshAllFeeds();

  const createUser = useCreateMinifluxUser();
  const updateUser = useUpdateMinifluxUser();
  const deleteUser = useDeleteMinifluxUser();

  const setCategoryDialogState = useMinifluxSettingsDialogStore(
    (state) => state.setCategoryDialogState
  );
  const setFeedDialogState = useMinifluxSettingsDialogStore((state) => state.setFeedDialogState);
  const resetDialogStore = useMinifluxSettingsDialogStore((state) => state.resetForClose);

  const [activePane, setActivePane] = React.useState<MinifluxSettingsPane>('categories');
  const [categorySearchQuery, setCategorySearchQuery] = React.useState('');
  const [feedSearchQuery, setFeedSearchQuery] = React.useState('');
  const [tokenValue, setTokenValue] = React.useState('');
  const [isSavingToken, setIsSavingToken] = React.useState(false);
  const [userDialogState, setUserDialogState] = React.useState<UserDialogState | null>(null);
  const [deleteDialogState, setDeleteDialogState] = React.useState<DeleteDialogState | null>(null);

  const isDeletePending = deleteCategory.isPending || deleteFeed.isPending || deleteUser.isPending;
  const isUserDialogPending = createUser.isPending || updateUser.isPending;
  const normalizedCategorySearchQuery = categorySearchQuery.trim().toLowerCase();
  const normalizedFeedSearchQuery = feedSearchQuery.trim().toLowerCase();

  React.useEffect(() => {
    if (!open) {
      setActivePane('categories');
      setCategorySearchQuery('');
      setFeedSearchQuery('');
      setTokenValue('');
      setUserDialogState(null);
      setDeleteDialogState(null);
      resetDialogStore();
    }
  }, [open, resetDialogStore]);

  const feedColumns = React.useMemo<ColumnDef<Feed>[]>(
    () => [
      {
        accessorKey: 'title',
        header: _(msg`Feed`),
        size: 250,
        cell: ({ row }) => {
          const feed = row.original;
          const hasError = !!feed.parsing_error_message;
          return (
            <div className="flex flex-col items-start gap-1 overflow-hidden text-left">
              <div className="flex max-w-full items-center gap-2">
                <Tooltip>
                  <TooltipTrigger className="min-w-0 max-w-full text-left">
                    <span className="block truncate font-medium">{feed.title}</span>
                  </TooltipTrigger>
                  <TooltipPanel>{feed.title}</TooltipPanel>
                </Tooltip>
                {hasError && (
                  <Tooltip>
                    <TooltipTrigger>
                      <div className="shrink-0 text-destructive">
                        <HugeiconsIcon icon={Alert01Icon} className="size-3.5" />
                      </div>
                    </TooltipTrigger>
                    <TooltipPanel className="max-w-xs break-words">
                      {feed.parsing_error_message}
                    </TooltipPanel>
                  </Tooltip>
                )}
              </div>
              <Tooltip>
                <TooltipTrigger className="max-w-full text-left">
                  <span className="block truncate text-xs text-muted-foreground">
                    {feed.feed_url}
                  </span>
                </TooltipTrigger>
                <TooltipPanel>{feed.feed_url}</TooltipPanel>
              </Tooltip>
            </div>
          );
        },
      },
      {
        accessorKey: 'category',
        header: _(msg`Category`),
        cell: ({ row }) => {
          const category = row.original.category;
          if (!category) {
            return null;
          }

          return (
            <div className="flex justify-start">
              <Badge variant="secondary" className="truncate text-xs">
                {category.title}
              </Badge>
            </div>
          );
        },
      },
      {
        id: 'actions',
        cell: ({ row }) => {
          const feed = row.original;
          return (
            <div className="flex items-center justify-end gap-1">
              <Button
                size="sm"
                variant="ghost"
                onClick={() => refreshFeed.mutate(feed.id)}
                disabled={refreshFeed.isPending && refreshFeed.variables === feed.id}
              >
                <HugeiconsIcon
                  icon={RefreshIcon}
                  className={cn(
                    'size-4',
                    refreshFeed.isPending && refreshFeed.variables === feed.id && 'animate-spin'
                  )}
                />
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setFeedDialogState({ mode: 'edit', feed })}
              >
                <HugeiconsIcon icon={Edit02Icon} className="size-4" />
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() =>
                  setDeleteDialogState({
                    type: 'feed',
                    id: feed.id,
                    title: feed.title,
                  })
                }
              >
                <HugeiconsIcon icon={Delete02Icon} className="size-4 text-destructive" />
              </Button>
            </div>
          );
        },
      },
    ],
    [_, refreshFeed, setFeedDialogState]
  );

  const filteredCategories = React.useMemo(() => {
    if (!normalizedCategorySearchQuery) {
      return categories;
    }

    return categories.filter((category) =>
      category.title.toLowerCase().includes(normalizedCategorySearchQuery)
    );
  }, [categories, normalizedCategorySearchQuery]);

  const filteredFeeds = React.useMemo(() => {
    if (!normalizedFeedSearchQuery) {
      return feeds;
    }

    return feeds.filter((feed) => {
      const titleMatches = feed.title.toLowerCase().includes(normalizedFeedSearchQuery);
      const urlMatches = feed.feed_url.toLowerCase().includes(normalizedFeedSearchQuery);
      const categoryMatches =
        feed.category?.title.toLowerCase().includes(normalizedFeedSearchQuery) ?? false;

      return titleMatches || urlMatches || categoryMatches;
    });
  }, [feeds, normalizedFeedSearchQuery]);

  const getPaneTitle = (pane: MinifluxSettingsPane): string => {
    const matchedItem = settingsNavigationItems.find((item) => item.id === pane);
    return matchedItem ? _(matchedItem.label) : pane;
  };

  const getPaneDescription = (pane: MinifluxSettingsPane): string => {
    if (pane === 'categories') {
      return _(msg`Create, rename, and delete categories.`);
    }

    if (pane === 'feeds') {
      return _(msg`Manage feeds and discover subscriptions from source URLs.`);
    }

    if (pane === 'users') {
      return _(msg`Manage Miniflux user accounts.`);
    }

    return _(msg`Update the API token used by the current account.`);
  };

  const handleSubmitUser = async (input: {
    username: string;
    password: string;
    isAdmin: boolean;
  }) => {
    if (!userDialogState) {
      return;
    }

    if (userDialogState.mode === 'create') {
      await createUser.mutateAsync(input);
    } else {
      await updateUser.mutateAsync({
        id: userDialogState.user.id,
        username: input.username,
        password: input.password,
      });
    }

    setUserDialogState(null);
  };

  const handleConfirmDelete = async () => {
    if (!deleteDialogState) {
      return;
    }

    if (deleteDialogState.type === 'category') {
      await deleteCategory.mutateAsync(deleteDialogState.id);
    } else if (deleteDialogState.type === 'feed') {
      await deleteFeed.mutateAsync(deleteDialogState.id);
    } else {
      await deleteUser.mutateAsync(deleteDialogState.id);
    }

    setDeleteDialogState(null);
  };

  const handleSaveToken = async () => {
    if (!currentAccount || !tokenValue.trim()) {
      return;
    }

    setIsSavingToken(true);

    try {
      const result = await commands.minifluxConnect({
        // biome-ignore lint/style/useNamingConvention: API field names
        server_url: currentAccount.server_url,
        // biome-ignore lint/style/useNamingConvention: API field names
        auth_token: tokenValue.trim(),
      });

      if (result.status === 'error') {
        toast.error(_(msg`Failed to update API token`), {
          description: result.error,
        });
        return;
      }

      setTokenValue('');
      queryClient.invalidateQueries({ queryKey: ['miniflux'] });
      toast.success(_(msg`API token updated`));
    } finally {
      setIsSavingToken(false);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="overflow-hidden p-0 sm:max-w-6xl md:h-[85vh] md:max-h-[85vh]">
          <DialogTitle className="sr-only">{_(msg`Miniflux settings`)}</DialogTitle>
          <DialogDescription className="sr-only">
            {_(msg`Manage categories, feeds, user accounts, and API token in one place.`)}
          </DialogDescription>

          {!isConnected ? (
            <div className="p-6 text-sm text-muted-foreground">
              {_(msg`Not connected to Miniflux API`)}
            </div>
          ) : (
            <SidebarProvider className="h-full min-h-0 overflow-hidden">
              <Sidebar
                collapsible="none"
                className="hidden h-full border-r bg-background py-4 md:flex"
              >
                <SidebarContent>
                  <SidebarGroup>
                    <SidebarGroupContent>
                      <SidebarMenu className="gap-1">
                        {settingsNavigationItems.map((item) => {
                          const count =
                            item.id === 'categories'
                              ? categories.length
                              : item.id === 'feeds'
                                ? feeds.length
                                : item.id === 'users' && currentUser?.is_admin
                                  ? users.length
                                  : null;

                          return (
                            <SidebarMenuItem key={item.id}>
                              <SidebarMenuButton
                                isActive={activePane === item.id}
                                onClick={() => setActivePane(item.id)}
                              >
                                <HugeiconsIcon icon={item.icon} />
                                <span>{_(item.label)}</span>
                              </SidebarMenuButton>
                              {count !== null && <SidebarMenuBadge>{count}</SidebarMenuBadge>}
                            </SidebarMenuItem>
                          );
                        })}
                      </SidebarMenu>
                    </SidebarGroupContent>
                  </SidebarGroup>
                </SidebarContent>
              </Sidebar>

              <main className="flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
                <div className="border-b p-2 md:hidden">
                  <div className="grid grid-cols-2 gap-1">
                    {settingsNavigationItems.map((item) => (
                      <Button
                        key={item.id}
                        size="sm"
                        variant={activePane === item.id ? 'secondary' : 'ghost'}
                        className="justify-start"
                        onClick={() => setActivePane(item.id)}
                      >
                        <HugeiconsIcon icon={item.icon} className="mr-1.5 size-4" />
                        {_(item.label)}
                      </Button>
                    ))}
                  </div>
                </div>

                <header className="border-b px-5 py-4">
                  <h2 className="text-sm font-semibold">{getPaneTitle(activePane)}</h2>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {getPaneDescription(activePane)}
                  </p>
                </header>

                <div className="min-w-0 flex-1 overflow-y-auto p-4">
                  {activePane === 'categories' && (
                    <CategoriesPane
                      categories={categories}
                      filteredCategories={filteredCategories}
                      searchQuery={categorySearchQuery}
                      onSearchChange={setCategorySearchQuery}
                      onAddCategory={() => setCategoryDialogState({ mode: 'create' })}
                      onEditCategory={(category) =>
                        setCategoryDialogState({ mode: 'edit', category })
                      }
                      onDeleteCategory={(category) =>
                        setDeleteDialogState({
                          type: 'category',
                          id: category.id,
                          title: category.title,
                        })
                      }
                    />
                  )}

                  {activePane === 'feeds' && (
                    <FeedsPane
                      feeds={feeds}
                      filteredFeeds={filteredFeeds}
                      searchQuery={feedSearchQuery}
                      onSearchChange={setFeedSearchQuery}
                      onAddFeed={() =>
                        setFeedDialogState({
                          mode: 'create',
                          defaultCategoryId: null,
                          initialFeedUrl: '',
                        })
                      }
                      onRefreshAll={() => refreshAllFeeds.mutate()}
                      isRefreshingAll={refreshAllFeeds.isPending}
                      columns={feedColumns}
                    />
                  )}

                  {activePane === 'users' && (
                    <UsersPane
                      currentUser={currentUser ?? null}
                      users={users}
                      isError={usersError}
                      onAddUser={() => setUserDialogState({ mode: 'create' })}
                      onEditUser={(user) => setUserDialogState({ mode: 'edit', user })}
                      onDeleteUser={(user) =>
                        setDeleteDialogState({
                          type: 'user',
                          id: user.id,
                          title: user.username,
                        })
                      }
                    />
                  )}

                  {activePane === 'token' && (
                    <section className="space-y-3 rounded-md border p-4">
                      <div className="flex items-center gap-2">
                        <HugeiconsIcon icon={Key01Icon} className="size-4 text-muted-foreground" />
                        <h3 className="text-sm font-semibold">{_(msg`API token`)}</h3>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {currentAccount
                          ? `${_(msg`Server`)}: ${currentAccount.server_url}`
                          : _(msg`No active account`)}
                      </div>
                      <div className="flex gap-2">
                        <Input
                          type="password"
                          value={tokenValue}
                          onChange={(event) => setTokenValue(event.target.value)}
                          placeholder={_(msg`Paste new API token`)}
                          disabled={isSavingToken || !currentAccount}
                        />
                        <Button
                          onClick={handleSaveToken}
                          disabled={isSavingToken || !currentAccount || !tokenValue.trim()}
                        >
                          {_(msg`Update token`)}
                        </Button>
                      </div>
                    </section>
                  )}
                </div>
              </main>
            </SidebarProvider>
          )}
        </DialogContent>
      </Dialog>

      {userDialogState && (
        <UserFormDialog
          key={
            userDialogState.mode === 'create'
              ? 'create-user'
              : `edit-user-${userDialogState.user.id}`
          }
          open
          mode={userDialogState.mode}
          initialUsername={userDialogState.mode === 'create' ? '' : userDialogState.user.username}
          pending={isUserDialogPending}
          onOpenChange={(nextOpen) => {
            if (!nextOpen) {
              setUserDialogState(null);
            }
          }}
          onSubmit={handleSubmitUser}
        />
      )}

      <DeleteEntityDialog
        state={deleteDialogState}
        pending={isDeletePending}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) {
            setDeleteDialogState(null);
          }
        }}
        onConfirm={handleConfirmDelete}
      />
    </>
  );
}

export function MinifluxSettingsDialog(props: MinifluxSettingsDialogProps) {
  return (
    <MinifluxSettingsDialogProviderBoundary>
      <MinifluxSettingsDialogContent {...props} />
    </MinifluxSettingsDialogProviderBoundary>
  );
}
