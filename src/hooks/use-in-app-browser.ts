import { getCurrentWindow } from '@tauri-apps/api/window';
import { useCallback, useEffect, useRef } from 'react';
import { commands } from '@/lib/tauri-bindings';
import { useUIStore } from '@/store/ui-store';

// Duration matching the shadcn SidebarProvider CSS transition.
const SIDEBAR_ANIMATION_MS = 250;

export function useInAppBrowser() {
  const setInAppBrowserUrl = useUIStore((state) => state.setInAppBrowserUrl);
  const setLeftSidebarVisible = useUIStore((state) => state.setLeftSidebarVisible);
  const inAppBrowserUrl = useUIStore((state) => state.inAppBrowserUrl);

  // Ref to the browser content pane div. InAppBrowserPane assigns this ref
  // so we can read its getBoundingClientRect() after the sidebar animates.
  const browserContentRef = useRef<HTMLDivElement | null>(null);

  /**
   * Opens the browser for the given URL.
   * Hides the sidebar, then after the CSS transition completes reads the
   * pane rect and calls the Tauri open command.
   */
  const openBrowser = useCallback(
    (url: string) => {
      setInAppBrowserUrl(url);
      setLeftSidebarVisible(false);

      setTimeout(() => {
        const el = browserContentRef.current;
        if (!el) return;
        const rect = el.getBoundingClientRect();
        getCurrentWindow()
          .theme()
          .then((theme) =>
            commands.openInAppBrowser(
              url,
              rect.left,
              rect.top,
              rect.width,
              rect.height,
              theme === 'dark'
            )
          )
          .catch((err) => console.error('[useInAppBrowser] open failed:', err));
      }, SIDEBAR_ANIMATION_MS);
    },
    [setInAppBrowserUrl, setLeftSidebarVisible]
  );

  /** Closes the browser and restores the sidebar. */
  const closeBrowser = useCallback(async () => {
    try {
      await commands.closeInAppBrowser();
    } catch (err) {
      console.error('[useInAppBrowser] close failed:', err);
    }
    setInAppBrowserUrl(null);
    setLeftSidebarVisible(true);
  }, [setInAppBrowserUrl, setLeftSidebarVisible]);

  // ESC and Cmd/Ctrl+W close the browser when it is open.
  useEffect(() => {
    if (!inAppBrowserUrl) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        closeBrowser();
      }
      if (e.key === 'w' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        closeBrowser();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [inAppBrowserUrl, closeBrowser]);

  // Sync OS theme changes into the browser webview.
  useEffect(() => {
    if (!inAppBrowserUrl) return;

    let unlistenFn: (() => void) | undefined;

    getCurrentWindow()
      .theme()
      .then((initial) => {
        commands.syncBrowserTheme(initial === 'dark').catch(() => {});
        return getCurrentWindow().onThemeChanged(({ payload }) => {
          commands.syncBrowserTheme(payload === 'dark').catch(() => {});
        });
      })
      .then((unlisten) => {
        unlistenFn = unlisten;
      })
      .catch(() => {});

    return () => {
      unlistenFn?.();
    };
  }, [inAppBrowserUrl]);

  return { openBrowser, closeBrowser, browserContentRef, inAppBrowserUrl };
}
