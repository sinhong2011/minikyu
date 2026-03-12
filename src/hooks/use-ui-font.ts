import { useEffect } from 'react';
import { usePreferences } from '@/services/preferences';

const FONT_FALLBACK =
  '"Figtree Variable", -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif';

/**
 * Applies the user's custom UI font preference globally via a CSS variable.
 * Sets --ui-font-override and a data attribute on <html> so CSS rules in
 * global.css can apply the font to all elements including Radix portals.
 */
export function useUiFont() {
  const { data: preferences } = usePreferences();
  const uiFontFamily = preferences?.ui_font_family;

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
}
