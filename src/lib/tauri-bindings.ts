import {
  commands as generatedCommands,
  type Result,
  type TranslationSegmentRequest,
  type TranslationSegmentResponse,
} from './bindings';

export * from './bindings';

export function normalizeTranslationSegmentRequest(
  request: TranslationSegmentRequest
): TranslationSegmentRequest {
  return {
    ...request,
    // biome-ignore lint/style/useNamingConvention: Tauri command payload field name
    route_mode: request.route_mode.trim(),
    // biome-ignore lint/style/useNamingConvention: Tauri command payload field name
    target_language: request.target_language.trim(),
    // biome-ignore lint/style/useNamingConvention: Tauri command payload field name
    primary_engine: request.primary_engine?.trim() || null,
    // biome-ignore lint/style/useNamingConvention: Tauri command payload field name
    engine_fallbacks: request.engine_fallbacks.map((provider) => provider.trim()),
    // biome-ignore lint/style/useNamingConvention: Tauri command payload field name
    llm_fallbacks: request.llm_fallbacks.map((provider) => provider.trim()),
  };
}

export async function translateReaderSegmentWithDefaults(
  request: TranslationSegmentRequest
): Promise<Result<TranslationSegmentResponse, string>> {
  const normalizedRequest = normalizeTranslationSegmentRequest(request);
  return generatedCommands.translateReaderSegment(normalizedRequest);
}
