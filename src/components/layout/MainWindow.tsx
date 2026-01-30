import { Toaster } from 'sonner';
import { SidebarInset, SidebarProvider } from '@/components/animate-ui/components/radix/sidebar';
import { CommandPalette } from '@/components/command-palette/CommandPalette';
import { PreferencesDialog } from '@/components/preferences/PreferencesDialog';
import { TitleBar } from '@/components/titlebar';
import { useTheme } from '@/hooks/use-theme';
import { useMainWindowEventListeners } from '@/hooks/useMainWindowEventListeners';
import { useUIStore } from '@/store/ui-store';
import { LeftSideBar } from './LeftSideBar';
import { MainWindowContent } from './MainWindowContent';

interface MainWindowProps {
  children?: React.ReactNode;
}

export function MainWindow({ children }: MainWindowProps = {}) {
  const { theme } = useTheme();
  const leftSidebarVisible = useUIStore((state) => state.leftSidebarVisible);
  const setLeftSidebarVisible = useUIStore((state) => state.setLeftSidebarVisible);

  useMainWindowEventListeners();

  return (
    <div className="flex h-screen w-full flex-col overflow-hidden rounded-xl bg-background">
      <TitleBar />
      <SidebarProvider
        open={leftSidebarVisible}
        onOpenChange={setLeftSidebarVisible}
        className="overflow-hidden"
        style={{ '--sidebar-width': '18rem' } as React.CSSProperties}
      >
        <LeftSideBar />
        <SidebarInset>
          <MainWindowContent>{children}</MainWindowContent>
        </SidebarInset>
      </SidebarProvider>

      <CommandPalette />
      <PreferencesDialog />
      <Toaster
        position="bottom-right"
        theme={theme === 'dark' ? 'dark' : theme === 'light' ? 'light' : 'system'}
        className="toaster group"
        toastOptions={{
          classNames: {
            toast:
              'group toast group-[.toaster]:bg-background group-[.toaster]:text-foreground group-[.toaster]:border-border group-[.toaster]:shadow-lg',
            description: 'group-[.toast]:text-muted-foreground',
            actionButton: 'group-[.toast]:bg-primary group-[.toast]:text-primary-foreground',
            cancelButton: 'group-[.toast]:bg-muted group-[.toast]:text-muted-foreground',
          },
        }}
      />
    </div>
  );
}
