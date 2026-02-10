import { useEffect, useState } from 'react';
import { normalizeReaderCodeTheme, type ReaderCodeTheme } from '@/lib/shiki-highlight';
import type { AppPreferences } from '@/lib/tauri-bindings';
import { usePreferences, useSavePreferences } from '@/services/preferences';

const READER_CODE_THEME_STORAGE_KEY = 'reader-code-theme';

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
    fontFamily: preferences?.reader_font_family ?? 'sans-serif',
    chineseConversionMode: preferences?.reader_chinese_conversion ?? 's2tw',
    customConversionRules: preferences?.reader_custom_conversions ?? [],
    bionicReading: preferences?.reader_bionic_reading ?? false,
    codeTheme,
    isLoading,
    setFontSize: (size: number) => updateSetting('reader_font_size', size),
    setLineWidth: (width: number) => updateSetting('reader_line_width', width),
    setFontFamily: (family: string) => updateSetting('reader_font_family', family),
    setChineseConversionMode: (mode: AppPreferences['reader_chinese_conversion']) =>
      updateSetting('reader_chinese_conversion', mode),
    setBionicReading: (enabled: boolean) => updateSetting('reader_bionic_reading', enabled),
    setCodeTheme: (theme: ReaderCodeTheme) => {
      const normalizedTheme = normalizeReaderCodeTheme(theme);
      setCodeThemeOverride(normalizedTheme);
      updateSetting('reader_code_theme', normalizedTheme);
    },
  };
}
