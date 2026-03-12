import { useEffect } from 'react';
import { usePreferences, useSavePreferences } from '@/services/preferences';

const FONT_FALLBACK =
  '-apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, "Helvetica Neue", Arial, sans-serif';

const DEFAULT_UI_FONT_SIZE = 16;
const MIN_UI_FONT_SIZE = 12;
const MAX_UI_FONT_SIZE = 24;
const UI_FONT_SIZE_STEP = 1;

/**
 * Applies the user's custom UI font and size preferences globally.
 * Sets CSS variables and data attributes on <html> so CSS rules in
 * global.css can apply the font to all elements including Radix portals.
 * Also listens for zoom commands from the menu bar.
 */
export function useUiFont() {
  const { data: preferences } = usePreferences();
  const savePreferences = useSavePreferences();
  const uiFontFamily = preferences?.ui_font_family;
  const uiFontSize = preferences?.ui_font_size;

  // Apply font family
  useEffect(() => {
    const root = document.documentElement;
    if (uiFontFamily) {
      root.style.setProperty('--ui-font-override', `"${uiFontFamily}", ${FONT_FALLBACK}`);
      root.setAttribute('data-ui-font', '');
    } else {
      root.style.removeProperty('--ui-font-override');
      root.removeAttribute('data-ui-font');
    }
  }, [uiFontFamily]);

  // Apply font size
  useEffect(() => {
    const root = document.documentElement;
    if (uiFontSize && uiFontSize !== DEFAULT_UI_FONT_SIZE) {
      root.style.fontSize = `${uiFontSize}px`;
    } else {
      root.style.fontSize = '';
    }
  }, [uiFontSize]);

  // Listen for UI zoom commands from menu/shortcuts
  useEffect(() => {
    const currentSize = () => uiFontSize ?? DEFAULT_UI_FONT_SIZE;
    const clamp = (v: number) => Math.max(MIN_UI_FONT_SIZE, Math.min(MAX_UI_FONT_SIZE, v));

    const handleZoomIn = () => {
      if (!preferences) return;
      const next = clamp(currentSize() + UI_FONT_SIZE_STEP);
      // biome-ignore lint/style/useNamingConvention: preferences field name
      savePreferences.mutate({ ...preferences, ui_font_size: next });
    };
    const handleZoomOut = () => {
      if (!preferences) return;
      const next = clamp(currentSize() - UI_FONT_SIZE_STEP);
      // biome-ignore lint/style/useNamingConvention: preferences field name
      savePreferences.mutate({ ...preferences, ui_font_size: next });
    };
    const handleZoomReset = () => {
      if (!preferences) return;
      // biome-ignore lint/style/useNamingConvention: preferences field name
      savePreferences.mutate({ ...preferences, ui_font_size: null });
    };

    document.addEventListener('command:ui-zoom-in', handleZoomIn);
    document.addEventListener('command:ui-zoom-out', handleZoomOut);
    document.addEventListener('command:ui-zoom-reset', handleZoomReset);
    return () => {
      document.removeEventListener('command:ui-zoom-in', handleZoomIn);
      document.removeEventListener('command:ui-zoom-out', handleZoomOut);
      document.removeEventListener('command:ui-zoom-reset', handleZoomReset);
    };
  }, [preferences, savePreferences, uiFontSize]);
}
