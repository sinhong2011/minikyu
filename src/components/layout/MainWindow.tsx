import { open as openDialog } from '@tauri-apps/plugin-dialog';
import { lazy, Suspense, useEffect, useRef } from 'react';
import { MinifluxSettingsDialogProvider } from '@/components/miniflux/settings/store';

const CommandPalette = lazy(() =>
  import('@/components/command-palette/CommandPalette').then((m) => ({ default: m.CommandPalette }))
);
const DownloadManagerDialog = lazy(() =>
  import('@/components/downloads/DownloadManagerDialog').then((m) => ({
    default: m.DownloadManagerDialog,
  }))
);
const PreferencesDialog = lazy(() =>
  import('@/components/preferences/PreferencesDialog').then((m) => ({
    default: m.PreferencesDialog,
  }))
);

import { TitleBar } from '@/components/titlebar';
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar';
import { showToast, Toaster } from '@/components/ui/sonner';
import { ZenModeView } from '@/components/zen-mode';
import { useLocalImageUrl } from '@/hooks/use-local-image-url';
import { useIsMobile } from '@/hooks/use-mobile';
import { usePlatform } from '@/hooks/use-platform';
import { useTheme } from '@/hooks/use-theme';
import { useUiFont } from '@/hooks/use-ui-font';
import { useMainWindowEventListeners } from '@/hooks/useMainWindowEventListeners';
import { commands } from '@/lib/tauri-bindings';
import { useDownloadEvents, useDownloads } from '@/services/downloads';
import { usePreferences, useSavePreferences } from '@/services/preferences';
import { useZenMode } from '@/hooks/use-zen-mode';
import { useUIStore } from '@/store/ui-store';
import { capabilities, isWeb } from '@/lib/platform';
import { AppSidebar } from './AppSidebar';

interface MainWindowProps {
  children?: React.ReactNode;
}

export function MainWindow({ children }: MainWindowProps = {}) {
  const { theme } = useTheme();
  const platform = usePlatform();
  const commandPaletteOpen = useUIStore((state) => state.commandPaletteOpen);
  const preferencesOpen = useUIStore((state) => state.preferencesOpen);
  // Latch: once opened, keep the component mounted. A plain `open &&` would
  // unmount on close, discarding dialog state and cutting the exit animation.
  const commandPaletteEverOpened = useRef(false);
  const preferencesEverOpened = useRef(false);
  if (commandPaletteOpen) commandPaletteEverOpened.current = true;
  if (preferencesOpen) preferencesEverOpened.current = true;
  const leftSidebarVisible = useUIStore((state) => state.leftSidebarVisible);
  const mobileSidebarOpen = useUIStore((state) => state.mobileSidebarOpen);
  const setMobileSidebarOpen = useUIStore((state) => state.setMobileSidebarOpen);
  const setLeftSidebarVisible = useUIStore((state) => state.setLeftSidebarVisible);
  const { enabled: zenModeEnabled } = useZenMode();
  const isMobile = useIsMobile();
  // Web phones drop the app header entirely: sync moves into the list title
  // row and navigation lives in the bottom tab bar. The Tauri build keeps it
  // even in narrow windows — it carries the drag region and window controls.
  const hideHeader = isWeb && isMobile;
  // Zen Mode hides the header on desktop, where the OS window chrome is the
  // reason it exists. In a browser tab it is the way back out — the Zen button
  // already renders an "Exit Zen Mode" state — so there it stays.
  const showHeader = !hideHeader && (isWeb || !zenModeEnabled);
  const { data: preferences } = usePreferences();
  const savePreferences = useSavePreferences();

  useMainWindowEventListeners();
  useUiFont();
  // Both mounted here rather than in the download manager: progress and
  // completion toasts must keep flowing while that dialog is closed, and the
  // history has to be hydrated from the DB before the first progress event
  // seeds the cache with a single row.
  useDownloads();
  useDownloadEvents();

  // Handle background image commands from command palette
  useEffect(() => {
    const handleUrl = async (e: Event) => {
      const url = (e as CustomEvent<string>).detail;
      if (!url || !preferences) return;
      try {
        const result = await commands.downloadBackgroundImage(url);
        if (result.status === 'ok') {
          savePreferences.mutate({
            ...preferences,
            background_image_path: result.data,
            background_image_url: url,
          });
        } else {
          showToast.error(result.error);
        }
      } catch {
        showToast.error('Failed to download image');
      }
    };

    const handleFile = async () => {
      if (!preferences) return;
      const filePath = await openDialog({
        title: 'Select Background Image',
        multiple: false,
        filters: [
          { name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'webp', 'gif', 'bmp', 'avif'] },
        ],
      });
      if (!filePath) return;
      savePreferences.mutate({
        ...preferences,
        background_image_path: filePath,
        background_image_url: null,
      });
    };

    // Desktop-only feature; nothing dispatches these in the web build.
    if (!capabilities.backgroundImage) return;

    document.addEventListener('command:set-background-url', handleUrl);
    document.addEventListener('command:select-background-file', handleFile);
    return () => {
      document.removeEventListener('command:set-background-url', handleUrl);
      document.removeEventListener('command:select-background-file', handleFile);
    };
  }, [preferences, savePreferences]);

  const bgImagePath = preferences?.background_image_path;
  const bgImageUrl = useLocalImageUrl(bgImagePath);
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
    <>
      <div
        className={`
          relative flex h-screen w-full flex-col overflow-hidden bg-background
          ${platform === 'macos' ? 'rounded-xl [clip-path:inset(0_round_var(--radius-xl))]' : ''}
        `}
      >
        {bgImageUrl && bgImageSize !== 'tile' && (
          <img
            src={bgImageUrl}
            alt=""
            className="pointer-events-none absolute inset-0 -z-10 size-full select-none"
            style={{
              objectFit: bgImageSize as 'cover' | 'contain' | 'fill',
              opacity: bgImageOpacity,
              filter: bgImageBlur > 0 ? `blur(${bgImageBlur}px)` : undefined,
              ...(bgImageBlur > 0 ? { scale: `${1 + bgImageBlur / 100}` } : {}),
            }}
          />
        )}
        {bgImageUrl && bgImageSize === 'tile' && (
          <div
            className="pointer-events-none absolute inset-0 -z-10 size-full select-none"
            style={{
              backgroundImage: `url(${bgImageUrl})`,
              backgroundRepeat: 'repeat',
              backgroundSize: 'auto',
              opacity: bgImageOpacity,
              filter: bgImageBlur > 0 ? `blur(${bgImageBlur}px)` : undefined,
              ...(bgImageBlur > 0 ? { scale: `${1 + bgImageBlur / 100}` } : {}),
            }}
          />
        )}
        <div className="flex min-h-0 flex-1 flex-col" data-frosted-backdrop>
          {showHeader && <TitleBar />}
          {/*
            Positioning context for the Zen Mode overlay. It covers everything
            below the header rather than the whole window, which is what keeps
            the browser's header — and its Exit Zen Mode button — reachable.
            On desktop the header is gone in Zen Mode anyway, so this box is
            the whole window and nothing changes.
          */}
          <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
            <SidebarProvider
              open={leftSidebarVisible}
              onOpenChange={setLeftSidebarVisible}
              openMobile={mobileSidebarOpen}
              onOpenMobileChange={setMobileSidebarOpen}
              className="overflow-hidden min-h-0 flex-1"
              style={{ '--sidebar-width': '18rem' } as React.CSSProperties}
            >
              <AppSidebar />
              <SidebarInset>{children}</SidebarInset>
            </SidebarProvider>
            <ZenModeView />
          </div>
        </div>

        <Suspense>
          {/* `lazy()` fetches as soon as the component renders, not when it
              becomes visible — rendering these unconditionally pulled their
              chunks into first paint. Mount on first open instead, and stay
              mounted afterwards so dialog state and exit animations survive
              closing. */}
          {commandPaletteEverOpened.current && <CommandPalette />}
          {/* Downloads are served by the Rust downloader; absent in the PWA build. */}
          {capabilities.downloads && <DownloadManagerDialog />}
          {preferencesEverOpened.current && (
            <MinifluxSettingsDialogProvider>
              <PreferencesDialog />
            </MinifluxSettingsDialogProvider>
          )}
        </Suspense>
      </div>
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
    </>
  );
}
