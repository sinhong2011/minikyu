import type { AppPreferences, TranslationSegmentResponse } from '@/lib/tauri-bindings';

export type TranslationRoutingPreferences = Pick<
  AppPreferences,
  | 'reader_translation_route_mode'
  | 'reader_translation_target_language'
  | 'reader_translation_primary_engine'
  | 'reader_translation_engine_fallbacks'
  | 'reader_translation_llm_fallbacks'
  | 'reader_translation_apple_fallback_enabled'
>;

export type TranslateReaderSegmentInput = {
  text: string;
  sourceLanguage?: string | null;
  targetLanguage?: string;
  preferences: TranslationRoutingPreferences;
};

export type TranslateReaderSegmentResult = {
  translatedText: string;
  providerUsed: string;
  fallbackChain: string[];
};

export function normalizeTranslationSegmentResponse(
  response: TranslationSegmentResponse
): TranslateReaderSegmentResult {
  return {
    translatedText: response.translated_text,
    providerUsed: response.provider_used,
    fallbackChain: response.fallback_chain,
  };
}
