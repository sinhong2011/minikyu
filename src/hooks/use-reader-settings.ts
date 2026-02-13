import { useEffect, useState } from 'react';
import { normalizeReaderCodeTheme, type ReaderCodeTheme } from '@/lib/shiki-highlight';
import type { AppPreferences } from '@/lib/tauri-bindings';
import { usePreferences, useSavePreferences } from '@/services/preferences';

const READER_CODE_THEME_STORAGE_KEY = 'reader-code-theme';
const DEFAULT_READER_FONT_SIZE = 16;
const DEFAULT_READER_LINE_WIDTH = 65;
const DEFAULT_READER_LINE_HEIGHT = 1.75;
const DEFAULT_READER_FONT_FAMILY = 'sans-serif';

/**
 * Hook to manage reader settings, integrating with the global preferences system.
 */
export function useReaderSettings() {
  const { data: preferences, isLoading } = usePreferences();
  const { mutate: savePreferences } = useSavePreferences();
  const [codeThemeOverride, setCodeThemeOverride] = useState<ReaderCodeTheme | null>(null);
  const persistedCodeTheme = normalizeReaderCodeTheme(preferences?.reader_code_theme);
  const codeTheme = codeThemeOverride ?? persistedCodeTheme;

  const updateSetting = <K extends keyof AppPreferences>(key: K, value: AppPreferences[K]) => {
    if (preferences) {
      savePreferences({
        ...preferences,
        [key]: value,
      });
    }
  };

  useEffect(() => {
    if (codeThemeOverride === null) {
      return;
    }

    if (codeThemeOverride === persistedCodeTheme) {
      setCodeThemeOverride(null);
    }
  }, [codeThemeOverride, persistedCodeTheme]);

  useEffect(() => {
    // One-time migration from legacy localStorage theme setting to preferences.json.
    if (typeof window === 'undefined' || !preferences) {
      return;
    }

    const storedLegacyTheme = window.localStorage.getItem(READER_CODE_THEME_STORAGE_KEY);
    if (!storedLegacyTheme) {
      return;
    }

    window.localStorage.removeItem(READER_CODE_THEME_STORAGE_KEY);

    const normalizedLegacyTheme = normalizeReaderCodeTheme(storedLegacyTheme);
    const currentTheme = normalizeReaderCodeTheme(preferences.reader_code_theme);

    if (normalizedLegacyTheme !== currentTheme) {
      savePreferences({
        ...preferences,
        // biome-ignore lint/style/useNamingConvention: preferences field name
        reader_code_theme: normalizedLegacyTheme,
      });
    }
  }, [preferences, savePreferences]);

  return {
    fontSize: preferences?.reader_font_size ?? 16,
    lineWidth: preferences?.reader_line_width ?? 65,
    lineHeight: preferences?.reader_line_height ?? 1.75,
    fontFamily: preferences?.reader_font_family ?? 'sans-serif',
    readerTheme: preferences?.reader_theme ?? 'default',
    chineseConversionMode: preferences?.reader_chinese_conversion ?? 's2tw',
    customConversionRules: preferences?.reader_custom_conversions ?? [],
    bionicReading: preferences?.reader_bionic_reading ?? false,
    statusBarVisible: preferences?.reader_status_bar ?? false,
    codeTheme,
    isLoading,
    setFontSize: (size: number) => updateSetting('reader_font_size', size),
    setLineWidth: (width: number) => updateSetting('reader_line_width', width),
    setLineHeight: (lineHeight: number) => updateSetting('reader_line_height', lineHeight),
    setFontFamily: (family: string) => updateSetting('reader_font_family', family),
    setReaderTheme: (theme: string) => updateSetting('reader_theme', theme),
    resetReaderTypography: () => {
      if (!preferences) {
        return;
      }

      savePreferences({
        ...preferences,
        // biome-ignore lint/style/useNamingConvention: preferences field name
        reader_font_size: DEFAULT_READER_FONT_SIZE,
        // biome-ignore lint/style/useNamingConvention: preferences field name
        reader_line_width: DEFAULT_READER_LINE_WIDTH,
        // biome-ignore lint/style/useNamingConvention: preferences field name
        reader_line_height: DEFAULT_READER_LINE_HEIGHT,
        // biome-ignore lint/style/useNamingConvention: preferences field name
        reader_font_family: DEFAULT_READER_FONT_FAMILY,
      });
    },
    setChineseConversionMode: (mode: AppPreferences['reader_chinese_conversion']) =>
      updateSetting('reader_chinese_conversion', mode),
    setBionicReading: (enabled: boolean) => updateSetting('reader_bionic_reading', enabled),
    setStatusBarVisible: (enabled: boolean) => updateSetting('reader_status_bar', enabled),
    setCodeTheme: (theme: ReaderCodeTheme) => {
      const normalizedTheme = normalizeReaderCodeTheme(theme);
      setCodeThemeOverride(normalizedTheme);
      updateSetting('reader_code_theme', normalizedTheme);
    },
  };
}
