import { commands } from '@/lib/tauri-bindings';

const FONT_FALLBACK =
  '-apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, "Helvetica Neue", Arial, sans-serif';

/**
 * Loads the user's UI font and size preferences and applies them to the document.
 * Works standalone without React or TanStack Query — suitable for
 * secondary windows (player, tray popover) that don't have a query client.
 */
export async function applyUiFont() {
  try {
    const result = await commands.loadPreferences();
    if (result.status !== 'ok') return;

    const root = document.documentElement;
    const { ui_font_family: fontFamily, ui_font_size: fontSize } = result.data;

    if (fontFamily) {
      root.style.setProperty('--ui-font-override', `"${fontFamily}", ${FONT_FALLBACK}`);
      root.setAttribute('data-ui-font', '');
    }

    if (fontSize && fontSize !== 16) {
      root.style.fontSize = `${fontSize}px`;
    }
  } catch {
    // Silently ignore — font will use default
  }
}
