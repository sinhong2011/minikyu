import { emit } from '@tauri-apps/api/event';
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { type Theme, ThemeProviderContext } from '@/lib/theme-context';
import { usePreferences, useSavePreferences } from '@/services/preferences';

interface ThemeProviderProps {
  children: React.ReactNode;
  defaultTheme?: Theme;
  storageKey?: string;
}

export function ThemeProvider({
  children,
  defaultTheme = 'system',
  storageKey = 'ui-theme',
  ...props
}: ThemeProviderProps) {
  const [theme, setTheme] = useState<Theme>(
    () => (localStorage.getItem(storageKey) as Theme) || defaultTheme
  );

  // Load theme from persistent preferences
  const { data: preferences } = usePreferences();
  const savePreferences = useSavePreferences();
  const hasSyncedPreferences = useRef(false);

  // Sync theme with preferences when they load
  // This is a legitimate case of syncing with external async state (persistent preferences)
  // The ref ensures this only happens once when preferences first load
  useLayoutEffect(() => {
    if (preferences?.theme && !hasSyncedPreferences.current) {
      hasSyncedPreferences.current = true;
      // eslint-disable-next-line react-hooks/set-state-in-effect -- Syncing with external async preferences on initial load
      setTheme(preferences.theme as Theme);
    }
  }, [preferences?.theme]);

  useEffect(() => {
    const root = window.document.documentElement;
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

    const applyTheme = (isDark: boolean) => {
      root.classList.remove('light', 'dark');
      root.classList.add(isDark ? 'dark' : 'light');
    };

    if (theme === 'system') {
      applyTheme(mediaQuery.matches);

      const handleChange = (e: MediaQueryListEvent) => applyTheme(e.matches);
      mediaQuery.addEventListener('change', handleChange);
      return () => mediaQuery.removeEventListener('change', handleChange);
    }

    applyTheme(theme === 'dark');
  }, [theme]);

  const applyAndSaveTheme = useCallback(
    (newTheme: Theme) => {
      localStorage.setItem(storageKey, newTheme);
      setTheme(newTheme);
      emit('theme-changed', { theme: newTheme });
      const prefs = preferences;
      if (prefs) {
        savePreferences.mutate({ ...prefs, theme: newTheme });
      }
    },
    [storageKey, preferences, savePreferences]
  );

  // Listen for theme switch commands from command palette
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<string>).detail;
      if (detail === 'light' || detail === 'dark' || detail === 'system') {
        applyAndSaveTheme(detail);
      }
    };
    document.addEventListener('command:set-app-theme', handler);
    return () => document.removeEventListener('command:set-app-theme', handler);
  }, [applyAndSaveTheme]);

  const value = {
    theme,
    setTheme: (newTheme: Theme) => {
      localStorage.setItem(storageKey, newTheme);
      setTheme(newTheme);
      // Notify other windows (e.g., quick pane) of theme change
      emit('theme-changed', { theme: newTheme });
    },
  };

  return (
    <ThemeProviderContext.Provider {...props} value={value}>
      {children}
    </ThemeProviderContext.Provider>
  );
}
