import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import { commands, type TranslationSegmentRequest } from '@/lib/tauri-bindings';
import {
  normalizeTranslationSegmentResponse,
  type TranslateReaderSegmentInput,
  type TranslateReaderSegmentResult,
  type TranslationRoutingPreferences,
} from './types';

export interface TranslationStreamEvent {
  // biome-ignore lint/style/useNamingConvention: Tauri event payload field name
  stream_id: string;
  event: 'delta' | 'done' | 'error';
  text: string;
  // biome-ignore lint/style/useNamingConvention: Tauri event payload field name
  provider_used: string | null;
}

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
    // biome-ignore lint/style/useNamingConvention: Tauri command payload field name
    forced_provider: input.forcedProvider ?? null,
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

export interface TranslationStreamCallbacks {
  onDelta: (text: string) => void;
  onDone: (fullText: string, providerUsed: string) => void;
  onError: (error: string) => void;
}

/**
 * Streaming translation: calls the streaming backend command and
 * delivers text deltas via callbacks.
 * Returns an unlisten function to cancel the stream listener.
 */
export async function translateReaderSegmentStream(
  input: TranslateReaderSegmentInput,
  streamId: string,
  callbacks: TranslationStreamCallbacks
): Promise<UnlistenFn> {
  const request = buildTranslationSegmentRequest(input);

  const unlisten = await listen<TranslationStreamEvent>('translation-stream', (event) => {
    const data = event.payload;
    if (data.stream_id !== streamId) return;

    switch (data.event) {
      case 'delta':
        callbacks.onDelta(data.text);
        break;
      case 'done':
        callbacks.onDone(data.text, data.provider_used ?? 'unknown');
        break;
      case 'error':
        callbacks.onError(data.text);
        break;
    }
  });

  // Fire the streaming command (don't await the full result — events arrive via listener)
  commands.translateReaderSegmentStream(request, streamId).then((result) => {
    if (result.status === 'error') {
      callbacks.onError(result.error);
    }
  });

  return unlisten;
}
