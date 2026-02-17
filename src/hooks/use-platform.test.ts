import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock the Tauri OS plugin
vi.mock('@tauri-apps/plugin-os', () => ({
  platform: vi.fn(() => 'macos'),
}));

// Mock the logger
vi.mock('@/lib/logger', () => ({
  logger: {
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    info: vi.fn(),
  },
}));

// Import the module under test after mocks are set up
const { platform } = await import('@tauri-apps/plugin-os');
const { getPlatform, usePlatform, useIsMacOS, useIsWindows, useIsLinux, __resetPlatformCache } =
  await import('./use-platform');

describe('Platform Detection', () => {
  beforeEach(() => {
    // Reset the platform cache before each test
    __resetPlatformCache();
    vi.clearAllMocks();
  });

  describe('getPlatform', () => {
    it('returns macos when platform() returns macos', () => {
      (platform as ReturnType<typeof vi.fn>).mockReturnValue('macos');
      expect(getPlatform()).toBe('macos');
    });

    it('returns windows when platform() returns windows', () => {
      (platform as ReturnType<typeof vi.fn>).mockReturnValue('windows');
      expect(getPlatform()).toBe('windows');
    });

    it('returns linux when platform() returns linux', () => {
      (platform as ReturnType<typeof vi.fn>).mockReturnValue('linux');
      expect(getPlatform()).toBe('linux');
    });

    it('returns linux for other unix-like platforms', () => {
      (platform as ReturnType<typeof vi.fn>).mockReturnValue('freebsd');
      expect(getPlatform()).toBe('linux');
    });

    it('caches the platform value', () => {
      (platform as ReturnType<typeof vi.fn>).mockReturnValue('macos');
      getPlatform();
      getPlatform();
      getPlatform();

      // Platform should only be called once due to caching
      expect(platform).toHaveBeenCalledTimes(1);
    });

    it('falls back to macos when platform() throws', async () => {
      (platform as ReturnType<typeof vi.fn>).mockImplementation(() => {
        throw new Error('Not in Tauri context');
      });

      const result = getPlatform();

      expect(result).toBe('macos');
      const { logger } = await import('@/lib/logger');
      expect(logger.warn).toHaveBeenCalledWith('Platform detection failed, defaulting to macOS');
    });
  });

  describe('usePlatform hook', () => {
    it('returns the current platform', () => {
      (platform as ReturnType<typeof vi.fn>).mockReturnValue('windows');

      const { result } = renderHook(() => usePlatform());

      expect(result.current).toBe('windows');
    });
  });

  describe('convenience hooks', () => {
    it('useIsMacOS returns true on macOS', () => {
      (platform as ReturnType<typeof vi.fn>).mockReturnValue('macos');

      const { result } = renderHook(() => useIsMacOS());

      expect(result.current).toBe(true);
    });

    it('useIsMacOS returns false on other platforms', () => {
      (platform as ReturnType<typeof vi.fn>).mockReturnValue('windows');

      const { result } = renderHook(() => useIsMacOS());

      expect(result.current).toBe(false);
    });

    it('useIsWindows returns true on Windows', () => {
      (platform as ReturnType<typeof vi.fn>).mockReturnValue('windows');

      const { result } = renderHook(() => useIsWindows());

      expect(result.current).toBe(true);
    });

    it('useIsWindows returns false on other platforms', () => {
      (platform as ReturnType<typeof vi.fn>).mockReturnValue('macos');

      const { result } = renderHook(() => useIsWindows());

      expect(result.current).toBe(false);
    });

    it('useIsLinux returns true on Linux', () => {
      (platform as ReturnType<typeof vi.fn>).mockReturnValue('linux');

      const { result } = renderHook(() => useIsLinux());

      expect(result.current).toBe(true);
    });

    it('useIsLinux returns false on other platforms', () => {
      (platform as ReturnType<typeof vi.fn>).mockReturnValue('macos');

      const { result } = renderHook(() => useIsLinux());

      expect(result.current).toBe(false);
    });
  });
});
