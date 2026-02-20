import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import type { ReaderCodeTheme } from '@/lib/shiki-highlight';
import type { TranslationRoutingPreferences } from '@/services/translation';
import { translateReaderSegmentWithPreferences } from '@/services/translation';
import { SafeHtml, sanitizeReaderHtml } from './SafeHtml';

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
  bionicEnglish: boolean;
  chineseConversionMode: 'off' | 's2tw' | 's2hk' | 't2s';
  customConversionRules: Array<{ from: string; to: string }>;
  codeTheme: ReaderCodeTheme;
  className?: string;
  style?: React.CSSProperties;
  onActiveProviderChange?: (provider: string | null) => void;
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
    .filter((segment) => segment.text.length > 0);
}

function buildTranslatedHtml({
  html,
  segments,
  segmentStates,
  translationDisplayMode,
  failedLabel,
}: {
  html: string;
  segments: TranslationSegment[];
  segmentStates: Record<string, SegmentState>;
  translationDisplayMode: 'bilingual' | 'translated_only';
  failedLabel: string;
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

    if (translationDisplayMode === 'translated_only' && state.status === 'success') {
      paragraphNode.textContent = state.translatedText ?? '';
      paragraphNode.setAttribute('data-translation-segment-id', segment.id);
      paragraphNode.setAttribute('data-testid', `translated-segment-${segment.id}`);
      continue;
    }

    if (translationDisplayMode !== 'bilingual') {
      continue;
    }

    let translatedContent: string | null = null;
    if (state.status === 'success') {
      translatedContent = state.translatedText ?? '';
    } else if (state.status === 'error') {
      translatedContent = failedLabel;
    }

    if (!translatedContent) {
      continue;
    }

    const translatedParagraph = document.createElement('p');
    translatedParagraph.textContent = translatedContent;
    translatedParagraph.setAttribute('data-translation-role', 'translated');
    translatedParagraph.setAttribute('data-translation-segment-id', segment.id);
    translatedParagraph.setAttribute('data-testid', `translated-segment-${segment.id}`);
    translatedParagraph.className = 'reader-translation-block';
    paragraphNode.insertAdjacentElement('afterend', translatedParagraph);
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
  bionicEnglish,
  chineseConversionMode,
  customConversionRules,
  codeTheme,
  className,
  style,
  onActiveProviderChange,
}: ImmersiveTranslationLayerProps) {
  const { _ } = useLingui();
  const safeSourceHtml = useMemo(() => sanitizeReaderHtml(html), [html]);
  const segments = useMemo(() => extractParagraphSegments(safeSourceHtml), [safeSourceHtml]);
  const [segmentStates, setSegmentStates] = useState<Record<string, SegmentState>>({});
  const activeRequestIdRef = useRef(0);

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
    setSegmentStates(initialState);
    onActiveProviderChange?.(null);
  }, [segments, entryId, onActiveProviderChange]);

  const translateSegment = useCallback(
    async (
      segment: TranslationSegment,
      requestId: number,
      sourceLanguageValue: string | null,
      translationPreferencesValue: TranslationRoutingPreferences
    ) => {
      setSegmentStates((previousState) => ({
        ...previousState,
        [segment.id]: {
          status: 'loading',
          translatedText: null,
          providerUsed: null,
        },
      }));

      try {
        const translationResult = await translateReaderSegmentWithPreferences({
          text: segment.text,
          sourceLanguage: sourceLanguageValue,
          preferences: translationPreferencesValue,
        });

        if (requestId !== activeRequestIdRef.current) {
          return;
        }

        setSegmentStates((previousState) => ({
          ...previousState,
          [segment.id]: {
            status: 'success',
            translatedText: translationResult.translatedText,
            providerUsed: translationResult.providerUsed,
          },
        }));

        onActiveProviderChange?.(translationResult.providerUsed);
      } catch {
        if (requestId !== activeRequestIdRef.current) {
          return;
        }

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
    [onActiveProviderChange]
  );

  useEffect(() => {
    if (!translationEnabled) {
      return;
    }

    if (translateRequestToken === 0) {
      return;
    }

    const requestId = activeRequestIdRef.current + 1;
    activeRequestIdRef.current = requestId;

    void (async () => {
      for (const segment of segments) {
        await translateSegment(segment, requestId, sourceLanguage, translationPreferences);
      }
    })();
  }, [
    translationEnabled,
    translateRequestToken,
    segments,
    translateSegment,
    translationPreferences,
    sourceLanguage,
  ]);

  const retrySegment = async (segmentId: string) => {
    const segment = segments.find((item) => item.id === segmentId);
    if (!segment) {
      return;
    }

    const requestId = activeRequestIdRef.current + 1;
    activeRequestIdRef.current = requestId;
    await translateSegment(segment, requestId, sourceLanguage, translationPreferences);
  };

  if (!translationEnabled) {
    return (
      <SafeHtml
        html={html}
        bionicEnglish={bionicEnglish}
        chineseConversionMode={chineseConversionMode}
        customConversionRules={customConversionRules}
        codeTheme={codeTheme}
        className={className}
        style={style}
      />
    );
  }

  const translatedHtml = buildTranslatedHtml({
    html: safeSourceHtml,
    segments,
    segmentStates,
    translationDisplayMode,
    failedLabel: _(msg`Translation failed`),
  });
  const failedSegments = segments.filter(
    (segment) => segmentStates[segment.id]?.status === 'error'
  );

  return (
    <div data-testid="immersive-translation-layer">
      <SafeHtml
        html={translatedHtml}
        bionicEnglish={bionicEnglish}
        chineseConversionMode={chineseConversionMode}
        customConversionRules={customConversionRules}
        codeTheme={codeTheme}
        className={className}
        style={style}
      />

      {failedSegments.length > 0 && (
        <div className="mx-auto mt-4 space-y-2 px-2" style={{ maxWidth: '80ch' }}>
          {failedSegments.map((segment) => (
            <div
              key={`retry-${segment.id}`}
              className="flex items-center justify-between rounded-md border border-border/60 bg-muted/30 px-3 py-2"
            >
              <span className="text-sm">{_(msg`Translation failed`)}</span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  void retrySegment(segment.id);
                }}
              >
                {_(msg`Retry`)}
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
