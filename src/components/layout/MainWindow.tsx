import { convertFileSrc } from '@tauri-apps/api/core';
import { useEffect } from 'react';
import { CommandPalette } from '@/components/command-palette/CommandPalette';
import { DownloadManagerDialog } from '@/components/downloads/DownloadManagerDialog';
import { MinifluxSettingsDialogProvider } from '@/components/miniflux/settings/store';
import { PreferencesDialog } from '@/components/preferences/PreferencesDialog';
import { TitleBar } from '@/components/titlebar';
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar';
import { Toaster } from '@/components/ui/sonner';
import { ZenModeView } from '@/components/zen-mode';
import { useTheme } from '@/hooks/use-theme';
import { useMainWindowEventListeners } from '@/hooks/useMainWindowEventListeners';
import { usePreferences } from '@/services/preferences';
import { useUIStore } from '@/store/ui-store';
import { AppSidebar } from './AppSidebar';

interface MainWindowProps {
  children?: React.ReactNode;
}

export function MainWindow({ children }: MainWindowProps = {}) {
  const { theme } = useTheme();
  const leftSidebarVisible = useUIStore((state) => state.leftSidebarVisible);
  const setLeftSidebarVisible = useUIStore((state) => state.setLeftSidebarVisible);
  const zenModeEnabled = useUIStore((state) => state.zenModeEnabled);
  const { data: preferences } = usePreferences();

  useMainWindowEventListeners();

  const bgImagePath = preferences?.background_image_path;
  const bgImageOpacity = preferences?.background_image_opacity ?? 0.15;
  const bgImageBlur = preferences?.background_image_blur ?? 0;
  const bgImageSize = preferences?.background_image_size ?? 'cover';
  const bgTransparency = preferences?.background_transparency ?? 0;
  const isTransparent = !!(bgImagePath && bgTransparency > 0);

  useEffect(() => {
    const html = document.documentElement;
    if (isTransparent) {
      html.setAttribute('data-bg-transparent', '');
      html.style.setProperty('--bg-panel-opacity', String(1 - bgTransparency));
    } else {
      html.removeAttribute('data-bg-transparent');
      html.style.removeProperty('--bg-panel-opacity');
    }
    return () => {
      html.removeAttribute('data-bg-transparent');
      html.style.removeProperty('--bg-panel-opacity');
    };
  }, [isTransparent, bgTransparency]);

  return (
    <div
      className="relative flex h-screen w-full flex-col overflow-hidden rounded-xl bg-background [clip-path:inset(0_round_var(--radius-xl))]"
      style={
        {
          ...(bgImagePath && bgImageSize === 'tile'
            ? {
                backgroundImage: `url(${convertFileSrc(bgImagePath)})`,
                backgroundRepeat: 'repeat',
                backgroundSize: 'auto',
              }
            : {}),
        } as React.CSSProperties
      }
    >
      {bgImagePath && bgImageSize !== 'tile' && (
        <img
          src={convertFileSrc(bgImagePath)}
          alt=""
          className="pointer-events-none absolute -z-10 select-none"
          style={{
            inset: bgImageBlur > 0 ? `${-bgImageBlur * 3}px` : 0,
            objectFit: bgImageSize as 'cover' | 'contain' | 'fill',
            opacity: bgImageOpacity,
            filter: bgImageBlur > 0 ? `blur(${bgImageBlur}px)` : undefined,
          }}
        />
      )}
      {bgImagePath && bgImageSize === 'tile' && (
        <div
          className="pointer-events-none absolute -z-10 select-none"
          style={{
            inset: bgImageBlur > 0 ? `${-bgImageBlur * 3}px` : 0,
            backgroundImage: `url(${convertFileSrc(bgImagePath)})`,
            backgroundRepeat: 'repeat',
            backgroundSize: 'auto',
            opacity: bgImageOpacity,
            filter: bgImageBlur > 0 ? `blur(${bgImageBlur}px)` : undefined,
          }}
        />
      )}
      {!zenModeEnabled && <TitleBar />}
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
      <MinifluxSettingsDialogProvider>
        <PreferencesDialog />
      </MinifluxSettingsDialogProvider>
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

      <ZenModeView />
    </div>
  );
}
