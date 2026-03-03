import type { CommandContext } from '@/lib/commands/types';
import { notify } from '@/lib/notifications';
import { queryClient } from '@/lib/query-client';
import { usePlayerStore } from '@/store/player-store';
import type { PreferencesPane } from '@/store/ui-store';
import { useUIStore } from '@/store/ui-store';

/**
 * Module-level singleton actions safe to call outside React components.
 * Uses getState() at call time, so treat as imperative helpers, not hooks.
 * Note: Store must be initialized before use (always true after app mount).
 */
const commandContext: CommandContext = {
  openPreferences: () => useUIStore.getState().togglePreferences(),
  openPreferencesPane: (pane: string) =>
    useUIStore.getState().openPreferencesToPane(pane as PreferencesPane),
  showToast: (message, type = 'info') => void notify(message, undefined, { type }),
  getSelectedEntryId: () => useUIStore.getState().selectedEntryId,
  isConnected: () => {
    const data = queryClient.getQueryData<boolean>(['miniflux', 'auth', 'connection']);
    return data === true;
  },
  hasPodcast: () => usePlayerStore.getState().currentEntry !== null,
};

/**
 * Command context hook - provides essential actions for commands.
 * Returns a stable reference to avoid unnecessary re-renders.
 */
export function useCommandContext(): CommandContext {
  return commandContext;
}

/**
 * Get the command context singleton for use outside React components.
 */
export function getCommandContext(): CommandContext {
  return commandContext;
}
