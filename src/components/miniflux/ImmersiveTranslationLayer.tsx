import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { logger } from '@/lib/logger';
import type { ReaderCodeTheme } from '@/lib/shiki-highlight';
import { commands } from '@/lib/tauri-bindings';
import type { TranslationRoutingPreferences } from '@/services/translation';
import { translateReaderSegmentStream } from '@/services/translation';
import { SafeHtml, sanitizeReaderHtml } from './SafeHtml';

async function computeTranslationCacheKey(text: string, targetLanguage: string): Promise<string> {
  const data = new TextEncoder().encode(text.trim());
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
  return `${targetLanguage}:${hashHex}`;
}

type TranslationSegment = {
  id: string;
  text: string;
};

type SegmentState = {
  status: 'idle' | 'loading' | 'success' | 'error';
  translatedText: string | null;
  providerUsed: string | null;
};

export interface ImmersiveTranslationLayerProps {
  entryId: string;
  html: string;
  translationEnabled: boolean;
  translationDisplayMode: 'bilingual' | 'translated_only';
  translateRequestToken: number;
  sourceLanguage?: string | null;
  translationPreferences: TranslationRoutingPreferences;
  providerSettings?: Partial<Record<string, { enabled: boolean; model?: string | null }>>;
  bionicEnglish: boolean;
  chineseConversionMode: 'off' | 's2tw' | 's2hk' | 't2s';
  customConversionRules: Array<{ from: string; to: string }>;
  codeTheme: ReaderCodeTheme;
  className?: string;
  style?: React.CSSProperties;
  onActiveProviderChange?: (provider: string | null) => void;
  onTranslationProgressChange?: (completed: number, total: number) => void;
}

function extractParagraphSegments(html: string): TranslationSegment[] {
  if (typeof document === 'undefined') {
    return [];
  }

  const template = document.createElement('template');
  template.innerHTML = html;

  return Array.from(template.content.querySelectorAll('p'))
    .map((paragraphNode, index) => ({
      id: String(index),
      text: paragraphNode.textContent?.trim() ?? '',
    }))
    .filter((segment) => segment.text.length >= 20);
}

function appendRetryIndicator(
  anchorNode: Element,
  segmentId: string,
  failedLabel: string,
  retryLabel: string
) {
  const retryElement = document.createElement('div');
  retryElement.className = 'reader-translation-retry';
  retryElement.setAttribute('data-translation-retry', segmentId);
  retryElement.setAttribute('data-testid', `translation-retry-${segmentId}`);
  retryElement.setAttribute('role', 'button');
  retryElement.setAttribute('tabindex', '0');
  retryElement.innerHTML =
    `<span class="reader-translation-retry-dot"></span>` +
    `<span class="reader-translation-retry-label">${failedLabel}</span>` +
    `<span class="reader-translation-retry-action">${retryLabel}</span>`;
  anchorNode.insertAdjacentElement('afterend', retryElement);
}

function buildTranslatedHtml({
  html,
  segments,
  segmentStates,
  translationDisplayMode,
  failedLabel,
  retryLabel,
}: {
  html: string;
  segments: TranslationSegment[];
  segmentStates: Record<string, SegmentState>;
  translationDisplayMode: 'bilingual' | 'translated_only';
  failedLabel: string;
  retryLabel: string;
}): string {
  if (typeof document === 'undefined') {
    return html;
  }

  const template = document.createElement('template');
  template.innerHTML = html;
  const paragraphNodes = Array.from(template.content.querySelectorAll('p'));

  for (const segment of segments) {
    const paragraphNode = paragraphNodes[Number(segment.id)];
    if (!paragraphNode) {
      continue;
    }

    // Always mark the source paragraph with its segment ID so the block menu can look it up
    paragraphNode.setAttribute('data-translation-segment-id', segment.id);

    const state = segmentStates[segment.id];
    if (!state) {
      continue;
    }

    // Show shimmer border on loading paragraph (all display modes)
    if (state.status === 'loading') {
      paragraphNode.setAttribute('data-translation-loading', 'true');
    } else {
      paragraphNode.removeAttribute('data-translation-loading');
    }

    if (translationDisplayMode === 'translated_only') {
      if (state.status === 'success') {
        paragraphNode.textContent = state.translatedText ?? '';
        paragraphNode.setAttribute('data-testid', `translated-segment-${segment.id}`);
      } else if (state.status === 'loading' && state.translatedText) {
        // Re-translating: keep previous translation visible with pulse
        paragraphNode.textContent = state.translatedText;
        paragraphNode.classList.add('reader-translation-reloading');
      }
      // In translated_only mode, show inline retry after the original paragraph on error
      if (state.status === 'error') {
        appendRetryIndicator(paragraphNode, segment.id, failedLabel, retryLabel);
      }
      continue;
    }

    if (translationDisplayMode !== 'bilingual') {
      continue;
    }

    if (state.status === 'success') {
      const translatedParagraph = document.createElement('p');
      translatedParagraph.textContent = state.translatedText ?? '';
      translatedParagraph.setAttribute('data-translation-role', 'translated');
      translatedParagraph.setAttribute('data-translation-segment-id', segment.id);
      translatedParagraph.setAttribute('data-testid', `translated-segment-${segment.id}`);
      translatedParagraph.className = 'reader-translation-block';
      paragraphNode.insertAdjacentElement('afterend', translatedParagraph);
    } else if (state.status === 'loading' && state.translatedText) {
      // Re-translating: keep previous translation visible with loading indicator
      const translatedParagraph = document.createElement('p');
      translatedParagraph.textContent = state.translatedText;
      translatedParagraph.setAttribute('data-translation-role', 'translated');
      translatedParagraph.setAttribute('data-translation-segment-id', segment.id);
      translatedParagraph.setAttribute('data-translation-loading', 'true');
      translatedParagraph.setAttribute('data-testid', `translated-segment-${segment.id}`);
      translatedParagraph.className = 'reader-translation-block reader-translation-reloading';
      paragraphNode.insertAdjacentElement('afterend', translatedParagraph);
    } else if (state.status === 'error') {
      appendRetryIndicator(paragraphNode, segment.id, failedLabel, retryLabel);
    }
  }

  return template.innerHTML;
}

export function ImmersiveTranslationLayer({
  entryId,
  html,
  translationEnabled,
  translationDisplayMode,
  translateRequestToken,
  sourceLanguage = null,
  translationPreferences,
  providerSettings,
  bionicEnglish,
  chineseConversionMode,
  customConversionRules,
  codeTheme,
  className,
  style,
  onActiveProviderChange,
  onTranslationProgressChange,
}: ImmersiveTranslationLayerProps) {
  const { _ } = useLingui();
  const safeSourceHtml = useMemo(() => sanitizeReaderHtml(html), [html]);
  const segments = useMemo(() => extractParagraphSegments(safeSourceHtml), [safeSourceHtml]);
  const [segmentStates, setSegmentStates] = useState<Record<string, SegmentState>>({});
  const segmentStatesRef = useRef(segmentStates);
  segmentStatesRef.current = segmentStates;
  const translationPreferencesRef = useRef(translationPreferences);
  translationPreferencesRef.current = translationPreferences;
  const onActiveProviderChangeRef = useRef(onActiveProviderChange);
  onActiveProviderChangeRef.current = onActiveProviderChange;
  const onTranslationProgressChangeRef = useRef(onTranslationProgressChange);
  onTranslationProgressChangeRef.current = onTranslationProgressChange;
  const activeRequestIdRef = useRef(0);
  const segmentRequestIdsRef = useRef<Record<string, number>>({});

  const availableProviders = useMemo(() => {
    if (!providerSettings) return [];
    const providerDisplayNames: Record<string, string> = {
      deepl: 'DeepL',
      // biome-ignore lint/style/useNamingConvention: provider ID from backend
      google_translate: 'Google Translate',
      // biome-ignore lint/style/useNamingConvention: provider ID from backend
      apple_built_in: 'Apple Built-in',
      openai: 'OpenAI',
      anthropic: 'Anthropic',
      gemini: 'Gemini',
      ollama: 'Ollama',
      deepseek: 'DeepSeek',
      qwen: 'Qwen',
      kimi: 'Kimi',
      minimax: 'MiniMax',
      openrouter: 'OpenRouter',
      glm: 'GLM',
    };

    return Object.entries(providerSettings)
      .filter(([, settings]) => settings?.enabled)
      .map(([id, settings]) => {
        const baseName = providerDisplayNames[id] ?? id;
        const model = settings?.model;
        const label = model ? `${baseName} · ${model}` : baseName;
        return { id, label };
      });
  }, [providerSettings]);

  useEffect(() => {
    if (entryId.length === 0) {
      return;
    }

    const initialState: Record<string, SegmentState> = {};
    for (const segment of segments) {
      initialState[segment.id] = {
        status: 'idle',
        translatedText: null,
        providerUsed: null,
      };
    }
    activeRequestIdRef.current = 0;
    segmentRequestIdsRef.current = {};
    setSegmentStates(initialState);
    onActiveProviderChangeRef.current?.(null);
  }, [segments, entryId]);

  const translateSegment = useCallback(
    async (
      segment: TranslationSegment,
      requestId: number,
      sourceLanguageValue: string | null,
      translationPreferencesValue: TranslationRoutingPreferences
    ) => {
      // Early exit before any async work if request is already stale
      if (requestId !== activeRequestIdRef.current) {
        logger.debug(`[translation] segment ${segment.id} skipped (stale batch request)`);
        return;
      }

      const textPreview = segment.text.slice(0, 40);
      const targetLanguage = translationPreferencesValue.reader_translation_target_language ?? '';

      // Check cache first (skip shimmer if cache hit)
      let cacheKey: string | null = null;
      if (targetLanguage) {
        cacheKey = await computeTranslationCacheKey(segment.text, targetLanguage);
        logger.debug(
          `[translation] segment ${segment.id} cache lookup key=${cacheKey.slice(0, 20)}… text="${textPreview}…"`
        );
        const cacheResult = await commands.getTranslationCacheEntry(cacheKey);
        if (cacheResult.status === 'ok' && cacheResult.data) {
          const cachedData = cacheResult.data;
          if (requestId !== activeRequestIdRef.current) return;
          logger.debug(
            `[translation] segment ${segment.id} cache HIT provider=${cachedData.provider_used}`
          );
          setSegmentStates((previousState) => ({
            ...previousState,
            [segment.id]: {
              status: 'success',
              translatedText: cachedData.translated_text,
              providerUsed: cachedData.provider_used,
            },
          }));
          onActiveProviderChangeRef.current?.(cachedData.provider_used);
          return;
        }
        logger.debug(`[translation] segment ${segment.id} cache MISS`);
      }

      // No cache hit — show shimmer and call streaming API
      logger.debug(
        `[translation] segment ${segment.id} calling streaming API (batch) text="${textPreview}…"`
      );
      setSegmentStates((previousState) => {
        const existing = previousState[segment.id];
        return {
          ...previousState,
          [segment.id]: {
            status: 'loading',
            translatedText: existing?.translatedText ?? null,
            providerUsed: existing?.providerUsed ?? null,
          },
        };
      });

      const streamId = `translate-${segment.id}-${requestId}-${Date.now()}`;
      try {
        await new Promise<void>((resolve, reject) => {
          translateReaderSegmentStream(
            {
              text: segment.text,
              sourceLanguage: sourceLanguageValue,
              preferences: translationPreferencesValue,
            },
            streamId,
            {
              onDelta: (delta) => {
                if (requestId !== activeRequestIdRef.current) return;
                setSegmentStates((prev) => ({
                  ...prev,
                  [segment.id]: {
                    status: 'loading',
                    translatedText: (prev[segment.id]?.translatedText ?? '') + delta,
                    providerUsed: prev[segment.id]?.providerUsed ?? null,
                  },
                }));
              },
              onDone: (fullText, providerUsed) => {
                if (requestId !== activeRequestIdRef.current) {
                  logger.debug(
                    `[translation] segment ${segment.id} result discarded (stale batch request)`
                  );
                  resolve();
                  return;
                }
                logger.debug(
                  `[translation] segment ${segment.id} stream success provider=${providerUsed}`
                );
                setSegmentStates((prev) => ({
                  ...prev,
                  [segment.id]: {
                    status: 'success',
                    translatedText: fullText,
                    providerUsed,
                  },
                }));
                onActiveProviderChangeRef.current?.(providerUsed);

                // Write to cache
                if (cacheKey) {
                  logger.debug(
                    `[translation] segment ${segment.id} writing cache key=${cacheKey.slice(0, 20)}… provider=${providerUsed}`
                  );
                  commands
                    .setTranslationCacheEntry(cacheKey, {
                      // biome-ignore lint/style/useNamingConvention: Tauri command payload field name
                      translated_text: fullText,
                      // biome-ignore lint/style/useNamingConvention: Tauri command payload field name
                      provider_used: providerUsed,
                      // biome-ignore lint/style/useNamingConvention: Tauri command payload field name
                      cached_at: String(Math.floor(Date.now() / 1000)),
                    })
                    .then((r) => {
                      if (r.status === 'ok') {
                        logger.debug(`[translation] segment ${segment.id} cache write OK`);
                      } else {
                        logger.debug(
                          `[translation] segment ${segment.id} cache write FAILED: ${r.error}`
                        );
                      }
                    });
                }
                resolve();
              },
              onError: (error) => {
                reject(new Error(error));
              },
            }
          );
        });
      } catch (err) {
        if (requestId !== activeRequestIdRef.current) {
          return;
        }
        logger.debug(`[translation] segment ${segment.id} stream error: ${err}`);
        setSegmentStates((previousState) => ({
          ...previousState,
          [segment.id]: {
            status: 'error',
            translatedText: null,
            providerUsed: null,
          },
        }));
      }
    },
    []
  );

  // Flush completed translations to cache when switching entries
  useEffect(() => {
    return () => {
      const statesToFlush = segmentStatesRef.current;
      const prefsValue = translationPreferencesRef.current;
      const targetLanguage = prefsValue.reader_translation_target_language ?? '';
      if (!targetLanguage) return;

      for (const [segmentId, state] of Object.entries(statesToFlush)) {
        if (state.status !== 'success' || !state.translatedText) continue;
        const segment = segments.find((s) => s.id === segmentId);
        if (!segment) continue;
        void (async () => {
          const key = await computeTranslationCacheKey(segment.text, targetLanguage);
          void commands.setTranslationCacheEntry(key, {
            // biome-ignore lint/style/useNamingConvention: Tauri command payload field name
            translated_text: state.translatedText ?? '',
            // biome-ignore lint/style/useNamingConvention: Tauri command payload field name
            provider_used: state.providerUsed ?? '',
            // biome-ignore lint/style/useNamingConvention: Tauri command payload field name
            cached_at: String(Math.floor(Date.now() / 1000)),
          });
        })();
      }
    };
  }, [segments]);

  useEffect(() => {
    if (!translationEnabled) {
      return;
    }

    if (translateRequestToken === 0) {
      return;
    }

    const requestId = activeRequestIdRef.current + 1;
    activeRequestIdRef.current = requestId;

    logger.debug(
      `[translation] batch translate triggered token=${translateRequestToken} segments=${segments.length} requestId=${requestId}`
    );

    void (async () => {
      for (const segment of segments) {
        await translateSegment(segment, requestId, sourceLanguage, translationPreferences);
      }
      logger.debug(`[translation] batch translate complete requestId=${requestId}`);
    })();
  }, [
    translationEnabled,
    translateRequestToken,
    segments,
    translateSegment,
    translationPreferences,
    sourceLanguage,
  ]);

  const retrySegment = useCallback(
    async (segmentId: string) => {
      const segment = segments.find((item) => item.id === segmentId);
      if (!segment) {
        return;
      }

      logger.debug(`[translation] retrySegment ${segment.id} text="${segment.text.slice(0, 40)}…"`);

      // Per-segment request ID — does NOT invalidate other segments' in-flight translations
      const segReqId = (segmentRequestIdsRef.current[segment.id] ?? 0) + 1;
      segmentRequestIdsRef.current[segment.id] = segReqId;

      setSegmentStates((prev) => {
        const existing = prev[segment.id];
        return {
          ...prev,
          [segment.id]: {
            status: 'loading',
            translatedText: existing?.translatedText ?? null,
            providerUsed: existing?.providerUsed ?? null,
          },
        };
      });

      const streamId = `translate-retry-${segment.id}-${segReqId}-${Date.now()}`;
      try {
        await new Promise<void>((resolve, reject) => {
          translateReaderSegmentStream(
            {
              text: segment.text,
              sourceLanguage,
              preferences: translationPreferencesRef.current,
            },
            streamId,
            {
              onDelta: (delta) => {
                if (segmentRequestIdsRef.current[segment.id] !== segReqId) return;
                setSegmentStates((prev) => ({
                  ...prev,
                  [segment.id]: {
                    status: 'loading',
                    translatedText: (prev[segment.id]?.translatedText ?? '') + delta,
                    providerUsed: prev[segment.id]?.providerUsed ?? null,
                  },
                }));
              },
              onDone: (fullText, providerUsed) => {
                if (segmentRequestIdsRef.current[segment.id] !== segReqId) {
                  resolve();
                  return;
                }
                logger.debug(
                  `[translation] retrySegment ${segment.id} stream success provider=${providerUsed}`
                );
                setSegmentStates((prev) => ({
                  ...prev,
                  [segment.id]: {
                    status: 'success',
                    translatedText: fullText,
                    providerUsed,
                  },
                }));
                onActiveProviderChangeRef.current?.(providerUsed);

                const targetLanguage =
                  translationPreferencesRef.current.reader_translation_target_language ?? '';
                if (targetLanguage) {
                  computeTranslationCacheKey(segment.text, targetLanguage).then((cacheKey) => {
                    commands
                      .setTranslationCacheEntry(cacheKey, {
                        // biome-ignore lint/style/useNamingConvention: Tauri command payload field name
                        translated_text: fullText,
                        // biome-ignore lint/style/useNamingConvention: Tauri command payload field name
                        provider_used: providerUsed,
                        // biome-ignore lint/style/useNamingConvention: Tauri command payload field name
                        cached_at: String(Math.floor(Date.now() / 1000)),
                      })
                      .then((r) => {
                        if (r.status === 'ok') {
                          logger.debug(`[translation] retrySegment ${segment.id} cache write OK`);
                        } else {
                          logger.debug(
                            `[translation] retrySegment ${segment.id} cache write FAILED: ${r.error}`
                          );
                        }
                      });
                  });
                }
                resolve();
              },
              onError: (error) => {
                reject(new Error(error));
              },
            }
          );
        });
      } catch (err) {
        if (segmentRequestIdsRef.current[segment.id] !== segReqId) return;
        logger.debug(`[translation] retrySegment ${segment.id} stream error: ${err}`);
        setSegmentStates((prev) => ({
          ...prev,
          [segment.id]: { status: 'error', translatedText: null, providerUsed: null },
        }));
      }
    },
    [segments, sourceLanguage]
  );

  const handleTranslateNode = useCallback(
    (text: string) => {
      const segment = segments.find((s) => s.text === text);
      if (!segment) {
        logger.debug(
          `[translation] handleTranslateNode: segment not found for text="${text.slice(0, 40)}…"`
        );
        return;
      }

      logger.debug(
        `[translation] handleTranslateNode segment ${segment.id} text="${segment.text.slice(0, 40)}…"`
      );

      // Per-segment request ID — does NOT invalidate other segments' in-flight translations
      const segReqId = (segmentRequestIdsRef.current[segment.id] ?? 0) + 1;
      segmentRequestIdsRef.current[segment.id] = segReqId;

      setSegmentStates((prev) => {
        const existing = prev[segment.id];
        return {
          ...prev,
          [segment.id]: {
            status: 'loading',
            translatedText: existing?.translatedText ?? null,
            providerUsed: existing?.providerUsed ?? null,
          },
        };
      });

      const streamId = `translate-node-${segment.id}-${segReqId}-${Date.now()}`;
      translateReaderSegmentStream(
        {
          text: segment.text,
          sourceLanguage,
          preferences: translationPreferencesRef.current,
        },
        streamId,
        {
          onDelta: (delta) => {
            if (segmentRequestIdsRef.current[segment.id] !== segReqId) return;
            setSegmentStates((prev) => ({
              ...prev,
              [segment.id]: {
                status: 'loading',
                translatedText: (prev[segment.id]?.translatedText ?? '') + delta,
                providerUsed: prev[segment.id]?.providerUsed ?? null,
              },
            }));
          },
          onDone: (fullText, providerUsed) => {
            if (segmentRequestIdsRef.current[segment.id] !== segReqId) return;
            logger.debug(
              `[translation] handleTranslateNode segment ${segment.id} stream success provider=${providerUsed}`
            );
            setSegmentStates((prev) => ({
              ...prev,
              [segment.id]: {
                status: 'success',
                translatedText: fullText,
                providerUsed,
              },
            }));
            onActiveProviderChangeRef.current?.(providerUsed);

            const targetLanguage =
              translationPreferencesRef.current.reader_translation_target_language ?? '';
            if (targetLanguage) {
              computeTranslationCacheKey(segment.text, targetLanguage).then((cacheKey) => {
                commands
                  .setTranslationCacheEntry(cacheKey, {
                    // biome-ignore lint/style/useNamingConvention: Tauri command payload field name
                    translated_text: fullText,
                    // biome-ignore lint/style/useNamingConvention: Tauri command payload field name
                    provider_used: providerUsed,
                    // biome-ignore lint/style/useNamingConvention: Tauri command payload field name
                    cached_at: String(Math.floor(Date.now() / 1000)),
                  })
                  .then((r) => {
                    if (r.status === 'ok') {
                      logger.debug(
                        `[translation] handleTranslateNode segment ${segment.id} cache write OK`
                      );
                    } else {
                      logger.debug(
                        `[translation] handleTranslateNode segment ${segment.id} cache write FAILED: ${r.error}`
                      );
                    }
                  });
              });
            }
          },
          onError: (error) => {
            if (segmentRequestIdsRef.current[segment.id] !== segReqId) return;
            logger.debug(
              `[translation] handleTranslateNode segment ${segment.id} stream error: ${error}`
            );
            setSegmentStates((prev) => ({
              ...prev,
              [segment.id]: { status: 'error', translatedText: null, providerUsed: null },
            }));
          },
        }
      );
    },
    [segments, sourceLanguage]
  );

  const translateWithProvider = useCallback(
    (text: string, providerId: string) => {
      const segment = segments.find((s) => s.text === text);
      if (!segment) {
        logger.debug(
          `[translation] translateWithProvider: segment not found for text="${text.slice(0, 40)}…"`
        );
        return;
      }

      const textPreview = segment.text.slice(0, 40);
      logger.debug(
        `[translation] translateWithProvider segment ${segment.id} forced=${providerId} text="${textPreview}…"`
      );

      // Per-segment request ID — does NOT invalidate other segments' in-flight translations
      const segReqId = (segmentRequestIdsRef.current[segment.id] ?? 0) + 1;
      segmentRequestIdsRef.current[segment.id] = segReqId;

      setSegmentStates((previous) => {
        const existing = previous[segment.id];
        return {
          ...previous,
          [segment.id]: {
            status: 'loading',
            translatedText: existing?.translatedText ?? null,
            providerUsed: existing?.providerUsed ?? null,
          },
        };
      });

      const streamId = `translate-forced-${segment.id}-${segReqId}-${Date.now()}`;
      logger.debug(
        `[translation] translateWithProvider segment ${segment.id} calling streaming API forced=${providerId}`
      );
      translateReaderSegmentStream(
        {
          text: segment.text,
          sourceLanguage,
          preferences: translationPreferencesRef.current,
          forcedProvider: providerId,
        },
        streamId,
        {
          onDelta: (delta) => {
            if (segmentRequestIdsRef.current[segment.id] !== segReqId) return;
            setSegmentStates((prev) => ({
              ...prev,
              [segment.id]: {
                status: 'loading',
                translatedText: (prev[segment.id]?.translatedText ?? '') + delta,
                providerUsed: prev[segment.id]?.providerUsed ?? null,
              },
            }));
          },
          onDone: (fullText, providerUsed) => {
            if (segmentRequestIdsRef.current[segment.id] !== segReqId) {
              logger.debug(
                `[translation] translateWithProvider segment ${segment.id} result discarded (stale per-segment request)`
              );
              return;
            }
            logger.debug(
              `[translation] translateWithProvider segment ${segment.id} stream success provider=${providerUsed}`
            );
            setSegmentStates((prev) => ({
              ...prev,
              [segment.id]: {
                status: 'success',
                translatedText: fullText,
                providerUsed,
              },
            }));
            onActiveProviderChangeRef.current?.(providerUsed);

            const targetLanguage =
              translationPreferencesRef.current.reader_translation_target_language ?? '';
            if (targetLanguage) {
              computeTranslationCacheKey(segment.text, targetLanguage).then((cacheKey) => {
                commands
                  .setTranslationCacheEntry(cacheKey, {
                    // biome-ignore lint/style/useNamingConvention: Tauri command payload field name
                    translated_text: fullText,
                    // biome-ignore lint/style/useNamingConvention: Tauri command payload field name
                    provider_used: providerUsed,
                    // biome-ignore lint/style/useNamingConvention: Tauri command payload field name
                    cached_at: String(Math.floor(Date.now() / 1000)),
                  })
                  .then((r) => {
                    if (r.status === 'ok') {
                      logger.debug(
                        `[translation] translateWithProvider segment ${segment.id} cache write OK`
                      );
                    } else {
                      logger.debug(
                        `[translation] translateWithProvider segment ${segment.id} cache write FAILED: ${r.error}`
                      );
                    }
                  });
              });
            }
          },
          onError: (error) => {
            if (segmentRequestIdsRef.current[segment.id] !== segReqId) return;
            logger.debug(
              `[translation] translateWithProvider segment ${segment.id} stream error: ${error}`
            );
            setSegmentStates((prev) => ({
              ...prev,
              [segment.id]: { status: 'error', translatedText: null, providerUsed: null },
            }));
          },
        }
      );
    },
    [segments, sourceLanguage]
  );

  const handleCopyTranslation = useCallback((translatedText: string) => {
    void navigator.clipboard.writeText(translatedText);
  }, []);

  const translatedHtml = buildTranslatedHtml({
    html: safeSourceHtml,
    segments,
    segmentStates,
    translationDisplayMode,
    failedLabel: _(msg`Translation failed`),
    retryLabel: _(msg`Retry`),
  });
  const completedCount = Object.values(segmentStates).filter(
    (s) => s.status === 'success' || s.status === 'error'
  ).length;

  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (translationEnabled) {
      onTranslationProgressChangeRef.current?.(completedCount, segments.length);
    }
  }, [translationEnabled, completedCount, segments.length]);

  // Handle clicks on inline retry indicators via event delegation
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      const retryElement = target.closest('[data-translation-retry]');
      if (!retryElement) return;

      const segmentId = retryElement.getAttribute('data-translation-retry');
      if (segmentId) {
        void retrySegment(segmentId);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      const target = event.target as HTMLElement;
      if (!target.hasAttribute('data-translation-retry')) return;

      event.preventDefault();
      const segmentId = target.getAttribute('data-translation-retry');
      if (segmentId) {
        void retrySegment(segmentId);
      }
    };

    container.addEventListener('click', handleClick);
    container.addEventListener('keydown', handleKeyDown);
    return () => {
      container.removeEventListener('click', handleClick);
      container.removeEventListener('keydown', handleKeyDown);
    };
  }, [retrySegment]);

  return (
    <div ref={containerRef} data-testid="immersive-translation-layer">
      <SafeHtml
        html={translatedHtml}
        bionicEnglish={bionicEnglish}
        chineseConversionMode={chineseConversionMode}
        customConversionRules={customConversionRules}
        codeTheme={codeTheme}
        className={className}
        style={style}
        onTranslateNode={handleTranslateNode}
        segmentStates={segmentStates}
        availableProviders={availableProviders}
        onTranslateWithProvider={translateWithProvider}
        onRetryTranslation={handleTranslateNode}
        onCopyTranslation={handleCopyTranslation}
      />
    </div>
  );
}
