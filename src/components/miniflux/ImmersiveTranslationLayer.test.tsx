import { i18n } from '@lingui/core';
import { I18nProvider } from '@lingui/react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useState } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { commands } from '@/lib/tauri-bindings';
import type { TranslationStreamCallbacks } from '@/services/translation';
import { translateReaderSegmentStream } from '@/services/translation';
import { ImmersiveTranslationLayer } from './ImmersiveTranslationLayer';

vi.mock('@/lib/logger', () => ({
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  trace: vi.fn(),
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn(), trace: vi.fn() },
}));

vi.mock('@/services/translation', () => ({
  translateReaderSegmentStream: vi.fn(),
}));

const sampleHtml = '<p>Paragraph one original</p><p>Paragraph two original</p>';
const sampleRichHtml =
  '<h2>Title keeps format</h2><p>Paragraph one original</p><ul><li>Bullet keeps format</li></ul>';
const sampleUnsafeHtml =
  '<p>Paragraph one original<script>alert("xss")</script></p><p>Paragraph two original</p>';

const baseTranslationPreferences = {
  reader_translation_route_mode: 'engine_first' as const,
  reader_translation_target_language: 'zh-CN',
  reader_translation_primary_engine: 'deepl',
  reader_translation_engine_fallbacks: ['google_translate'],
  reader_translation_llm_fallbacks: ['openai'],
  reader_translation_apple_fallback_enabled: true,
};

/** Mock that simulates streaming by calling onDone immediately */
function mockTranslateStream(
  input: { text: string },
  _streamId: string,
  callbacks: TranslationStreamCallbacks
) {
  // Simulate streaming — call onDone immediately with translated text
  Promise.resolve().then(() => {
    callbacks.onDone(`Translated: ${input.text}`, 'deepl');
  });
  // Return a mock unlisten function
  return Promise.resolve(() => {});
}

/** Mock that simulates a streaming error */
function mockTranslateStreamError(
  _input: { text: string },
  _streamId: string,
  callbacks: TranslationStreamCallbacks
) {
  Promise.resolve().then(() => {
    callbacks.onError('network');
  });
  return Promise.resolve(() => {});
}

function renderWithI18n(component: React.ReactElement) {
  i18n.load('en', {});
  i18n.activate('en');
  return render(<I18nProvider i18n={i18n}>{component}</I18nProvider>);
}

function LayerHarness({
  translationDisplayMode,
}: {
  translationDisplayMode: 'bilingual' | 'translated_only';
}) {
  const [token, setToken] = useState(0);

  return (
    <div>
      <button type="button" onClick={() => setToken((previousToken) => previousToken + 1)}>
        Translate
      </button>
      <ImmersiveTranslationLayer
        entryId="entry-1"
        html={sampleHtml}
        translationEnabled
        translationDisplayMode={translationDisplayMode}
        translateRequestToken={token}
        translationPreferences={baseTranslationPreferences}
        bionicEnglish={false}
        chineseConversionMode="s2tw"
        customConversionRules={[]}
        codeTheme="auto"
      />
    </div>
  );
}

describe('ImmersiveTranslationLayer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (translateReaderSegmentStream as unknown as ReturnType<typeof vi.fn>).mockImplementation(
      mockTranslateStream
    );
    // Default: cache miss so existing tests still call translateReaderSegmentStream
    vi.mocked(commands.getTranslationCacheEntry).mockResolvedValue({ status: 'ok', data: null });
    vi.mocked(commands.setTranslationCacheEntry).mockResolvedValue({ status: 'ok', data: null });
  });

  it('clicking Translate triggers segment translation requests', async () => {
    renderWithI18n(<LayerHarness translationDisplayMode="bilingual" />);

    fireEvent.click(screen.getByRole('button', { name: 'Translate' }));

    await waitFor(() => {
      expect(translateReaderSegmentStream).toHaveBeenCalledTimes(2);
    });
  });

  it('translated_only mode hides original paragraph text nodes', async () => {
    renderWithI18n(
      <ImmersiveTranslationLayer
        entryId="entry-2"
        html={sampleHtml}
        translationEnabled
        translationDisplayMode="translated_only"
        translateRequestToken={1}
        translationPreferences={baseTranslationPreferences}
        bionicEnglish={false}
        chineseConversionMode="s2tw"
        customConversionRules={[]}
        codeTheme="auto"
      />
    );

    await screen.findByText('Translated: Paragraph one original');
    await screen.findByText('Translated: Paragraph two original');
    expect(screen.queryByText('Paragraph one original')).not.toBeInTheDocument();
    expect(screen.queryByText('Paragraph two original')).not.toBeInTheDocument();
  });

  it('does not auto-translate when request token is zero', async () => {
    renderWithI18n(
      <ImmersiveTranslationLayer
        entryId="entry-idle"
        html={sampleHtml}
        translationEnabled
        translationDisplayMode="bilingual"
        translateRequestToken={0}
        translationPreferences={baseTranslationPreferences}
        bionicEnglish={false}
        chineseConversionMode="s2tw"
        customConversionRules={[]}
        codeTheme="auto"
      />
    );

    expect(translateReaderSegmentStream).not.toHaveBeenCalled();
  });

  it('renders retry button when segment translation fails', async () => {
    (translateReaderSegmentStream as unknown as ReturnType<typeof vi.fn>).mockImplementationOnce(
      mockTranslateStreamError
    );

    renderWithI18n(
      <ImmersiveTranslationLayer
        entryId="entry-failure"
        html={sampleHtml}
        translationEnabled
        translationDisplayMode="bilingual"
        translateRequestToken={1}
        translationPreferences={baseTranslationPreferences}
        bionicEnglish={false}
        chineseConversionMode="s2tw"
        customConversionRules={[]}
        codeTheme="auto"
      />
    );

    const retryButton = await screen.findByTestId('translation-retry-0');
    fireEvent.click(retryButton);

    await waitFor(() => {
      expect(translateReaderSegmentStream).toHaveBeenCalledTimes(3);
    });
  });

  it('keeps original article structure when translation is enabled', async () => {
    renderWithI18n(
      <ImmersiveTranslationLayer
        entryId="entry-format"
        html={sampleRichHtml}
        translationEnabled
        translationDisplayMode="bilingual"
        translateRequestToken={1}
        translationPreferences={baseTranslationPreferences}
        bionicEnglish={false}
        chineseConversionMode="s2tw"
        customConversionRules={[]}
        codeTheme="auto"
      />
    );

    await screen.findByText('Translated: Paragraph one original');
    expect(screen.getByText('Title keeps format')).toBeInTheDocument();
    expect(screen.getByText('Bullet keeps format')).toBeInTheDocument();
  });

  describe('translation cache', () => {
    it('uses cached translation without calling translateReaderSegmentStream', async () => {
      vi.mocked(commands.getTranslationCacheEntry).mockResolvedValue({
        status: 'ok',
        data: {
          translated_text: 'Cached result',
          provider_used: 'openai',
          cached_at: '1700000000',
        },
      });

      renderWithI18n(
        <ImmersiveTranslationLayer
          entryId="entry-cache-hit"
          html={sampleHtml}
          translationEnabled
          translationDisplayMode="bilingual"
          translateRequestToken={1}
          translationPreferences={baseTranslationPreferences}
          bionicEnglish={false}
          chineseConversionMode="s2tw"
          customConversionRules={[]}
          codeTheme="auto"
        />
      );

      await waitFor(() => {
        expect(commands.getTranslationCacheEntry).toHaveBeenCalled();
      });

      expect(translateReaderSegmentStream).not.toHaveBeenCalled();
    });

    it('writes to cache after successful live translation', async () => {
      renderWithI18n(
        <ImmersiveTranslationLayer
          entryId="entry-cache-write"
          html={sampleHtml}
          translationEnabled
          translationDisplayMode="bilingual"
          translateRequestToken={1}
          translationPreferences={baseTranslationPreferences}
          bionicEnglish={false}
          chineseConversionMode="s2tw"
          customConversionRules={[]}
          codeTheme="auto"
        />
      );

      await waitFor(() => {
        expect(commands.setTranslationCacheEntry).toHaveBeenCalled();
      });
    });
  });

  it('skips paragraphs shorter than 20 characters from auto-translation', async () => {
    const htmlWithShortParagraph =
      '<p>Hi</p><p>Paragraph one original text that is long enough to translate</p>';

    renderWithI18n(
      <ImmersiveTranslationLayer
        entryId="entry-short-para"
        html={htmlWithShortParagraph}
        translationEnabled
        translationDisplayMode="bilingual"
        translateRequestToken={1}
        translationPreferences={baseTranslationPreferences}
        bionicEnglish={false}
        chineseConversionMode="s2tw"
        customConversionRules={[]}
        codeTheme="auto"
      />
    );

    await waitFor(() => {
      expect(translateReaderSegmentStream).toHaveBeenCalledTimes(1);
    });

    const calls = (translateReaderSegmentStream as unknown as ReturnType<typeof vi.fn>).mock
      .calls as Array<[{ text: string }]>;
    expect(calls[0]?.[0]?.text).toBe(
      'Paragraph one original text that is long enough to translate'
    );
  });

  it('sanitizes html before building translation segments', async () => {
    renderWithI18n(
      <ImmersiveTranslationLayer
        entryId="entry-safe-html"
        html={sampleUnsafeHtml}
        translationEnabled
        translationDisplayMode="bilingual"
        translateRequestToken={1}
        translationPreferences={baseTranslationPreferences}
        bionicEnglish={false}
        chineseConversionMode="s2tw"
        customConversionRules={[]}
        codeTheme="auto"
      />
    );

    await waitFor(() => {
      expect(translateReaderSegmentStream).toHaveBeenCalledTimes(2);
    });

    const calls = (translateReaderSegmentStream as unknown as ReturnType<typeof vi.fn>).mock
      .calls as Array<[{ text: string }]>;
    const hasUnsafeScriptText = calls.some((call) => call[0]?.text.includes('alert("xss")'));

    expect(hasUnsafeScriptText).toBe(false);
  });
});
