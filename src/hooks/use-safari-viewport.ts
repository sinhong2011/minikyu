import { useEffect, useState } from 'react';
import { isWeb } from '@/lib/platform';

const VV_BOTTOM = '--vv-offset-bottom';
const VV_TOP = '--vv-offset-top';

/**
 * How far the layout viewport extends past the visual viewport.
 *
 * iOS Safari paints its address bar and (since iOS 18) its floating tab bar
 * over the layout viewport. `position: fixed; bottom: 0` lands in that
 * overlay; the app shell is sized in `dvh` and does not. Publishing the
 * overlap as CSS variables lets fixed chrome sit on the visible bottom
 * instead of under Safari's own bars.
 */
export function measureVisualViewportOverlap(): { top: number; bottom: number } {
  const vv = window.visualViewport;
  if (!vv) return { top: 0, bottom: 0 };
  return {
    top: Math.max(0, vv.offsetTop),
    bottom: Math.max(0, window.innerHeight - vv.height - vv.offsetTop),
  };
}

export function applyVisualViewportInsets(root: HTMLElement = document.documentElement): void {
  const { top, bottom } = measureVisualViewportOverlap();
  root.style.setProperty(VV_TOP, `${top}px`);
  root.style.setProperty(VV_BOTTOM, `${bottom}px`);
}

export function clearVisualViewportInsets(root: HTMLElement = document.documentElement): void {
  root.style.removeProperty(VV_TOP);
  root.style.removeProperty(VV_BOTTOM);
}

/**
 * Keeps `--vv-offset-top` / `--vv-offset-bottom` in sync with Safari's chrome.
 * No-op in the Tauri shell, where the webview fills the window and there is
 * no overlapping UA UI.
 */
export function useSafariViewportInsets(): void {
  useEffect(() => {
    if (!isWeb) return;

    const root = document.documentElement;
    const vv = window.visualViewport;
    const update = () => applyVisualViewportInsets(root);

    update();
    vv?.addEventListener('resize', update);
    vv?.addEventListener('scroll', update);
    window.addEventListener('resize', update);
    window.addEventListener('orientationchange', update);

    return () => {
      vv?.removeEventListener('resize', update);
      vv?.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
      window.removeEventListener('orientationchange', update);
      clearVisualViewportInsets(root);
    };
  }, []);
}

/** True when the primary pointer is coarse (phones, iPad). */
export function useCoarsePointer(): boolean {
  const [coarse, setCoarse] = useState(false);

  useEffect(() => {
    const mql = window.matchMedia('(pointer: coarse)');
    const onChange = () => setCoarse(mql.matches);
    onChange();
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, []);

  return coarse;
}
