import { useCallback, useMemo } from 'react';
import { matchesShortcut, resolveShortcut, SHORTCUT_ACTIONS } from '@/lib/shortcut-registry';
import { usePreferences, useSavePreferences } from '@/services/preferences';

/**
 * Hook to read/write keyboard shortcut configuration from preferences.
 */
export function useShortcutConfig() {
  const { data: preferences } = usePreferences();
  const { mutate: savePreferences } = useSavePreferences();

  const overrides = preferences?.keyboard_shortcuts;

  /** Resolve a single action to its effective shortcut string. */
  const getShortcut = useCallback(
    (actionId: string) => resolveShortcut(actionId, overrides),
    [overrides]
  );

  /** Check if a KeyboardEvent matches the shortcut for the given action. */
  const matches = useCallback(
    (actionId: string, e: KeyboardEvent) => {
      const shortcut = resolveShortcut(actionId, overrides);
      return matchesShortcut(e, shortcut);
    },
    [overrides]
  );

  /** Set a custom shortcut for an action. Pass null to reset to default. */
  const setShortcut = useCallback(
    (actionId: string, shortcut: string | null) => {
      if (!preferences) return;

      const current = { ...(preferences.keyboard_shortcuts ?? {}) };

      if (shortcut === null) {
        delete current[actionId];
      } else {
        // If the new shortcut matches the default, remove the override
        const action = SHORTCUT_ACTIONS.find((a) => a.id === actionId);
        if (action && shortcut === action.defaultKey) {
          delete current[actionId];
        } else {
          current[actionId] = shortcut;
        }
      }

      savePreferences({
        ...preferences,
        // biome-ignore lint/style/useNamingConvention: preferences field name
        keyboard_shortcuts: current,
      });
    },
    [preferences, savePreferences]
  );

  /** Reset all shortcuts to defaults. */
  const resetAll = useCallback(() => {
    if (!preferences) return;
    savePreferences({
      ...preferences,
      // biome-ignore lint/style/useNamingConvention: preferences field name
      keyboard_shortcuts: {},
    });
  }, [preferences, savePreferences]);

  /** Pre-resolved map of all shortcuts for efficient use in keyboard handlers. */
  const resolved = useMemo(() => {
    const map: Record<string, string> = {};
    for (const action of SHORTCUT_ACTIONS) {
      map[action.id] = resolveShortcut(action.id, overrides);
    }
    return map;
  }, [overrides]);

  return { getShortcut, matches, setShortcut, resetAll, resolved, overrides };
}
