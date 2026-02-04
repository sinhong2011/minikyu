import { CommandPalette } from '@/components/command-palette/CommandPalette';
import { DownloadManagerDialog } from '@/components/downloads/DownloadManagerDialog';
import { PreferencesDialog } from '@/components/preferences/PreferencesDialog';
import { TitleBar } from '@/components/titlebar';
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar';
import { Toaster } from '@/components/ui/sonner';
import { useTheme } from '@/hooks/use-theme';
import { useMainWindowEventListeners } from '@/hooks/useMainWindowEventListeners';
import { useUIStore } from '@/store/ui-store';
import { AppSidebar } from './AppSidebar';

interface MainWindowProps {
  children?: React.ReactNode;
}

export function MainWindow({ children }: MainWindowProps = {}) {
  const { theme } = useTheme();
  const leftSidebarVisible = useUIStore((state) => state.leftSidebarVisible);
  const setLeftSidebarVisible = useUIStore((state) => state.setLeftSidebarVisible);

  useMainWindowEventListeners();

  return (
    <div className="relative flex h-screen w-full flex-col overflow-hidden rounded-xl bg-background">
      <TitleBar />
      <SidebarProvider
        open={leftSidebarVisible}
        onOpenChange={setLeftSidebarVisible}
        className="overflow-hidden min-h-0 flex-1"
        style={{ '--sidebar-width': '18rem' } as React.CSSProperties}
      >
        <AppSidebar />
        <SidebarInset>{children}</SidebarInset>
      </SidebarProvider>

      <CommandPalette />
      <DownloadManagerDialog />
      <PreferencesDialog />
      <Toaster
        position="top-center"
        theme={theme === 'dark' ? 'dark' : theme === 'light' ? 'light' : 'system'}
        toastOptions={{
          classNames: {
            toast:
              'group toast group-[.toaster]:bg-background group-[.toaster]:text-foreground group-[.toaster]:border-border group-[.toaster]:shadow-lg cursor-pointer hover:opacity-90 transition-opacity',
            description: 'group-[.toast]:text-muted-foreground select-text',
            actionButton: 'group-[.toast]:bg-primary group-[.toast]:text-primary-foreground',
            cancelButton: 'group-[.toast]:bg-muted group-[.toast]:text-muted-foreground',
          },
        }}
      />
    </div>
  );
}
