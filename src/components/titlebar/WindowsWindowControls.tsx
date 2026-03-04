import { i18n } from '@lingui/core';
import { msg } from '@lingui/core/macro';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { useEffect, useState } from 'react';
import { useCommandContext } from '@/hooks/use-command-context';
import { executeCommand } from '@/lib/commands';
import { cn } from '@/lib/utils';
import { WindowsIcons } from './WindowControlIcons';

/**
 * Windows-style window control buttons (minimize, maximize/restore, close).
 * Positioned on the RIGHT side of the title bar, following Windows conventions.
 */
export function WindowsWindowControls() {
  const context = useCommandContext();
  const [isMaximized, setIsMaximized] = useState(false);

  // Initialize and sync maximized state with actual window state
  useEffect(() => {
    const appWindow = getCurrentWindow();

    // Query initial state
    appWindow
      .isMaximized()
      .then(setIsMaximized)
      .catch(() => {
        // Ignore errors - window may not be ready
      });

    // Subscribe to resize events to keep state in sync
    // (handles maximize/unmaximize via title bar double-click, etc.)
    let aborted = false;
    let resolvedUnsub: (() => void) | null = null;

    appWindow
      .onResized(async () => {
        try {
          const maximized = await appWindow.isMaximized();
          if (!aborted) setIsMaximized(maximized);
        } catch {
          // Ignore errors during cleanup
        }
      })
      .then((unsub) => {
        // If already aborted, unsubscribe immediately
        if (aborted) {
          unsub();
        } else {
          resolvedUnsub = unsub;
        }
      });

    return () => {
      aborted = true;
      // If unsubscribe has resolved, call it; otherwise it will be called in the then handler
      if (resolvedUnsub) {
        resolvedUnsub();
      }
    };
  }, []);

  const handleClose = async () => {
    await executeCommand('window-close', context);
  };

  const handleMinimize = async () => {
    await executeCommand('window-minimize', context);
  };

  const handleMaximizeToggle = async () => {
    try {
      const appWindow = getCurrentWindow();
      const maximized = await appWindow.isMaximized();
      if (maximized) {
        await appWindow.unmaximize();
        setIsMaximized(false);
      } else {
        await appWindow.maximize();
        setIsMaximized(true);
      }
    } catch {
      await executeCommand('window-toggle-maximize', context);
    }
  };

  // Base button styles for Windows controls
  const buttonClass = 'flex h-8 w-12 items-center justify-center transition-colors';

  return (
    <div className="flex">
      {/* Minimize */}
      <button
        type="button"
        onClick={handleMinimize}
        className={cn(buttonClass, 'hover:bg-foreground/10')}
        title={i18n._(msg`Minimize`)}
        aria-label={i18n._(msg`Minimize window`)}
      >
        <WindowsIcons.minimize />
      </button>

      {/* Maximize/Restore */}
      <button
        type="button"
        onClick={handleMaximizeToggle}
        className={cn(buttonClass, 'hover:bg-foreground/10')}
        title={isMaximized ? i18n._(msg`Restore`) : i18n._(msg`Maximize`)}
        aria-label={isMaximized ? i18n._(msg`Restore window`) : i18n._(msg`Maximize window`)}
      >
        {isMaximized ? <WindowsIcons.restore /> : <WindowsIcons.maximize />}
      </button>

      {/* Close */}
      <button
        type="button"
        onClick={handleClose}
        className={cn(buttonClass, 'hover:bg-destructive hover:text-destructive-foreground')}
        title={i18n._(msg`Close`)}
        aria-label={i18n._(msg`Close window`)}
      >
        <WindowsIcons.close />
      </button>
    </div>
  );
}
