import '@testing-library/jest-dom';
import { vi } from 'vitest';

// Mock localStorage for zustand persist middleware
const localStorageMap = new Map<string, string>();
Object.defineProperty(window, 'localStorage', {
  value: {
    getItem: (key: string) => localStorageMap.get(key) ?? null,
    setItem: (key: string, value: string) => localStorageMap.set(key, value),
    removeItem: (key: string) => localStorageMap.delete(key),
    clear: () => localStorageMap.clear(),
    get length() {
      return localStorageMap.size;
    },
    key: (index: number) => [...localStorageMap.keys()][index] ?? null,
  },
});

// Mock matchMedia for tests
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(), // deprecated
    removeListener: vi.fn(), // deprecated
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

Object.defineProperty(window.HTMLElement.prototype, 'scrollIntoView', {
  writable: true,
  value: vi.fn(),
});

// Mock Tauri APIs for tests
vi.mock('@tauri-apps/api/event', () => ({
  listen: vi.fn().mockResolvedValue(() => {
    // Mock unlisten function
  }),
  emit: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@tauri-apps/plugin-updater', () => ({
  check: vi.fn().mockResolvedValue(null),
}));

vi.mock('@tauri-apps/api/window', () => ({
  getCurrentWindow: vi.fn().mockReturnValue({
    isFullscreen: vi.fn().mockResolvedValue(false),
    isMaximized: vi.fn().mockResolvedValue(false),
    onResized: vi.fn().mockResolvedValue(vi.fn()),
    onFocusChanged: vi.fn().mockResolvedValue(vi.fn()),
  }),
}));

// Mock typed Tauri bindings (tauri-specta generated)
vi.mock('@/lib/tauri-bindings', () => ({
  commands: {
    greet: vi.fn().mockResolvedValue('Hello, test!'),
    loadPreferences: vi.fn().mockResolvedValue({
      status: 'ok',
      data: {
        theme: 'system',
        // biome-ignore lint/style/useNamingConvention: preferences field name
        quick_pane_shortcut: null,
        language: null,
        // biome-ignore lint/style/useNamingConvention: preferences field name
        close_behavior: 'minimize_to_tray',
        // biome-ignore lint/style/useNamingConvention: preferences field name
        show_tray_icon: true,
        // biome-ignore lint/style/useNamingConvention: preferences field name
        start_minimized: false,
        // biome-ignore lint/style/useNamingConvention: preferences field name
        reader_font_size: 16,
        // biome-ignore lint/style/useNamingConvention: preferences field name
        reader_line_width: 65,
        // biome-ignore lint/style/useNamingConvention: preferences field name
        reader_line_height: 1.75,
        // biome-ignore lint/style/useNamingConvention: preferences field name
        reader_font_family: 'sans-serif',
        // biome-ignore lint/style/useNamingConvention: preferences field name
        reader_theme: 'default',
        // biome-ignore lint/style/useNamingConvention: preferences field name
        reader_code_theme: 'auto',
        // biome-ignore lint/style/useNamingConvention: preferences field name
        reader_chinese_conversion: 's2tw',
        // biome-ignore lint/style/useNamingConvention: preferences field name
        reader_bionic_reading: false,
        // biome-ignore lint/style/useNamingConvention: preferences field name
        reader_status_bar: false,
        // biome-ignore lint/style/useNamingConvention: preferences field name
        reader_custom_conversions: [],
        // biome-ignore lint/style/useNamingConvention: preferences field name
        reader_translation_display_mode: 'bilingual',
        // biome-ignore lint/style/useNamingConvention: preferences field name
        reader_translation_trigger_mode: 'manual',
        // biome-ignore lint/style/useNamingConvention: preferences field name
        reader_translation_route_mode: 'engine_first',
        // biome-ignore lint/style/useNamingConvention: preferences field name
        reader_translation_target_language: null,
        // biome-ignore lint/style/useNamingConvention: preferences field name
        reader_translation_primary_engine: 'deepl',
        // biome-ignore lint/style/useNamingConvention: preferences field name
        reader_translation_engine_fallbacks: ['google_translate'],
        // biome-ignore lint/style/useNamingConvention: preferences field name
        reader_translation_llm_fallbacks: [],
        // biome-ignore lint/style/useNamingConvention: preferences field name
        reader_translation_apple_fallback_enabled: false,
        // biome-ignore lint/style/useNamingConvention: preferences field name
        reader_translation_provider_settings: {},
        // biome-ignore lint/style/useNamingConvention: preferences field name
        image_download_path: null,
        // biome-ignore lint/style/useNamingConvention: preferences field name
        video_download_path: null,
        // biome-ignore lint/style/useNamingConvention: preferences field name
        player_display_mode: 'FloatingWindow',
      },
    }),
    savePreferences: vi.fn().mockResolvedValue({ status: 'ok', data: null }),
    sendNativeNotification: vi.fn().mockResolvedValue({ status: 'ok', data: null }),
    saveEmergencyData: vi.fn().mockResolvedValue({ status: 'ok', data: null }),
    loadEmergencyData: vi.fn().mockResolvedValue({ status: 'ok', data: null }),
    cleanupOldRecoveryFiles: vi.fn().mockResolvedValue({ status: 'ok', data: 0 }),
    switchMinifluxAccount: vi.fn().mockResolvedValue({ status: 'ok', data: null }),
    minifluxDisconnect: vi.fn().mockResolvedValue({ status: 'ok', data: null }),
    getMinifluxAccounts: vi.fn().mockResolvedValue({ status: 'ok', data: [] as any }),
    getTranslationCacheEntry: vi.fn().mockResolvedValue({ status: 'ok', data: null }),
    setTranslationCacheEntry: vi.fn().mockResolvedValue({ status: 'ok', data: null }),
  },
  unwrapResult: vi.fn((result: { status: string; data?: unknown }) => {
    if (result.status === 'ok') return result.data;
    throw result;
  }),
}));
