import { useEffect, useState } from 'react';
import { isWeb } from '@/lib/platform';

const VV_BOTTOM = '--vv-offset-bottom';
const VV_TOP = '--vv-offset-top';
const SHELL_OVERLAY = '--shell-overlay-bottom';

/**
 * iOS 18+ paints a floating tab bar *over* the layout viewport without
 * shrinking `100dvh` or `visualViewport`. Use this only when `100lvh` and
 * `100dvh` are still the same number — padding a shrunk `dvh` shell by this
 * amount opens a gap above Safari's own chrome.
 *
 * Do not key this off `window.innerHeight`. On current iOS, `innerHeight`
 * already matches `dvh` (the visible area). The large viewport (`lvh`) is
 * the one that still includes the floating bar.
 */
const IPHONE_SAFARI_TAB_OVERLAY_PX = 80;
const DVH_ALREADY_SHRANK_PX = 8;

function isStandaloneDisplay(): boolean {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return false;
  if (window.matchMedia?.('(display-mode: standalone)')?.matches) return true;
  if (window.matchMedia?.('(display-mode: fullscreen)')?.matches) return true;
  return Boolean((navigator as Navigator & { standalone?: boolean }).standalone);
}

export function isIPhoneSafariTab(): boolean {
  if (typeof navigator === 'undefined') return false;
  if (isStandaloneDisplay()) return false;
  return /iPhone|iPod/.test(navigator.userAgent);
}

type ViewportUnit = 'dvh' | 'lvh';

const viewportProbes: Partial<Record<ViewportUnit, HTMLDivElement>> = {};

function ensureViewportProbe(unit: ViewportUnit): HTMLDivElement | null {
  if (typeof document === 'undefined') return null;
  const existing = viewportProbes[unit];
  if (existing?.isConnected) return existing;
  const probe = document.createElement('div');
  probe.setAttribute('aria-hidden', 'true');
  probe.dataset.viewportProbe = unit;
  probe.style.cssText = `position:fixed;top:0;left:0;width:0;height:100${unit};visibility:hidden;pointer-events:none`;
  document.documentElement.appendChild(probe);
  viewportProbes[unit] = probe;
  return probe;
}

function readProbeHeight(unit: ViewportUnit): number | null {
  const probe = ensureViewportProbe(unit);
  const height = probe?.getBoundingClientRect().height ?? 0;
  return height > 0 ? height : null;
}

export function measureDvhHeight(): number {
  return readProbeHeight('dvh') ?? window.innerHeight;
}

export function measureLvhHeight(): number | null {
  return readProbeHeight('lvh');
}

export function disposeDvhProbe(): void {
  for (const probe of Object.values(viewportProbes)) {
    probe?.remove();
  }
  viewportProbes.dvh = undefined;
  viewportProbes.lvh = undefined;
}

export interface ViewportInsets {
  /** Layout-vs-visual overlap at the top (`visualViewport.offsetTop`). */
  top: number;
  /** Lift for `position: fixed` chrome, which is laid out against the layout viewport. */
  bottom: number;
  /**
   * How much of the `dvh` shell still sits under Safari. Absolute chrome
   * (`MobileTabBar`) should pad *inside* the bar by this — not shrink the shell.
   */
  shellOverlay: number;
}

function dvhAlreadyExcludedSafari(
  dvhHeight: number,
  lvhHeight: number | null,
  layout: number
): boolean {
  const vsLayout = Math.max(0, layout - dvhHeight);
  const vsLvh = lvhHeight == null ? 0 : Math.max(0, lvhHeight - dvhHeight);
  return vsLayout >= DVH_ALREADY_SHRANK_PX || vsLvh >= DVH_ALREADY_SHRANK_PX;
}

/**
 * How far Safari's chrome overlaps the layout viewport, and how much of that
 * overlap still falls inside a `100dvh` box.
 *
 * `position: fixed; bottom: 0` is the *layout* viewport. The app shell is
 * `100dvh`. Those are not the same number: on some iOS builds `dvh` already
 * excludes the floating tab bar, so padding the shell by the layout overlap
 * stacks a second gap above Safari. `--shell-overlay-bottom` is only the
 * remainder that still covers the shell.
 *
 * The 80px iPhone-tab fallback applies only when we *measured* that `lvh`
 * still equals `dvh`. `innerHeight === dvh` is the normal case on current
 * iOS — that used to fire the fallback and open the empty band above
 * `127.0.0.1`. If `lvh` cannot be measured, do not guess.
 */
export function measureViewportInsets(
  dvhHeight = measureDvhHeight(),
  lvhHeight: number | null = measureLvhHeight()
): ViewportInsets {
  const layout = window.innerHeight;
  const safariTab = isIPhoneSafariTab();
  const vv = window.visualViewport;
  const top = vv ? Math.max(0, vv.offsetTop) : 0;
  const vvBottom = vv ? Math.max(0, layout - vv.height - vv.offsetTop) : 0;
  const measuredLvh = lvhHeight != null;
  const fallback =
    safariTab && measuredLvh && !dvhAlreadyExcludedSafari(dvhHeight, lvhHeight, layout)
      ? IPHONE_SAFARI_TAB_OVERLAY_PX
      : 0;
  const dvhVsLayout = Math.max(0, layout - dvhHeight);
  const bottom = Math.max(vvBottom, vvBottom < DVH_ALREADY_SHRANK_PX ? fallback : 0);
  const overlayOnDvh = Math.max(0, vvBottom - dvhVsLayout);
  const shellOverlay = overlayOnDvh > 0 ? overlayOnDvh : fallback;

  return { top, bottom, shellOverlay };
}

/** @deprecated Use `measureViewportInsets` — kept for call sites that only need the fixed-chrome pair. */
export function measureVisualViewportOverlap(): { top: number; bottom: number } {
  const { top, bottom } = measureViewportInsets();
  return { top, bottom };
}

export function applyVisualViewportInsets(root: HTMLElement = document.documentElement): void {
  const { top, bottom, shellOverlay } = measureViewportInsets();
  root.style.setProperty(VV_TOP, `${top}px`);
  root.style.setProperty(VV_BOTTOM, `${bottom}px`);
  root.style.setProperty(SHELL_OVERLAY, `${shellOverlay}px`);
}

export function clearVisualViewportInsets(root: HTMLElement = document.documentElement): void {
  root.style.removeProperty(VV_TOP);
  root.style.removeProperty(VV_BOTTOM);
  root.style.removeProperty(SHELL_OVERLAY);
  disposeDvhProbe();
}

/**
 * Keeps `--vv-offset-*` / `--shell-overlay-bottom` in sync with Safari's chrome.
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
