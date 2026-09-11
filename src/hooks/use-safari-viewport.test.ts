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
  measureVisualViewportOverlap,
  useSafariViewportInsets,
} from './use-safari-viewport';

function mockVisualViewport(partial: {
  height: number;
  offsetTop: number;
  innerHeight: number;
}) {
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

describe('measureVisualViewportOverlap', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
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
  });
});
