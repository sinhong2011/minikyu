import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AppPreferences } from '@/lib/tauri-bindings';
import { usePreferences, useSavePreferences } from '@/services/preferences';
import { useReaderSettings } from './use-reader-settings';

vi.mock('@/services/preferences', () => ({
  usePreferences: vi.fn(),
  useSavePreferences: vi.fn(),
}));

function createPreferences(overrides: Partial<AppPreferences> = {}): AppPreferences {
  return {
    theme: 'system',
    // biome-ignore lint/style/useNamingConvention: preferences field name
    quick_pane_shortcut: null,
    language: null,
    // biome-ignore lint/style/useNamingConvention: preferences field name
    close_behavior: 'minimize_to_tray',
    // biome-ignore lint/style/useNamingConvention: preferences field name
    show_tray_icon: true,
    // biome-ignore lint/style/useNamingConvention: preferences field name
    start_minimized: false,
    // biome-ignore lint/style/useNamingConvention: preferences field name
    reader_font_size: 16,
    // biome-ignore lint/style/useNamingConvention: preferences field name
    reader_line_width: 65,
    // biome-ignore lint/style/useNamingConvention: preferences field name
    reader_line_height: 1.75,
    // biome-ignore lint/style/useNamingConvention: preferences field name
    reader_font_family: 'sans-serif',
    // biome-ignore lint/style/useNamingConvention: preferences field name
    reader_theme: 'default',
    // biome-ignore lint/style/useNamingConvention: preferences field name
    reader_code_theme: 'auto',
    // biome-ignore lint/style/useNamingConvention: preferences field name
    reader_chinese_conversion: 's2tw',
    // biome-ignore lint/style/useNamingConvention: preferences field name
    reader_bionic_reading: false,
    // biome-ignore lint/style/useNamingConvention: preferences field name
    reader_status_bar: false,
    // biome-ignore lint/style/useNamingConvention: preferences field name
    reader_custom_conversions: [],
    // biome-ignore lint/style/useNamingConvention: preferences field name
    reader_translation_display_mode: 'bilingual',
    // biome-ignore lint/style/useNamingConvention: preferences field name
    reader_translation_trigger_mode: 'manual',
    // biome-ignore lint/style/useNamingConvention: preferences field name
    reader_translation_route_mode: 'engine_first',
    // biome-ignore lint/style/useNamingConvention: preferences field name
    reader_translation_target_language: null,
    // biome-ignore lint/style/useNamingConvention: preferences field name
    reader_translation_primary_engine: null,
    // biome-ignore lint/style/useNamingConvention: preferences field name
    reader_translation_engine_fallbacks: [],
    // biome-ignore lint/style/useNamingConvention: preferences field name
    reader_translation_llm_fallbacks: [],
    // biome-ignore lint/style/useNamingConvention: preferences field name
    reader_translation_apple_fallback_enabled: true,
    // biome-ignore lint/style/useNamingConvention: preferences field name
    reader_translation_provider_settings: {},
    // biome-ignore lint/style/useNamingConvention: preferences field name
    reader_translation_auto_enabled: false,
    // biome-ignore lint/style/useNamingConvention: preferences field name
    image_download_path: null,
    // biome-ignore lint/style/useNamingConvention: preferences field name
    video_download_path: null,
    ...overrides,
  };
}

describe('useReaderSettings translation preferences', () => {
  const savePreferencesMock = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(window, 'localStorage', {
      value: {
        getItem: vi.fn().mockReturnValue(null),
        setItem: vi.fn(),
        removeItem: vi.fn(),
        clear: vi.fn(),
        key: vi.fn(),
        length: 0,
      },
      writable: true,
    });

    (usePreferences as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      data: createPreferences(),
      isLoading: false,
    });
    (useSavePreferences as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      mutate: savePreferencesMock,
    });
  });

  it('exposes translation display mode getter and setter', () => {
    const { result } = renderHook(() => useReaderSettings());

    expect(result.current.translationDisplayMode).toBe('bilingual');
    result.current.setTranslationDisplayMode('translated_only');

    expect(savePreferencesMock).toHaveBeenCalledWith(
      expect.objectContaining({
        // biome-ignore lint/style/useNamingConvention: preferences field name
        reader_translation_display_mode: 'translated_only',
      })
    );
  });

  it('exposes translation trigger mode getter and setter', () => {
    const { result } = renderHook(() => useReaderSettings());

    expect(result.current.translationTriggerMode).toBe('manual');
    result.current.setTranslationTriggerMode('per_article_auto');

    expect(savePreferencesMock).toHaveBeenCalledWith(
      expect.objectContaining({
        // biome-ignore lint/style/useNamingConvention: preferences field name
        reader_translation_trigger_mode: 'per_article_auto',
      })
    );
  });

  it('exposes translation route mode getter and setter', () => {
    const { result } = renderHook(() => useReaderSettings());

    expect(result.current.translationRouteMode).toBe('engine_first');
    result.current.setTranslationRouteMode('hybrid_auto');

    expect(savePreferencesMock).toHaveBeenCalledWith(
      expect.objectContaining({
        // biome-ignore lint/style/useNamingConvention: preferences field name
        reader_translation_route_mode: 'hybrid_auto',
      })
    );
  });

  it('exposes translation target language getter and setter', () => {
    const { result } = renderHook(() => useReaderSettings());

    expect(result.current.translationTargetLanguage).toBeNull();
    result.current.setTranslationTargetLanguage('ja');

    expect(savePreferencesMock).toHaveBeenCalledWith(
      expect.objectContaining({
        // biome-ignore lint/style/useNamingConvention: preferences field name
        reader_translation_target_language: 'ja',
      })
    );
  });

  it('exposes apple fallback getter and setter', () => {
    const { result } = renderHook(() => useReaderSettings());

    expect(result.current.appleTranslationFallbackEnabled).toBe(true);
    result.current.setAppleTranslationFallbackEnabled(false);

    expect(savePreferencesMock).toHaveBeenCalledWith(
      expect.objectContaining({
        // biome-ignore lint/style/useNamingConvention: preferences field name
        reader_translation_apple_fallback_enabled: false,
      })
    );
  });

  it('defaults translationAutoEnabled to false when preference is not set', () => {
    (usePreferences as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      // biome-ignore lint/style/useNamingConvention: preferences field name
      data: createPreferences({ reader_translation_auto_enabled: undefined }),
      isLoading: false,
    });

    const { result } = renderHook(() => useReaderSettings());

    expect(result.current.translationAutoEnabled).toBe(false);
  });

  it('reads translationAutoEnabled from preferences', () => {
    (usePreferences as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      // biome-ignore lint/style/useNamingConvention: preferences field name
      data: createPreferences({ reader_translation_auto_enabled: true }),
      isLoading: false,
    });

    const { result } = renderHook(() => useReaderSettings());

    expect(result.current.translationAutoEnabled).toBe(true);
  });

  it('setTranslationAutoEnabled calls updateSetting with correct args', () => {
    const { result } = renderHook(() => useReaderSettings());

    result.current.setTranslationAutoEnabled(true);

    expect(savePreferencesMock).toHaveBeenCalledWith(
      expect.objectContaining({
        // biome-ignore lint/style/useNamingConvention: preferences field name
        reader_translation_auto_enabled: true,
      })
    );
  });
});
