import { i18n } from '@lingui/core';
import { beforeEach, describe, expect, it, type Mock, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@/test/test-utils';
import { TranslationPane } from './TranslationPane';

const mockUsePreferences = vi.fn();
const mockUseSavePreferences = vi.fn();
const mockGetTranslationProviderKeyStatus = vi.fn();
const mockSaveTranslationProviderKey = vi.fn();
const mockDeleteTranslationProviderKey = vi.fn();
const mockTranslateReaderSegment = vi.fn();
const mockClearLocalData = vi.fn();
const mockMinifluxDisconnect = vi.fn();

vi.mock('@/services/preferences', () => ({
  usePreferences: () => mockUsePreferences(),
  useSavePreferences: () => mockUseSavePreferences(),
}));

vi.mock('@/services/miniflux/feeds', () => ({
  useFeeds: () => ({ data: [] }),
}));

vi.mock('@/services/miniflux/categories', () => ({
  useCategories: () => ({ data: [] }),
}));

vi.mock('@/lib/tauri-bindings', () => ({
  commands: {
    getTranslationProviderKeyStatus: (...args: unknown[]) =>
      mockGetTranslationProviderKeyStatus(...args),
    saveTranslationProviderKey: (...args: unknown[]) => mockSaveTranslationProviderKey(...args),
    deleteTranslationProviderKey: (...args: unknown[]) => mockDeleteTranslationProviderKey(...args),
    translateReaderSegment: (...args: unknown[]) => mockTranslateReaderSegment(...args),
    clearLocalData: (...args: unknown[]) => mockClearLocalData(...args),
    minifluxDisconnect: (...args: unknown[]) => mockMinifluxDisconnect(...args),
    getProviderAvailableModels: vi.fn().mockResolvedValue({ status: 'ok', data: [] }),
  },
}));

const basePreferences = {
  theme: 'system',
  quick_pane_shortcut: null,
  language: null,
  close_behavior: 'minimize_to_tray' as const,
  show_tray_icon: true,
  start_minimized: false,
  reader_font_size: 16,
  reader_line_width: 65,
  reader_line_height: 1.75,
  reader_font_family: 'sans-serif',
  reader_theme: 'default',
  reader_code_theme: 'auto',
  reader_chinese_conversion: 's2tw' as const,
  reader_bionic_reading: false,
  reader_status_bar: false,
  reader_custom_conversions: [],
  reader_translation_display_mode: 'bilingual' as const,
  reader_translation_trigger_mode: 'manual' as const,
  reader_translation_route_mode: 'engine_first' as const,
  reader_translation_target_language: 'zh-TW',
  reader_translation_primary_engine: 'deepl',
  reader_translation_engine_fallbacks: ['google_translate'],
  reader_translation_llm_fallbacks: ['openai'],
  reader_translation_apple_fallback_enabled: true,
  reader_translation_provider_settings: {},
  reader_translation_auto_enabled: false,
  reader_translation_exclusions: {},
  image_download_path: null,
  video_download_path: null,
  player_display_mode: 'FloatingWindow',
};

describe('TranslationPane settings', () => {
  const mutateAsync = vi.fn().mockResolvedValue(undefined);

  beforeEach(() => {
    i18n.load('en', {});
    i18n.activate('en');

    mockUsePreferences.mockReturnValue({ data: { ...basePreferences } });
    mockUseSavePreferences.mockReturnValue({
      mutateAsync,
      isPending: false,
    });
    mockGetTranslationProviderKeyStatus.mockImplementation(async (provider: string) => ({
      status: 'ok',
      data: provider === 'deepl',
    }));
    mockSaveTranslationProviderKey.mockResolvedValue({ status: 'ok', data: null });
    mockDeleteTranslationProviderKey.mockResolvedValue({ status: 'ok', data: null });
    mockTranslateReaderSegment.mockResolvedValue({
      status: 'ok',
      data: {
        translated_text: 'こんにちは世界',
        provider_used: 'openai',
        fallback_chain: ['openai'],
      },
    });
    mockClearLocalData.mockResolvedValue({ status: 'ok', data: null });
    mockMinifluxDisconnect.mockResolvedValue({ status: 'ok', data: null });
    mutateAsync.mockClear();
    mockTranslateReaderSegment.mockClear();
  });

  it('renders provider list with status labels in selected provider settings', async () => {
    render(<TranslationPane />);

    expect(await screen.findByRole('heading', { name: 'Providers' })).toBeInTheDocument();
    expect(screen.getByText('Translation engines')).toBeInTheDocument();
    expect(screen.getByText('LLM providers')).toBeInTheDocument();
    expect(screen.queryByText('Provider settings')).not.toBeInTheDocument();
    expect(screen.getByText('Enabled')).toBeInTheDocument();
    expect(await screen.findByText('Configured')).toBeInTheDocument();
    expect(screen.getByTestId('selected-provider-required-fields')).toHaveTextContent(
      'Required fields: API key'
    );
    const deeplRow = screen.getByTestId('translation-provider-row-deepl');
    expect(deeplRow).toBeInTheDocument();
    const openaiRow = screen.getByTestId('translation-provider-row-openai');
    expect(
      within(openaiRow).getByTestId('translation-provider-missing-openai')
    ).toBeInTheDocument();
    expect(
      within(deeplRow).queryByTestId('translation-provider-missing-deepl')
    ).not.toBeInTheDocument();
    fireEvent.click(within(openaiRow).getByText('OpenAI'));
    expect(await screen.findByText('Missing required fields')).toBeInTheDocument();
    expect(screen.getByTestId('selected-provider-required-fields')).toHaveTextContent(
      'Required fields: API key, Model'
    );
    const ollamaRow = screen.getByTestId('translation-provider-row-ollama');
    fireEvent.click(within(ollamaRow).getByText('Ollama'));
    expect(screen.getByTestId('selected-provider-required-fields')).toHaveTextContent(
      'Required fields: Model'
    );
  });

  it('renders reorder handles for providers', async () => {
    render(<TranslationPane />);

    expect(await screen.findByRole('button', { name: 'Reorder DeepL' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reorder OpenAI' })).toBeInTheDocument();
  });

  it('uses provider-specific default endpoint placeholders', async () => {
    render(<TranslationPane />);

    expect(await screen.findByLabelText('DeepL base URL')).toHaveAttribute(
      'placeholder',
      'https://api-free.deepl.com/v2'
    );
    fireEvent.click(
      within(screen.getByTestId('translation-provider-row-google_translate')).getByText(
        'Google Translate'
      )
    );
    expect(screen.getByLabelText('Google Translate base URL')).toHaveAttribute(
      'placeholder',
      'https://translation.googleapis.com'
    );
    fireEvent.click(
      within(screen.getByTestId('translation-provider-row-ollama')).getByText('Ollama')
    );
    expect(screen.getByLabelText('Ollama base URL')).toHaveAttribute(
      'placeholder',
      'http://localhost:11434'
    );
  });

  it('saves provider key via backend command on blur', async () => {
    render(<TranslationPane />);

    fireEvent.click(
      within(screen.getByTestId('translation-provider-row-openai')).getByText('OpenAI')
    );
    const keyInput = await screen.findByLabelText('OpenAI API key');
    fireEvent.change(keyInput, { target: { value: 'sk-test-openai' } });
    fireEvent.blur(keyInput);

    await waitFor(() => {
      expect(mockSaveTranslationProviderKey).toHaveBeenCalledWith(
        'openai',
        'default',
        'sk-test-openai'
      );
    });
  });

  it('verifies selected configured provider from the form', async () => {
    render(<TranslationPane />);

    fireEvent.click(screen.getByRole('button', { name: 'Verify' }));

    await waitFor(() => {
      expect(mockTranslateReaderSegment).toHaveBeenCalledWith(
        expect.objectContaining({
          primary_engine: 'deepl',
          llm_fallbacks: [],
        })
      );
    });
  });

  it('does not verify provider when required configuration is missing', async () => {
    render(<TranslationPane />);

    fireEvent.click(
      within(screen.getByTestId('translation-provider-row-openai')).getByText('OpenAI')
    );
    fireEvent.click(screen.getByRole('button', { name: 'Verify' }));

    await waitFor(() => {
      expect(mockTranslateReaderSegment).not.toHaveBeenCalled();
    });
  });

  it('shows optional API key input for ollama without flagging it as required', async () => {
    render(<TranslationPane />);

    fireEvent.click(
      within(screen.getByTestId('translation-provider-row-ollama')).getByText('Ollama')
    );
    expect(await screen.findByPlaceholderText('Type or fetch to pick a model')).toBeInTheDocument();
    // API key field is present but optional (for cloud API usage)
    expect(screen.getByLabelText('Ollama API key')).toBeInTheDocument();
    // Required fields only lists Model, not API key
    expect(screen.getByTestId('selected-provider-required-fields')).toHaveTextContent(
      'Required fields: Model'
    );
  });

  it('persists route mode changes and does not render apple fallback toggle', async () => {
    render(<TranslationPane />);

    fireEvent.click(await screen.findByRole('combobox', { name: 'Translation route mode' }));
    fireEvent.click(await screen.findByText('Hybrid auto'));

    await waitFor(() => {
      expect((mutateAsync as Mock).mock.calls.at(-1)?.[0]).toMatchObject({
        reader_translation_route_mode: 'hybrid_auto',
      });
    });

    expect(
      screen.queryByRole('switch', { name: 'Apple built-in fallback' })
    ).not.toBeInTheDocument();
  });

  it('persists target language change', async () => {
    render(<TranslationPane />);

    fireEvent.click(await screen.findByRole('combobox', { name: 'Translation target language' }));
    fireEvent.click(await screen.findByText('Japanese'));

    await waitFor(() => {
      expect((mutateAsync as Mock).mock.calls.at(-1)?.[0]).toMatchObject({
        reader_translation_target_language: 'ja',
      });
    });
  });
});
