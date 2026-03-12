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
    // Tailwind v4 @theme inline compiles font-sans to a static value on both
    // html and body, so we must override font-family directly on both elements.
    const fontValue = uiFontFamily ? `"${uiFontFamily}", ${FONT_FALLBACK}` : '';
    document.documentElement.style.fontFamily = fontValue;
    document.body.style.fontFamily = fontValue;
  }, [uiFontFamily]);
}
