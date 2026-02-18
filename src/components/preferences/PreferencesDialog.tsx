import {
  ColorsIcon,
  Folder01Icon,
  InformationCircleIcon,
  Key01Icon,
  Link02Icon,
  RssIcon,
  Settings01Icon,
  UserGroupIcon,
  ZapIcon,
} from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react';
import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { open as openDialog, save as saveDialog } from '@tauri-apps/plugin-dialog';
import { readTextFile, writeTextFile } from '@tauri-apps/plugin-fs';
import * as React from 'react';
import { toast } from 'sonner';
import { DeleteEntityDialog } from '@/components/miniflux/settings/DeleteEntityDialog';
import type {
  DeleteDialogState,
  UserDialogState,
} from '@/components/miniflux/settings/dialog-state';
import { FeedCategoryDialogsHost } from '@/components/miniflux/settings/FeedCategoryDialogsHost';
import { useMinifluxSettingsDialogStore } from '@/components/miniflux/settings/store';
import { UserFormDialog } from '@/components/miniflux/settings/UserFormDialog';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
} from '@/components/ui/sidebar';
import { logger } from '@/lib/logger';
import { queryClient } from '@/lib/query-client';
import { commands } from '@/lib/tauri-bindings';
import {
  useCategories,
  useCreateMinifluxUser,
  useCurrentUser,
  useDeleteCategory,
  useDeleteFeed,
  useDeleteMinifluxUser,
  useFeeds,
  useIntegrations,
  useIsConnected,
  useMinifluxUsers,
  useRefreshAllFeeds,
  useUpdateMinifluxUser,
} from '@/services/miniflux';
import { type PreferencesPane, useUIStore } from '@/store/ui-store';
import { AboutPane } from './panes/AboutPane';
import { AdvancedPane } from './panes/AdvancedPane';
import { ApiTokenPane } from './panes/ApiTokenPane';
import { AppearancePane } from './panes/AppearancePane';
import { CategoriesPane } from './panes/CategoriesPane';
import { FeedsPane } from './panes/FeedsPane';
import { GeneralPane } from './panes/GeneralPane';
import { IntegrationsPane } from './panes/IntegrationsPane';
import { UsersPane } from './panes/UsersPane';

const appSettingsItems = [
  {
    id: 'general' as const,
    label: msg`General`,
    icon: Settings01Icon,
  },
  {
    id: 'appearance' as const,
    label: msg`Appearance`,
    icon: ColorsIcon,
  },
  {
    id: 'advanced' as const,
    label: msg`Advanced`,
    icon: ZapIcon,
  },
  {
    id: 'about' as const,
    label: msg`About`,
    icon: InformationCircleIcon,
  },
] as const;

const serverSettingsItems = [
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
  {
    id: 'integrations' as const,
    label: msg`Integrations`,
    icon: Link02Icon,
  },
] as const;

function ConnectionStatePane() {
  const { _ } = useLingui();
  return (
    <div className="flex items-center justify-center h-full">
      <p className="text-sm text-muted-foreground">{_(msg`Not connected to Miniflux server`)}</p>
    </div>
  );
}

export function PreferencesDialog() {
  const { _ } = useLingui();
  const preferencesOpen = useUIStore((state) => state.preferencesOpen);
  const setPreferencesOpen = useUIStore((state) => state.setPreferencesOpen);
  const activePane = useUIStore((state) => state.preferencesActivePane);
  const setPreferencesActivePane = useUIStore((state) => state.setPreferencesActivePane);
  const { data: isConnected } = useIsConnected();
  const { data: currentUser } = useCurrentUser();

  // Miniflux data fetching
  const { data: categories = [] } = useCategories(isConnected);
  const { data: feeds = [] } = useFeeds(isConnected);
  const { data: users = [], isError: usersError } = useMinifluxUsers(
    isConnected && (currentUser?.is_admin ?? false)
  );
  const { data: integrations, isLoading: integrationsLoading } = useIntegrations();

  // Dialog state from MinifluxSettingsDialogStore
  const setCategoryDialogState = useMinifluxSettingsDialogStore(
    (state) => state.setCategoryDialogState
  );
  const setFeedDialogState = useMinifluxSettingsDialogStore((state) => state.setFeedDialogState);

  // Local state for user and delete dialogs
  const [userDialogState, setUserDialogState] = React.useState<UserDialogState | null>(null);
  const [deleteDialogState, setDeleteDialogState] = React.useState<DeleteDialogState | null>(null);

  // Local state for search queries
  const [categorySearchQuery, setCategorySearchQuery] = React.useState('');
  const [feedSearchQuery, setFeedSearchQuery] = React.useState('');

  // Mutation hooks
  const createUser = useCreateMinifluxUser();
  const updateUser = useUpdateMinifluxUser();
  const deleteUser = useDeleteMinifluxUser();
  const deleteCategory = useDeleteCategory();
  const deleteFeed = useDeleteFeed();
  const refreshAllFeeds = useRefreshAllFeeds();

  // Filtered data
  const normalizedCategorySearchQuery = categorySearchQuery.trim().toLowerCase();
  const normalizedFeedSearchQuery = feedSearchQuery.trim().toLowerCase();

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

  // Handler functions
  const handleConfirmDelete = async () => {
    if (!deleteDialogState) return;
    try {
      if (deleteDialogState.type === 'category') {
        await deleteCategory.mutateAsync(deleteDialogState.id);
      } else if (deleteDialogState.type === 'feed') {
        await deleteFeed.mutateAsync(deleteDialogState.id);
      } else {
        await deleteUser.mutateAsync(deleteDialogState.id);
      }
      // Only close dialog if operation succeeded
      setDeleteDialogState(null);
    } catch {
      // Error already handled by mutation hook with toast
      // Dialog stays open so user can retry or cancel
    }
  };

  const handleSubmitUser = async (input: {
    username: string;
    password: string;
    isAdmin: boolean;
  }) => {
    if (!userDialogState) return;
    try {
      if (userDialogState.mode === 'create') {
        await createUser.mutateAsync(input);
      } else {
        await updateUser.mutateAsync({
          id: userDialogState.user.id,
          username: input.username,
          password: input.password,
        });
      }
      // Only close dialog if operation succeeded
      setUserDialogState(null);
    } catch {
      // Error already handled by mutation hook with toast
      // Dialog stays open so user can retry or cancel
    }
  };

  const handleExportOpml = async () => {
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
  };

  const handleImportOpml = async () => {
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
  };

  const getPaneTitle = (pane: PreferencesPane): string => {
    const allItems = [...appSettingsItems, ...serverSettingsItems];
    const item = allItems.find((i) => i.id === pane);
    return item ? _(item.label) : pane;
  };

  return (
    <Dialog open={preferencesOpen} onOpenChange={setPreferencesOpen}>
      <DialogContent className="overflow-hidden p-0 md:max-h-150 md:max-w-292 lg:max-w-325 font-sans rounded-xl">
        <DialogTitle className="sr-only">{_(msg`Preferences`)}</DialogTitle>
        <DialogDescription className="sr-only">
          {_(msg`Customize your application preferences here.`)}
        </DialogDescription>

        <SidebarProvider className="items-start">
          <Sidebar collapsible="none" className="hidden md:flex bg-background py-4">
            <SidebarContent>
              {/* App Settings Section */}
              <SidebarGroup>
                <SidebarGroupLabel>{_(msg`App Settings`)}</SidebarGroupLabel>
                <SidebarGroupContent>
                  <SidebarMenu className="gap-1">
                    {appSettingsItems.map((item) => (
                      <SidebarMenuItem key={item.id}>
                        <SidebarMenuButton
                          isActive={activePane === item.id}
                          onClick={() => setPreferencesActivePane(item.id)}
                        >
                          <HugeiconsIcon icon={item.icon} />
                          <span>{_(item.label)}</span>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    ))}
                  </SidebarMenu>
                </SidebarGroupContent>
              </SidebarGroup>

              {/* Server Settings Section */}
              {isConnected && (
                <SidebarGroup>
                  <SidebarGroupLabel>{_(msg`Server Settings`)}</SidebarGroupLabel>
                  <SidebarGroupContent>
                    <SidebarMenu className="gap-1">
                      {serverSettingsItems
                        .filter((item) => item.id !== 'users' || (currentUser?.is_admin ?? false))
                        .map((item) => (
                          <SidebarMenuItem key={item.id}>
                            <SidebarMenuButton
                              isActive={activePane === item.id}
                              onClick={() => setPreferencesActivePane(item.id)}
                            >
                              <HugeiconsIcon icon={item.icon} />
                              <span>{_(item.label)}</span>
                            </SidebarMenuButton>
                          </SidebarMenuItem>
                        ))}
                    </SidebarMenu>
                  </SidebarGroupContent>
                </SidebarGroup>
              )}
            </SidebarContent>
          </Sidebar>

          <main className="flex flex-1 flex-col overflow-hidden">
            <header className="flex h-16 shrink-0 items-center gap-2 border-b md:hidden">
              <div className="flex flex-1 items-center gap-2 px-4">
                <Breadcrumb>
                  <BreadcrumbList>
                    <BreadcrumbItem>
                      <BreadcrumbLink asChild>
                        <span>{_(msg`Preferences`)}</span>
                      </BreadcrumbLink>
                    </BreadcrumbItem>
                    <BreadcrumbSeparator />
                    <BreadcrumbItem>
                      <BreadcrumbPage>{getPaneTitle(activePane)}</BreadcrumbPage>
                    </BreadcrumbItem>
                  </BreadcrumbList>
                </Breadcrumb>
              </div>
            </header>

            <div className="border-b p-2 md:hidden">
              <div className="space-y-2">
                {/* App Settings */}
                <div className="text-xs font-semibold text-muted-foreground px-2">
                  {_(msg`App Settings`)}
                </div>
                <div className="grid grid-cols-2 gap-1">
                  {appSettingsItems.map((item) => (
                    <Button
                      key={item.id}
                      size="sm"
                      variant={activePane === item.id ? 'secondary' : 'ghost'}
                      className="justify-start"
                      onClick={() => setPreferencesActivePane(item.id)}
                    >
                      <HugeiconsIcon icon={item.icon} className="mr-1.5 size-4" />
                      {_(item.label)}
                    </Button>
                  ))}
                </div>

                {/* Server Settings */}
                {isConnected && (
                  <>
                    <div className="text-xs font-semibold text-muted-foreground px-2 pt-2">
                      {_(msg`Server Settings`)}
                    </div>
                    <div className="grid grid-cols-2 gap-1">
                      {serverSettingsItems
                        .filter((item) => item.id !== 'users' || (currentUser?.is_admin ?? false))
                        .map((item) => (
                          <Button
                            key={item.id}
                            size="sm"
                            variant={activePane === item.id ? 'secondary' : 'ghost'}
                            className="justify-start"
                            onClick={() => setPreferencesActivePane(item.id)}
                          >
                            <HugeiconsIcon icon={item.icon} className="mr-1.5 size-4" />
                            {_(item.label)}
                          </Button>
                        ))}
                    </div>
                  </>
                )}
              </div>
            </div>

            <header className="hidden md:flex h-16 shrink-0 items-center gap-2 border-b px-4">
              <div className="flex items-center gap-2">
                <Breadcrumb>
                  <BreadcrumbList>
                    <BreadcrumbItem>
                      <BreadcrumbLink asChild>
                        <span>{_(msg`Preferences`)}</span>
                      </BreadcrumbLink>
                    </BreadcrumbItem>
                    <BreadcrumbSeparator />
                    <BreadcrumbItem>
                      <BreadcrumbPage>{getPaneTitle(activePane)}</BreadcrumbPage>
                    </BreadcrumbItem>
                  </BreadcrumbList>
                </Breadcrumb>
              </div>
            </header>

            <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-4 pt-0 max-h-[calc(600px-4rem)]">
              {/* App Settings */}
              {activePane === 'general' && <GeneralPane />}
              {activePane === 'appearance' && <AppearancePane />}
              {activePane === 'advanced' && <AdvancedPane />}
              {activePane === 'about' && <AboutPane />}

              {/* Server Settings - shown when connected, otherwise show message */}
              {activePane === 'token' && (isConnected ? <ApiTokenPane /> : <ConnectionStatePane />)}

              {/* Categories pane */}
              {activePane === 'categories' &&
                (isConnected ? (
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
                ) : (
                  <ConnectionStatePane />
                ))}

              {/* Feeds pane */}
              {activePane === 'feeds' &&
                (isConnected ? (
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
                    onEditFeed={(feed) =>
                      setFeedDialogState({
                        mode: 'edit',
                        feed,
                      })
                    }
                    onDeleteFeed={(feed) =>
                      setDeleteDialogState({
                        type: 'feed',
                        id: feed.id,
                        title: feed.title,
                      })
                    }
                    onRefreshAll={() => refreshAllFeeds.mutate()}
                    onExportOpml={handleExportOpml}
                    onImportOpml={handleImportOpml}
                    isRefreshingAll={refreshAllFeeds.isPending}
                  />
                ) : (
                  <ConnectionStatePane />
                ))}

              {/* Users pane */}
              {activePane === 'users' &&
                (isConnected ? (
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
                ) : (
                  <ConnectionStatePane />
                ))}

              {/* Integrations pane */}
              {activePane === 'integrations' &&
                (isConnected ? (
                  <IntegrationsPane
                    integrations={integrations ?? null}
                    isLoading={integrationsLoading}
                  />
                ) : (
                  <ConnectionStatePane />
                ))}
            </div>
          </main>
        </SidebarProvider>
      </DialogContent>

      {/* Nested dialogs for Miniflux entities */}
      <FeedCategoryDialogsHost />

      {/* User form dialog */}
      <UserFormDialog
        key={
          userDialogState?.mode === 'create'
            ? 'create-user'
            : `edit-user-${userDialogState?.user.id}`
        }
        open={!!userDialogState}
        mode={userDialogState?.mode ?? 'create'}
        initialUsername={userDialogState?.mode === 'edit' ? userDialogState?.user.username : ''}
        pending={createUser.isPending || updateUser.isPending}
        onOpenChange={(open: boolean) => {
          if (!open) setUserDialogState(null);
        }}
        onSubmit={handleSubmitUser}
      />

      {/* Delete confirmation dialog */}
      <DeleteEntityDialog
        state={deleteDialogState}
        pending={deleteCategory.isPending || deleteFeed.isPending || deleteUser.isPending}
        onOpenChange={(open: boolean) => {
          if (!open) setDeleteDialogState(null);
        }}
        onConfirm={handleConfirmDelete}
      />
    </Dialog>
  );
}
