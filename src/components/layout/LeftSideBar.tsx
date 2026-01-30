import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { Link } from '@tanstack/react-router';
import {
  ChevronRight,
  Component,
  FileText,
  Folder,
  Forward,
  Home,
  LayoutTemplate,
  MoreHorizontal,
  Settings,
  Trash2,
} from 'lucide-react';
import type * as React from 'react';
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
} from '@/components/animate-ui/components/radix/sidebar';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/animate-ui/primitives/radix/collapsible';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/animate-ui/primitives/radix/dropdown-menu';
import { useCommandContext } from '@/hooks/use-command-context';
import { useIsMobile } from '@/hooks/use-mobile';
import { executeCommand } from '@/lib/commands';
import { cn } from '@/lib/utils';

interface LeftSideBarProps {
  children?: React.ReactNode;
  className?: string;
}

const DATA = {
  navMain: [
    {
      title: 'Home',
      icon: Home,
      url: '/',
    },
    {
      title: 'Components',
      icon: Component,
      url: '/components',
    },
    {
      title: 'Templates',
      icon: LayoutTemplate,
      url: '/templates',
    },
  ],
  projects: [
    {
      name: 'Project 1',
      icon: Folder,
      items: [
        {
          title: 'Document 1',
          url: '#',
        },
        {
          title: 'Document 2',
          url: '#',
        },
        {
          title: 'Document 3',
          url: '#',
        },
      ],
    },
    {
      name: 'Project 2',
      icon: Folder,
      items: [
        {
          title: 'Document A',
          url: '#',
        },
        {
          title: 'Document B',
          url: '#',
        },
      ],
    },
  ],
};

function SettingsButton() {
  const { _ } = useLingui();
  const commandContext = useCommandContext();

  const handleOpenSettings = async () => {
    const result = await executeCommand('open-preferences', commandContext);
    if (!result.success && result.error) {
      commandContext.showToast(result.error, 'error');
    }
  };

  return (
    <SidebarMenuButton tooltip="Settings" onClick={handleOpenSettings}>
      <Settings className="size-4" />
      <span>{_(msg`Settings`)}</span>
    </SidebarMenuButton>
  );
}

export function LeftSideBar({ children, className }: LeftSideBarProps) {
  const isMobile = useIsMobile();

  return (
    <Sidebar side="left" variant="sidebar" collapsible="icon" className={cn(className)}>
      <SidebarHeader className="overflow-hidden"></SidebarHeader>

      <SidebarContent>
        {/* Navigation Section */}
        <SidebarGroup>
          <SidebarGroupLabel>Navigation</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {DATA.navMain.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton tooltip={item.title} asChild>
                    <Link to={item.url}>
                      <item.icon />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Projects Section */}
        <SidebarGroup>
          <SidebarGroupLabel>Projects</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {DATA.projects.map((project, index) => (
                <Collapsible
                  key={project.name}
                  defaultOpen={index === 0}
                  className="group/collapsible"
                >
                  <SidebarMenuItem>
                    <SidebarMenuButton asChild tooltip={project.name}>
                      <CollapsibleTrigger className="w-full">
                        <project.icon />
                        <span>{project.name}</span>
                        <ChevronRight className="ml-auto h-4 w-4 transition-transform duration-300 group-data-[state=open]/collapsible:rotate-90" />
                      </CollapsibleTrigger>
                    </SidebarMenuButton>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <SidebarMenuAction showOnHover>
                          <MoreHorizontal />
                          <span className="sr-only">More</span>
                        </SidebarMenuAction>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent
                        className="w-48 rounded-lg"
                        side={isMobile ? 'bottom' : 'right'}
                        align={isMobile ? 'end' : 'start'}
                      >
                        <DropdownMenuItem>
                          <Folder className="text-muted-foreground" />
                          <span>View Project</span>
                        </DropdownMenuItem>
                        <DropdownMenuItem>
                          <Forward className="text-muted-foreground" />
                          <span>Share Project</span>
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem className="text-destructive focus:bg-destructive/10 focus:text-destructive">
                          <Trash2 className="text-muted-foreground" />
                          <span>Delete Project</span>
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                    <CollapsibleContent>
                      <SidebarMenuSub>
                        {project.items.map((subItem) => (
                          <SidebarMenuSubItem key={subItem.title}>
                            <SidebarMenuSubButton asChild>
                              <Link to={subItem.url}>
                                <FileText />
                                <span>{subItem.title}</span>
                              </Link>
                            </SidebarMenuSubButton>
                          </SidebarMenuSubItem>
                        ))}
                      </SidebarMenuSub>
                    </CollapsibleContent>
                  </SidebarMenuItem>
                </Collapsible>
              ))}
              <SidebarMenuItem>
                <SidebarMenuButton className="text-sidebar-foreground/70">
                  <MoreHorizontal className="text-sidebar-foreground/70" />
                  <span>More</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {children}
      </SidebarContent>

      <SidebarFooter className="h-12">
        <SettingsButton />
      </SidebarFooter>
    </Sidebar>
  );
}
