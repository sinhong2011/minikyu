import { i18n } from '@lingui/core';
import { I18nProvider } from '@lingui/react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { translateReaderSegmentWithPreferences } from '@/services/translation';
import { ReaderSelectionToolbar } from './ReaderSelectionToolbar';

vi.mock('@/services/translation', () => ({
  translateReaderSegmentWithPreferences: vi.fn(),
}));

vi.mock('@tauri-apps/plugin-opener', () => ({
  openUrl: vi.fn().mockResolvedValue(undefined),
}));

const baseTranslationPreferences = {
  reader_translation_route_mode: 'engine_first' as const,
  reader_translation_target_language: 'zh-CN',
  reader_translation_primary_engine: 'deepl',
  reader_translation_engine_fallbacks: ['google_translate'],
  reader_translation_llm_fallbacks: ['openai'],
  reader_translation_apple_fallback_enabled: true,
};

const mockRect = {
  left: 100,
  top: 200,
  right: 200,
  bottom: 220,
  width: 100,
  height: 20,
  x: 100,
  y: 200,
  toJSON: () => ({}),
} as DOMRect;

function renderWithI18n(component: React.ReactElement) {
  i18n.load('en', {});
  i18n.activate('en');
  return render(<I18nProvider i18n={i18n}>{component}</I18nProvider>);
}

function setupSelection(text: string) {
  const mockSelection = {
    toString: () => text,
    rangeCount: text.trim().length > 0 ? 1 : 0,
    getRangeAt: () => ({
      getBoundingClientRect: () => mockRect,
    }),
  };
  vi.spyOn(window, 'getSelection').mockReturnValue(mockSelection as unknown as Selection);
  return mockSelection;
}

function clearSelection() {
  vi.spyOn(window, 'getSelection').mockReturnValue({
    toString: () => '',
    rangeCount: 0,
    getRangeAt: () => null,
  } as unknown as Selection);
}

describe('ReaderSelectionToolbar', () => {
  let container: HTMLDivElement;
  let containerRef: { current: HTMLElement | null };

  beforeEach(() => {
    vi.clearAllMocks();
    clearSelection();

    container = document.createElement('div');
    document.body.appendChild(container);
    containerRef = { current: container };

    (
      translateReaderSegmentWithPreferences as unknown as ReturnType<typeof vi.fn>
    ).mockResolvedValue({
      translatedText: 'Translated text',
      providerUsed: 'deepl',
      fallbackChain: ['deepl'],
    });
  });

  afterEach(() => {
    document.body.removeChild(container);
  });

  it('shows toolbar when text is selected inside container', async () => {
    setupSelection('Hello world');
    renderWithI18n(
      <ReaderSelectionToolbar
        containerRef={containerRef}
        translationPreferences={baseTranslationPreferences}
      />
    );

    fireEvent.mouseUp(container);

    await waitFor(() => {
      expect(screen.getByLabelText('Translate selection')).toBeInTheDocument();
    });
  });

  it('does not show toolbar for empty selection', async () => {
    clearSelection();
    renderWithI18n(
      <ReaderSelectionToolbar
        containerRef={containerRef}
        translationPreferences={baseTranslationPreferences}
      />
    );

    fireEvent.mouseUp(container);

    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(screen.queryByLabelText('Translate selection')).not.toBeInTheDocument();
  });

  it('does not show toolbar for whitespace-only selection', async () => {
    setupSelection('   ');
    renderWithI18n(
      <ReaderSelectionToolbar
        containerRef={containerRef}
        translationPreferences={baseTranslationPreferences}
      />
    );

    fireEvent.mouseUp(container);

    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(screen.queryByLabelText('Translate selection')).not.toBeInTheDocument();
  });

  it('does not show toolbar for mouseup outside container', async () => {
    setupSelection('Hello world');
    renderWithI18n(
      <ReaderSelectionToolbar
        containerRef={containerRef}
        translationPreferences={baseTranslationPreferences}
      />
    );

    const outside = document.createElement('div');
    document.body.appendChild(outside);
    fireEvent.mouseUp(outside);

    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(screen.queryByLabelText('Translate selection')).not.toBeInTheDocument();
    document.body.removeChild(outside);
  });

  it('hides toolbar on mousedown outside toolbar', async () => {
    setupSelection('Hello world');
    renderWithI18n(
      <ReaderSelectionToolbar
        containerRef={containerRef}
        translationPreferences={baseTranslationPreferences}
      />
    );

    fireEvent.mouseUp(container);
    await waitFor(() => {
      expect(screen.getByLabelText('Translate selection')).toBeInTheDocument();
    });

    await act(async () => {
      document.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    });
    await waitFor(() => {
      expect(screen.queryByLabelText('Translate selection')).not.toBeInTheDocument();
    });
  });

  it('hides toolbar on Escape key', async () => {
    setupSelection('Hello world');
    renderWithI18n(
      <ReaderSelectionToolbar
        containerRef={containerRef}
        translationPreferences={baseTranslationPreferences}
      />
    );

    fireEvent.mouseUp(container);
    await waitFor(() => {
      expect(screen.getByLabelText('Translate selection')).toBeInTheDocument();
    });

    fireEvent.keyDown(document, { key: 'Escape' });
    await waitFor(() => {
      expect(screen.queryByLabelText('Translate selection')).not.toBeInTheDocument();
    });
  });

  it('hides toolbar on container scroll', async () => {
    setupSelection('Hello world');
    renderWithI18n(
      <ReaderSelectionToolbar
        containerRef={containerRef}
        translationPreferences={baseTranslationPreferences}
      />
    );

    fireEvent.mouseUp(container);
    await waitFor(() => {
      expect(screen.getByLabelText('Translate selection')).toBeInTheDocument();
    });

    await act(async () => {
      container.dispatchEvent(new Event('scroll', { bubbles: true }));
    });
    await waitFor(
      () => {
        expect(screen.queryByLabelText('Translate selection')).not.toBeInTheDocument();
      },
      { timeout: 3000 }
    );
  });

  it('calls translateReaderSegmentWithPreferences with selected text', async () => {
    setupSelection('Hello world');
    renderWithI18n(
      <ReaderSelectionToolbar
        containerRef={containerRef}
        translationPreferences={baseTranslationPreferences}
      />
    );

    fireEvent.mouseUp(container);
    await waitFor(() => {
      expect(screen.getByLabelText('Translate selection')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByLabelText('Translate selection'));

    await waitFor(() => {
      expect(translateReaderSegmentWithPreferences).toHaveBeenCalledWith({
        text: 'Hello world',
        sourceLanguage: undefined,
        preferences: baseTranslationPreferences,
      });
    });
  });

  it('shows translation result after successful translation', async () => {
    setupSelection('Hello world');
    renderWithI18n(
      <ReaderSelectionToolbar
        containerRef={containerRef}
        translationPreferences={baseTranslationPreferences}
      />
    );

    fireEvent.mouseUp(container);
    await waitFor(() => {
      expect(screen.getByLabelText('Translate selection')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByLabelText('Translate selection'));

    await waitFor(() => {
      expect(screen.getByText('Translated text')).toBeInTheDocument();
    });
  });

  it('shows error message when translation fails', async () => {
    (
      translateReaderSegmentWithPreferences as unknown as ReturnType<typeof vi.fn>
    ).mockRejectedValue(new Error('Network error'));

    setupSelection('Hello world');
    renderWithI18n(
      <ReaderSelectionToolbar
        containerRef={containerRef}
        translationPreferences={baseTranslationPreferences}
      />
    );

    fireEvent.mouseUp(container);
    await waitFor(() => {
      expect(screen.getByLabelText('Translate selection')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByLabelText('Translate selection'));

    await waitFor(() => {
      expect(screen.getByText('Translation failed')).toBeInTheDocument();
    });
  });

  it('copies selected text when copy button is clicked', async () => {
    const writeTextMock = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: writeTextMock },
      writable: true,
    });

    setupSelection('Hello world');
    renderWithI18n(
      <ReaderSelectionToolbar
        containerRef={containerRef}
        translationPreferences={baseTranslationPreferences}
      />
    );

    fireEvent.mouseUp(container);
    await waitFor(() => {
      expect(screen.getByLabelText('Copy')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByLabelText('Copy'));

    await waitFor(() => {
      expect(writeTextMock).toHaveBeenCalledWith('Hello world');
    });
  });

  it('opens Google search URL when search button is clicked', async () => {
    const { openUrl } = await import('@tauri-apps/plugin-opener');
    const openMock = vi.mocked(openUrl);

    setupSelection('Hello world');
    renderWithI18n(
      <ReaderSelectionToolbar
        containerRef={containerRef}
        translationPreferences={baseTranslationPreferences}
      />
    );

    fireEvent.mouseUp(container);
    await waitFor(() => {
      expect(screen.getByLabelText('Search')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByLabelText('Search'));

    expect(openMock).toHaveBeenCalledWith('https://www.google.com/search?q=Hello%20world');
  });

  it('passes sourceLanguage to translation service', async () => {
    setupSelection('Bonjour');
    renderWithI18n(
      <ReaderSelectionToolbar
        containerRef={containerRef}
        translationPreferences={baseTranslationPreferences}
        sourceLanguage="fr"
      />
    );

    fireEvent.mouseUp(container);
    await waitFor(() => {
      expect(screen.getByLabelText('Translate selection')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByLabelText('Translate selection'));

    await waitFor(() => {
      expect(translateReaderSegmentWithPreferences).toHaveBeenCalledWith({
        text: 'Bonjour',
        sourceLanguage: 'fr',
        preferences: baseTranslationPreferences,
      });
    });
  });
});
