import { useEffect } from 'react';
import type { CommandContext } from '@/lib/commands/types';
import { useUIStore } from '@/store/ui-store';

/**
 * Handles global keyboard shortcuts for the application.
 *
 * Currently handles:
 * - Cmd/Ctrl+, : Open preferences
 * - Cmd/Ctrl+1 : Toggle left sidebar
 */
export function useKeyboardShortcuts(commandContext: CommandContext) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey) {
        switch (e.key) {
          case ',': {
            e.preventDefault();
            commandContext.openPreferences();
            break;
          }
          case '1': {
            e.preventDefault();
            const { leftSidebarVisible, setLeftSidebarVisible } = useUIStore.getState();
            setLeftSidebarVisible(!leftSidebarVisible);
            break;
          }
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [commandContext]);
}
