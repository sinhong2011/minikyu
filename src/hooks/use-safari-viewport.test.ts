import { renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test';

vi.mock('@/lib/platform', () => ({
  isWeb: true,
  isTauri: false,
  capabilities: {},
}));

import {
  applyVisualViewportInsets,
  clearVisualViewportInsets,
  isIPhoneSafariTab,
  measureViewportInsets,
  measureVisualViewportOverlap,
  useSafariViewportInsets,
} from './use-safari-viewport';

function mockVisualViewport(partial: { height: number; offsetTop: number; innerHeight: number }) {
  vi.stubGlobal('visualViewport', {
    height: partial.height,
    offsetTop: partial.offsetTop,
    width: 390,
    offsetLeft: 0,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  });
  vi.stubGlobal('innerHeight', partial.innerHeight);
}

function mockIPhoneSafariTab() {
  vi.stubGlobal('navigator', {
    userAgent:
      'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1',
    standalone: false,
  });
  vi.stubGlobal(
    'matchMedia',
    vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }))
  );
}

describe('measureViewportInsets', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    clearVisualViewportInsets();
  });

  it('returns zero when the visual viewport fills the layout viewport', () => {
    mockVisualViewport({ height: 800, offsetTop: 0, innerHeight: 800 });
    expect(measureVisualViewportOverlap()).toEqual({ top: 0, bottom: 0 });
  });

  it('reports Safari chrome overlapping the bottom of the layout viewport', () => {
    mockVisualViewport({ height: 700, offsetTop: 0, innerHeight: 800 });
    expect(measureVisualViewportOverlap()).toEqual({ top: 0, bottom: 100 });
  });

  it('reports a collapsed address bar as top offset', () => {
    mockVisualViewport({ height: 750, offsetTop: 50, innerHeight: 800 });
    expect(measureVisualViewportOverlap()).toEqual({ top: 50, bottom: 0 });
  });

  it('keeps an iPhone Safari tab overlay when lvh and dvh are still the same', () => {
    mockIPhoneSafariTab();
    mockVisualViewport({ height: 800, offsetTop: 0, innerHeight: 800 });
    expect(isIPhoneSafariTab()).toBe(true);
    expect(measureViewportInsets(800, 800)).toEqual({ top: 0, bottom: 80, shellOverlay: 80 });
  });

  it('does not pad a dvh shell that already excluded Safari chrome', () => {
    mockIPhoneSafariTab();
    mockVisualViewport({ height: 700, offsetTop: 0, innerHeight: 800 });
    expect(measureViewportInsets(700, 800)).toEqual({ top: 0, bottom: 100, shellOverlay: 0 });
  });

  it('does not invent an overlay when innerHeight already matches a shrunk dvh', () => {
    mockIPhoneSafariTab();
    mockVisualViewport({ height: 700, offsetTop: 0, innerHeight: 700 });
    expect(measureViewportInsets(700, 852)).toEqual({ top: 0, bottom: 0, shellOverlay: 0 });
  });

  it('does not invent an overlay when lvh cannot be measured', () => {
    mockIPhoneSafariTab();
    mockVisualViewport({ height: 800, offsetTop: 0, innerHeight: 800 });
    expect(measureViewportInsets(800, null)).toEqual({ top: 0, bottom: 0, shellOverlay: 0 });
  });
});

describe('applyVisualViewportInsets', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    clearVisualViewportInsets();
  });

  it('publishes the overlap as CSS variables on :root', () => {
    mockVisualViewport({ height: 640, offsetTop: 12, innerHeight: 780 });
    applyVisualViewportInsets();
    const style = document.documentElement.style;
    expect(style.getPropertyValue('--vv-offset-top')).toBe('12px');
    expect(style.getPropertyValue('--vv-offset-bottom')).toBe('128px');
    expect(style.getPropertyValue('--shell-overlay-bottom')).toBeTruthy();
  });
});

describe('useSafariViewportInsets', () => {
  beforeEach(() => {
    mockVisualViewport({ height: 700, offsetTop: 0, innerHeight: 800 });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    clearVisualViewportInsets();
  });

  it('applies insets on mount and clears them on unmount', () => {
    const { unmount } = renderHook(() => useSafariViewportInsets());
    expect(document.documentElement.style.getPropertyValue('--vv-offset-bottom')).toBe('100px');
    unmount();
    expect(document.documentElement.style.getPropertyValue('--vv-offset-bottom')).toBe('');
    expect(document.documentElement.style.getPropertyValue('--shell-overlay-bottom')).toBe('');
  });
});
