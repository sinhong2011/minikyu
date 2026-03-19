import { useCallback, useEffect, useRef, useState } from 'react';
import { commands } from '@/lib/tauri-bindings';
import { useUIStore } from '@/store/ui-store';

export function useInAppBrowser() {
  const setInAppBrowserUrl = useUIStore((state) => state.setInAppBrowserUrl);
  const inAppBrowserUrl = useUIStore((state) => state.inAppBrowserUrl);
  const selectedEntryId = useUIStore((state) => state.selectedEntryId);
  // Modal states — native webview must be hidden while these are open because
  // WKWebView sits above all React content regardless of CSS z-index.
  const preferencesOpen = useUIStore((state) => state.preferencesOpen);
  const downloadsOpen = useUIStore((state) => state.downloadsOpen);
  const commandPaletteOpen = useUIStore((state) => state.commandPaletteOpen);

  // Ref to the browser content pane element. InAppBrowserPane assigns this ref
  // so we can read its getBoundingClientRect() after the sidebar animates.
  const browserContentRef = useRef<HTMLElement | null>(null);

  // Track the app's effective dark mode by watching the <html> class attribute.
  // This reflects ThemeProvider's actual resolved theme rather than the OS-level
  // setting, so it stays correct when the user manually selects light/dark in prefs.
  const [isDark, setIsDark] = useState(() => document.documentElement.classList.contains('dark'));
  useEffect(() => {
    const observer = new MutationObserver(() => {
      setIsDark(document.documentElement.classList.contains('dark'));
    });
    observer.observe(document.documentElement, { attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);

  /** Opens the browser for the given URL. */
  const openBrowser = useCallback(
    (url: string) => {
      setInAppBrowserUrl(url);
    },
    [setInAppBrowserUrl]
  );

  // Open the native webview after React commits the browser pane to the DOM.
  // Using useEffect guarantees browserContentRef.current is valid and the
  // element is at its final position (no CSS transform offset from x animation).
  useEffect(() => {
    if (!inAppBrowserUrl) return;
    const el = browserContentRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const dark = document.documentElement.classList.contains('dark');
    commands
      .openInAppBrowser(inAppBrowserUrl, rect.left, rect.top, rect.width, rect.height, dark)
      .catch((err) => console.error('[useInAppBrowser] open failed:', err));
  }, [inAppBrowserUrl]);

  /** Closes the browser. */
  const closeBrowser = useCallback(async () => {
    try {
      await commands.closeInAppBrowser();
    } catch (err) {
      console.error('[useInAppBrowser] close failed:', err);
    }
    setInAppBrowserUrl(null);
  }, [setInAppBrowserUrl]);

  // Close the browser when the user navigates to a different entry.
  // Tracks the previous selectedEntryId so we only close on actual changes.
  const prevSelectedEntryIdRef = useRef(selectedEntryId);
  useEffect(() => {
    const changed = prevSelectedEntryIdRef.current !== selectedEntryId;
    prevSelectedEntryIdRef.current = selectedEntryId;
    if (inAppBrowserUrl && changed) {
      closeBrowser();
    }
  }, [selectedEntryId, inAppBrowserUrl, closeBrowser]);

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

  // Sync app theme into the browser webview whenever the effective resolved
  // theme changes (user switches light ↔ dark ↔ system, or OS theme changes
  // while app is set to system).
  useEffect(() => {
    if (!inAppBrowserUrl) return;
    commands.syncBrowserTheme(isDark).catch(() => {});
  }, [isDark, inAppBrowserUrl]);

  // Hide the native webview while modal dialogs are open. WKWebView is a
  // native OS view that sits above all React content, so it would overlap
  // dialogs if left visible. Restoring uses the current section rect so it
  // re-aligns correctly even if the window was resized while hidden.
  useEffect(() => {
    if (!inAppBrowserUrl) return;

    if (preferencesOpen || downloadsOpen || commandPaletteOpen) {
      commands.resizeBrowserWebview(0, 0, 0, 0).catch(() => {});
    } else {
      const el = browserContentRef.current;
      if (!el) return;
      const { left, top, width, height } = el.getBoundingClientRect();
      commands.resizeBrowserWebview(left, top, width, height).catch(() => {});
    }
  }, [preferencesOpen, downloadsOpen, commandPaletteOpen, inAppBrowserUrl]);

  return { openBrowser, closeBrowser, browserContentRef, inAppBrowserUrl };
}
