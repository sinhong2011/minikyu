import { useEffect, useState } from 'react';
import type { AccountTranslationExclusions } from '@/lib/bindings';
import { normalizeReaderCodeTheme, type ReaderCodeTheme } from '@/lib/shiki-highlight';
import type { AppPreferences } from '@/lib/tauri-bindings';
import { useActiveAccount } from '@/services/miniflux/accounts';
import { usePreferences, useSavePreferences } from '@/services/preferences';

/** Build the account key used to index per-account translation exclusions. */
export function buildAccountExclusionKey(serverUrl: string, username: string): string {
  return `${serverUrl}|${username}`;
}

// CJK Unified Ideographs ranges for Chinese detection
const CJK_REGEX =
  /[\u4E00-\u9FFF\u3400-\u4DBF\uF900-\uFAFF\u{20000}-\u{2A6DF}\u{2A700}-\u{2B73F}]/u;

/**
 * Detect the likely source language of text by checking character composition.
 * Returns "zh" if Chinese characters dominate, otherwise null.
 */
export function detectSourceLanguage(text: string): string | null {
  if (!text) return null;
  const sample = text.slice(0, 500);
  let cjkCount = 0;
  let totalAlphaNum = 0;
  for (const char of sample) {
    if (CJK_REGEX.test(char)) {
      cjkCount++;
      totalAlphaNum++;
    } else if (/\p{L}|\p{N}/u.test(char)) {
      totalAlphaNum++;
    }
  }
  if (totalAlphaNum === 0) return null;
  // If more than 30% of alpha-numeric characters are CJK, treat as Chinese
  if (cjkCount / totalAlphaNum > 0.3) return 'zh';
  return null;
}

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
  const { data: activeAccount } = useActiveAccount();
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

  const accountKey = activeAccount
    ? buildAccountExclusionKey(activeAccount.server_url, activeAccount.username)
    : null;

  const defaultExclusions: AccountTranslationExclusions = {
    // biome-ignore lint/style/useNamingConvention: Rust struct field name
    feed_ids: [],
    // biome-ignore lint/style/useNamingConvention: Rust struct field name
    category_ids: [],
  };
  const currentExclusions: AccountTranslationExclusions =
    (accountKey ? preferences?.reader_translation_exclusions?.[accountKey] : undefined) ??
    defaultExclusions;

  const updateExclusions = (updated: AccountTranslationExclusions) => {
    if (!preferences || !accountKey) return;
    savePreferences({
      ...preferences,
      // biome-ignore lint/style/useNamingConvention: preferences field name
      reader_translation_exclusions: {
        ...preferences.reader_translation_exclusions,
        [accountKey]: updated,
      },
    });
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
    focusMode: preferences?.reader_focus_mode ?? false,
    autoMarkRead: preferences?.reader_auto_mark_read ?? false,
    translationDisplayMode: preferences?.reader_translation_display_mode ?? 'bilingual',
    translationTriggerMode: preferences?.reader_translation_trigger_mode ?? 'manual',
    translationRouteMode: preferences?.reader_translation_route_mode ?? 'engine_first',
    translationTargetLanguage: preferences?.reader_translation_target_language ?? null,
    translationPrimaryEngine: preferences?.reader_translation_primary_engine ?? null,
    translationEngineFallbacks: preferences?.reader_translation_engine_fallbacks ?? [],
    translationLlmFallbacks: preferences?.reader_translation_llm_fallbacks ?? [],
    appleTranslationFallbackEnabled:
      preferences?.reader_translation_apple_fallback_enabled ?? false,
    translationAutoEnabled: preferences?.reader_translation_auto_enabled ?? false,
    translationExcludedFeedIds: currentExclusions.feed_ids ?? [],
    translationExcludedCategoryIds: currentExclusions.category_ids ?? [],
    translationSkipSourceLanguages: preferences?.reader_translation_skip_source_languages ?? [],
    translationProviderSettings: preferences?.reader_translation_provider_settings ?? {},
    aiSummaryAutoEnabled: preferences?.ai_summary_auto_enabled ?? false,
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
    setFocusMode: (enabled: boolean) => updateSetting('reader_focus_mode', enabled),
    setAutoMarkRead: (enabled: boolean) => updateSetting('reader_auto_mark_read', enabled),
    setTranslationDisplayMode: (mode: AppPreferences['reader_translation_display_mode']) =>
      updateSetting('reader_translation_display_mode', mode),
    setTranslationTriggerMode: (mode: AppPreferences['reader_translation_trigger_mode']) =>
      updateSetting('reader_translation_trigger_mode', mode),
    setTranslationRouteMode: (mode: AppPreferences['reader_translation_route_mode']) =>
      updateSetting('reader_translation_route_mode', mode),
    setTranslationTargetLanguage: (
      language: AppPreferences['reader_translation_target_language']
    ) => updateSetting('reader_translation_target_language', language),
    setAppleTranslationFallbackEnabled: (enabled: boolean) =>
      updateSetting('reader_translation_apple_fallback_enabled', enabled),
    setTranslationAutoEnabled: (enabled: boolean) =>
      updateSetting('reader_translation_auto_enabled', enabled),
    setTranslationExcludedFeedIds: (ids: string[]) =>
      // biome-ignore lint/style/useNamingConvention: Rust struct field name
      updateExclusions({ ...currentExclusions, feed_ids: ids }),
    setTranslationExcludedCategoryIds: (ids: string[]) =>
      // biome-ignore lint/style/useNamingConvention: Rust struct field name
      updateExclusions({ ...currentExclusions, category_ids: ids }),
    setTranslationSkipSourceLanguages: (langs: string[]) =>
      updateSetting('reader_translation_skip_source_languages', langs),
    setAiSummaryAutoEnabled: (enabled: boolean) =>
      updateSetting('ai_summary_auto_enabled', enabled),
    setCodeTheme: (theme: ReaderCodeTheme) => {
      const normalizedTheme = normalizeReaderCodeTheme(theme);
      setCodeThemeOverride(normalizedTheme);
      updateSetting('reader_code_theme', normalizedTheme);
    },
  };
}
