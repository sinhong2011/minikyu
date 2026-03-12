import { useEffect } from 'react';
import { usePreferences } from '@/services/preferences';

const FONT_FALLBACK =
  '"Figtree Variable", -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif';

/**
 * Applies the user's custom UI font preference to the document root.
 * When ui_font_family is null, removes the override so CSS default applies.
 */
export function useUiFont() {
  const { data: preferences } = usePreferences();
  const uiFontFamily = preferences?.ui_font_family;

  useEffect(() => {
    const root = document.documentElement;
    if (uiFontFamily) {
      root.style.setProperty('--font-sans', `"${uiFontFamily}", ${FONT_FALLBACK}`);
    } else {
      root.style.removeProperty('--font-sans');
    }
  }, [uiFontFamily]);
}
