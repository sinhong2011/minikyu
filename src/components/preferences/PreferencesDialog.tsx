import { ColorsIcon, Settings01Icon, ZapIcon } from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react';
import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { useState } from 'react';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
} from '@/components/ui/sidebar';
import { useUIStore } from '@/store/ui-store';
import { AdvancedPane } from './panes/AdvancedPane';
import { AppearancePane } from './panes/AppearancePane';
import { GeneralPane } from './panes/GeneralPane';

type PreferencePane = 'general' | 'appearance' | 'advanced';

const navigationItems = [
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
] as const;

export function PreferencesDialog() {
  const { _ } = useLingui();
  const [activePane, setActivePane] = useState<PreferencePane>('general');
  const preferencesOpen = useUIStore((state) => state.preferencesOpen);
  const setPreferencesOpen = useUIStore((state) => state.setPreferencesOpen);

  const getPaneTitle = (pane: PreferencePane): string => {
    const item = navigationItems.find((i) => i.id === pane);
    return item ? _(item.label) : pane;
  };

  return (
    <Dialog open={preferencesOpen} onOpenChange={setPreferencesOpen}>
      <DialogContent className="overflow-hidden p-0 md:max-h-150 md:max-w-225 lg:max-w-250 font-sans rounded-xl">
        <DialogTitle className="sr-only">{_(msg`Preferences`)}</DialogTitle>
        <DialogDescription className="sr-only">
          {_(msg`Customize your application preferences here.`)}
        </DialogDescription>

        <SidebarProvider className="items-start">
          <Sidebar collapsible="none" className="hidden md:flex bg-background py-4">
            <SidebarContent>
              <SidebarGroup>
                <SidebarGroupContent>
                  <SidebarMenu className="gap-1">
                    {navigationItems.map((item) => (
                      <SidebarMenuItem key={item.id}>
                        <SidebarMenuButton
                          isActive={activePane === item.id}
                          onClick={() => setActivePane(item.id)}
                        >
                          <HugeiconsIcon icon={item.icon} />
                          <span>{_(item.label)}</span>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    ))}
                  </SidebarMenu>
                </SidebarGroupContent>
              </SidebarGroup>
            </SidebarContent>
          </Sidebar>

          <main className="flex flex-1 flex-col overflow-hidden">
            <header className="flex h-16 shrink-0 items-center gap-2">
              <div className="flex items-center gap-2 px-4">
                <Breadcrumb>
                  <BreadcrumbList>
                    <BreadcrumbItem className="hidden md:block">
                      <BreadcrumbLink asChild>
                        <span>{_(msg`Preferences`)}</span>
                      </BreadcrumbLink>
                    </BreadcrumbItem>
                    <BreadcrumbSeparator className="hidden md:block" />
                    <BreadcrumbItem>
                      <BreadcrumbPage>{getPaneTitle(activePane)}</BreadcrumbPage>
                    </BreadcrumbItem>
                  </BreadcrumbList>
                </Breadcrumb>
              </div>
            </header>

            <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-4 pt-0 max-h-[calc(600px-4rem)]">
              {activePane === 'general' && <GeneralPane />}
              {activePane === 'appearance' && <AppearancePane />}
              {activePane === 'advanced' && <AdvancedPane />}
            </div>
          </main>
        </SidebarProvider>
      </DialogContent>
    </Dialog>
  );
}
