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
    route_mode: request.route_mode.trim(),
    target_language: request.target_language.trim(),
    primary_engine: request.primary_engine?.trim() || null,
    engine_fallbacks: request.engine_fallbacks.map((provider) => provider.trim()),
    llm_fallbacks: request.llm_fallbacks.map((provider) => provider.trim()),
    forced_provider: request.forced_provider?.trim() || null,
  };
}

export async function translateReaderSegmentWithDefaults(
  request: TranslationSegmentRequest
): Promise<Result<TranslationSegmentResponse, string>> {
  const normalizedRequest = normalizeTranslationSegmentRequest(request);
  return generatedCommands.translateReaderSegment(normalizedRequest);
}
