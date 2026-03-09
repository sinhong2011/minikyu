import { beforeEach, describe, expect, it, vi } from 'vitest';
import { commands } from '@/lib/tauri-bindings';
import { translateReaderSegmentWithPreferences } from './router';
import type { TranslationRoutingPreferences } from './types';

const translateReaderSegmentMock = vi.fn();

function createRoutingPreferences(
  overrides: Partial<TranslationRoutingPreferences> = {}
): TranslationRoutingPreferences {
  return {
    reader_translation_route_mode: 'engine_first',
    reader_translation_target_language: 'zh-CN',
    reader_translation_primary_engine: 'deepl',
    reader_translation_engine_fallbacks: ['google_translate', 'microsoft_translator'],
    reader_translation_llm_fallbacks: ['openai', 'anthropic'],
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
        translated_text: '你好',
        provider_used: 'deepl',
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
      source_language: 'en',
      target_language: 'zh-CN',
      route_mode: 'engine_first',
      primary_engine: 'deepl',
      engine_fallbacks: ['google_translate', 'microsoft_translator'],
      llm_fallbacks: ['openai', 'anthropic'],
      apple_fallback_enabled: false,
      forced_provider: null,
    });
  });

  it('sends apple fallback enabled flag when preference is enabled', async () => {
    const preferences = createRoutingPreferences({
      reader_translation_apple_fallback_enabled: true,
    });

    await translateReaderSegmentWithPreferences({
      text: 'Hello world',
      sourceLanguage: 'en',
      preferences,
    });

    expect(translateReaderSegmentMock).toHaveBeenCalledWith(
      expect.objectContaining({
        apple_fallback_enabled: true,
      })
    );
  });

  it('preserves fallback array order in route payload', async () => {
    const preferences = createRoutingPreferences({
      reader_translation_engine_fallbacks: ['fallback_one', 'fallback_two'],
      reader_translation_llm_fallbacks: ['llm_one', 'llm_two'],
    });

    await translateReaderSegmentWithPreferences({
      text: 'Hello world',
      sourceLanguage: 'en',
      preferences,
    });

    expect(translateReaderSegmentMock).toHaveBeenCalledWith(
      expect.objectContaining({
        engine_fallbacks: ['fallback_one', 'fallback_two'],
        llm_fallbacks: ['llm_one', 'llm_two'],
      })
    );
  });
});
