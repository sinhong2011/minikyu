import '@testing-library/jest-dom';
import { vi } from 'vite-plus/test';

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
        quick_pane_shortcut: null,
        language: null,
        close_behavior: 'minimize_to_tray',
        show_tray_icon: true,
        start_minimized: false,
        reader_font_size: 16,
        reader_line_width: 65,
        reader_line_height: 1.75,
        reader_font_family: 'sans-serif',
        reader_theme: 'default',
        reader_code_theme: 'auto',
        reader_code_detection_mode: 'auto',
        reader_code_detection_prompt: null,
        reader_chinese_conversion: 's2tw',
        reader_bionic_reading: false,
        reader_status_bar: false,
        reader_custom_conversions: [],
        reader_translation_display_mode: 'bilingual',
        reader_translation_trigger_mode: 'manual',
        reader_translation_route_mode: 'engine_first',
        reader_translation_target_language: null,
        reader_translation_primary_engine: 'deepl',
        reader_translation_engine_fallbacks: ['google_translate'],
        reader_translation_llm_fallbacks: [],
        reader_translation_apple_fallback_enabled: false,
        reader_translation_provider_settings: {},
        image_download_path: null,
        video_download_path: null,
        player_display_mode: 'FloatingWindow',
        ui_font_family: null,
        ui_font_size: null,
      },
    }),
    savePreferences: vi.fn().mockResolvedValue({ status: 'ok', data: null }),
    listSystemFonts: vi.fn().mockResolvedValue({ status: 'ok', data: [] }),
    sendNativeNotification: vi.fn().mockResolvedValue({ status: 'ok', data: null }),
    saveEmergencyData: vi.fn().mockResolvedValue({ status: 'ok', data: null }),
    loadEmergencyData: vi.fn().mockResolvedValue({ status: 'ok', data: null }),
    cleanupOldRecoveryFiles: vi.fn().mockResolvedValue({ status: 'ok', data: 0 }),
    switchMinifluxAccount: vi.fn().mockResolvedValue({ status: 'ok', data: null }),
    minifluxDisconnect: vi.fn().mockResolvedValue({ status: 'ok', data: null }),
    deleteMinifluxAccount: vi.fn().mockResolvedValue({ status: 'ok', data: null }),
    getMinifluxAccounts: vi.fn().mockResolvedValue({ status: 'ok', data: [] as any }),
    getTranslationCacheEntry: vi.fn().mockResolvedValue({ status: 'ok', data: null }),
    setTranslationCacheEntry: vi.fn().mockResolvedValue({ status: 'ok', data: null }),
  },
  unwrapResult: vi.fn((result: { status: string; data?: unknown }) => {
    if (result.status === 'ok') return result.data;
    throw result;
  }),
}));
