import { beforeEach, describe, expect, it, vi } from 'vitest';
import { commands } from '@/lib/tauri-bindings';
import { translateReaderSegmentWithPreferences } from './router';
import type { TranslationRoutingPreferences } from './types';

const translateReaderSegmentMock = vi.fn();

function createRoutingPreferences(
  overrides: Partial<TranslationRoutingPreferences> = {}
): TranslationRoutingPreferences {
  return {
    // biome-ignore lint/style/useNamingConvention: preferences field name
    reader_translation_route_mode: 'engine_first',
    // biome-ignore lint/style/useNamingConvention: preferences field name
    reader_translation_target_language: 'zh-CN',
    // biome-ignore lint/style/useNamingConvention: preferences field name
    reader_translation_primary_engine: 'deepl',
    // biome-ignore lint/style/useNamingConvention: preferences field name
    reader_translation_engine_fallbacks: ['google_translate', 'microsoft_translator'],
    // biome-ignore lint/style/useNamingConvention: preferences field name
    reader_translation_llm_fallbacks: ['openai', 'anthropic'],
    // biome-ignore lint/style/useNamingConvention: preferences field name
    reader_translation_apple_fallback_enabled: false,
    ...overrides,
  };
}

describe('translation router service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (
      commands as unknown as { translateReaderSegment: typeof translateReaderSegmentMock }
    ).translateReaderSegment = translateReaderSegmentMock;
    translateReaderSegmentMock.mockResolvedValue({
      status: 'ok',
      data: {
        // biome-ignore lint/style/useNamingConvention: generated Tauri response field name
        translated_text: '你好',
        // biome-ignore lint/style/useNamingConvention: generated Tauri response field name
        provider_used: 'deepl',
        // biome-ignore lint/style/useNamingConvention: generated Tauri response field name
        fallback_chain: ['deepl'],
      },
    });
  });

  it('composes engine_first payload from preferences values', async () => {
    const preferences = createRoutingPreferences();
    await translateReaderSegmentWithPreferences({
      text: 'Hello world',
      sourceLanguage: 'en',
      preferences,
    });

    expect(translateReaderSegmentMock).toHaveBeenCalledWith({
      text: 'Hello world',
      // biome-ignore lint/style/useNamingConvention: Tauri command payload field name
      source_language: 'en',
      // biome-ignore lint/style/useNamingConvention: Tauri command payload field name
      target_language: 'zh-CN',
      // biome-ignore lint/style/useNamingConvention: Tauri command payload field name
      route_mode: 'engine_first',
      // biome-ignore lint/style/useNamingConvention: Tauri command payload field name
      primary_engine: 'deepl',
      // biome-ignore lint/style/useNamingConvention: Tauri command payload field name
      engine_fallbacks: ['google_translate', 'microsoft_translator'],
      // biome-ignore lint/style/useNamingConvention: Tauri command payload field name
      llm_fallbacks: ['openai', 'anthropic'],
      // biome-ignore lint/style/useNamingConvention: Tauri command payload field name
      apple_fallback_enabled: false,
    });
  });

  it('sends apple fallback enabled flag when preference is enabled', async () => {
    const preferences = createRoutingPreferences({
      // biome-ignore lint/style/useNamingConvention: preferences field name
      reader_translation_apple_fallback_enabled: true,
    });

    await translateReaderSegmentWithPreferences({
      text: 'Hello world',
      sourceLanguage: 'en',
      preferences,
    });

    expect(translateReaderSegmentMock).toHaveBeenCalledWith(
      expect.objectContaining({
        // biome-ignore lint/style/useNamingConvention: Tauri command payload field name
        apple_fallback_enabled: true,
      })
    );
  });

  it('preserves fallback array order in route payload', async () => {
    const preferences = createRoutingPreferences({
      // biome-ignore lint/style/useNamingConvention: preferences field name
      reader_translation_engine_fallbacks: ['fallback_one', 'fallback_two'],
      // biome-ignore lint/style/useNamingConvention: preferences field name
      reader_translation_llm_fallbacks: ['llm_one', 'llm_two'],
    });

    await translateReaderSegmentWithPreferences({
      text: 'Hello world',
      sourceLanguage: 'en',
      preferences,
    });

    expect(translateReaderSegmentMock).toHaveBeenCalledWith(
      expect.objectContaining({
        // biome-ignore lint/style/useNamingConvention: Tauri command payload field name
        engine_fallbacks: ['fallback_one', 'fallback_two'],
        // biome-ignore lint/style/useNamingConvention: Tauri command payload field name
        llm_fallbacks: ['llm_one', 'llm_two'],
      })
    );
  });
});
