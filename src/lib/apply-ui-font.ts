import { commands } from '@/lib/tauri-bindings';

const FONT_FALLBACK =
  '"Figtree Variable", -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif';

/**
 * Loads the user's UI font preference and applies it to the document.
 * Works standalone without React or TanStack Query — suitable for
 * secondary windows (player, tray popover) that don't have a query client.
 */
export async function applyUiFont() {
  try {
    const result = await commands.loadPreferences();
    if (result.status !== 'ok' || !result.data.ui_font_family) return;

    const root = document.documentElement;
    root.style.setProperty(
      '--ui-font-override',
      `"${result.data.ui_font_family}", ${FONT_FALLBACK}`
    );
    root.setAttribute('data-ui-font', '');
  } catch {
    // Silently ignore — font will use default
  }
}
