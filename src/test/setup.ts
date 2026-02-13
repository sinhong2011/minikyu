import '@testing-library/jest-dom';
import { vi } from 'vitest';

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

// Mock Tauri APIs for tests
vi.mock('@tauri-apps/api/event', () => ({
  listen: vi.fn().mockResolvedValue(() => {
    // Mock unlisten function
  }),
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
        reader_font_family: 'sans-serif',
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
        image_download_path: null,
        // biome-ignore lint/style/useNamingConvention: preferences field name
        video_download_path: null,
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
  },
  unwrapResult: vi.fn((result: { status: string; data?: unknown }) => {
    if (result.status === 'ok') return result.data;
    throw result;
  }),
}));

// Mock Lingui macro
vi.mock('@lingui/core/macro');
