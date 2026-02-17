import {
  ColorsIcon,
  Folder01Icon,
  InformationCircleIcon,
  Key01Icon,
  RssIcon,
  Settings01Icon,
  UserGroupIcon,
  ZapIcon,
} from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react';
import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { FeedCategoryDialogsHost } from '@/components/miniflux/settings/FeedCategoryDialogsHost';
import { MinifluxSettingsDialogProvider } from '@/components/miniflux/settings/store';
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
import { useCurrentUser, useIsConnected } from '@/services/miniflux';
import { type PreferencesPane, useUIStore } from '@/store/ui-store';
import { AboutPane } from './panes/AboutPane';
import { AdvancedPane } from './panes/AdvancedPane';
import { ApiTokenPane } from './panes/ApiTokenPane';
import { AppearancePane } from './panes/AppearancePane';
import { GeneralPane } from './panes/GeneralPane';

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

  const getPaneTitle = (pane: PreferencesPane): string => {
    const allItems = [...appSettingsItems, ...serverSettingsItems];
    const item = allItems.find((i) => i.id === pane);
    return item ? _(item.label) : pane;
  };

  return (
    <MinifluxSettingsDialogProvider>
      <Dialog open={preferencesOpen} onOpenChange={setPreferencesOpen}>
        <DialogContent className="overflow-hidden p-0 md:max-h-150 md:max-w-225 lg:max-w-250 font-sans rounded-xl">
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
                {activePane === 'token' &&
                  (isConnected ? <ApiTokenPane /> : <ConnectionStatePane />)}

                {/* TODO: Add props handling in Task 5 for Categories, Feeds, Users panes */}
                {activePane === 'categories' && <ConnectionStatePane />}
                {activePane === 'feeds' && <ConnectionStatePane />}
                {activePane === 'users' && <ConnectionStatePane />}
              </div>
            </main>
          </SidebarProvider>
        </DialogContent>

        {/* Nested dialogs for Miniflux entities */}
        <FeedCategoryDialogsHost />
      </Dialog>
    </MinifluxSettingsDialogProvider>
  );
}
