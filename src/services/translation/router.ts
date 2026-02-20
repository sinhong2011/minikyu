import { commands, type TranslationSegmentRequest } from '@/lib/tauri-bindings';
import {
  normalizeTranslationSegmentResponse,
  type TranslateReaderSegmentInput,
  type TranslateReaderSegmentResult,
  type TranslationRoutingPreferences,
} from './types';

function resolveTargetLanguage(
  targetLanguageOverride: string | undefined,
  preferences: TranslationRoutingPreferences
): string {
  const resolvedTargetLanguage =
    targetLanguageOverride ?? preferences.reader_translation_target_language ?? '';
  const normalizedTargetLanguage = resolvedTargetLanguage.trim();

  if (normalizedTargetLanguage.length === 0) {
    throw new Error('Reader translation target language is not configured');
  }

  return normalizedTargetLanguage;
}

export function buildTranslationSegmentRequest(
  input: TranslateReaderSegmentInput
): TranslationSegmentRequest {
  return {
    text: input.text,
    // biome-ignore lint/style/useNamingConvention: Tauri command payload field name
    source_language: input.sourceLanguage ?? null,
    // biome-ignore lint/style/useNamingConvention: Tauri command payload field name
    target_language: resolveTargetLanguage(input.targetLanguage, input.preferences),
    // biome-ignore lint/style/useNamingConvention: Tauri command payload field name
    route_mode: input.preferences.reader_translation_route_mode,
    // biome-ignore lint/style/useNamingConvention: Tauri command payload field name
    primary_engine: input.preferences.reader_translation_primary_engine ?? null,
    // biome-ignore lint/style/useNamingConvention: Tauri command payload field name
    engine_fallbacks: [...(input.preferences.reader_translation_engine_fallbacks ?? [])],
    // biome-ignore lint/style/useNamingConvention: Tauri command payload field name
    llm_fallbacks: [...(input.preferences.reader_translation_llm_fallbacks ?? [])],
    // biome-ignore lint/style/useNamingConvention: Tauri command payload field name
    apple_fallback_enabled: input.preferences.reader_translation_apple_fallback_enabled,
  };
}

export async function translateReaderSegmentWithPreferences(
  input: TranslateReaderSegmentInput
): Promise<TranslateReaderSegmentResult> {
  const request = buildTranslationSegmentRequest(input);
  const result = await commands.translateReaderSegment(request);

  if (result.status === 'error') {
    throw new Error(result.error);
  }

  return normalizeTranslationSegmentResponse(result.data);
}
