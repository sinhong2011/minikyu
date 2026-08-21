/**
 * Target-safe shell actions: opening external URLs and writing to the clipboard.
 *
 * The desktop shell routes both through Tauri plugins, which are unavailable in
 * the browser. Unlike most Tauri features these have exact web equivalents, so
 * rather than hiding the UI the web build simply uses the platform API:
 *
 * | Action     | Tauri                            | Web                        |
 * | ---------- | -------------------------------- | -------------------------- |
 * | `openUrl`  | `@tauri-apps/plugin-opener`      | `window.open(..., _blank)` |
 * | `copyText` | `@tauri-apps/plugin-clipboard-…` | `navigator.clipboard`      |
 *
 * Import from here instead of the plugins directly. Because `isTauri` is a
 * build-time constant, the bundler drops the unused branch.
 */

import { writeText as tauriWriteText } from '@tauri-apps/plugin-clipboard-manager';
import { openUrl as tauriOpenUrl } from '@tauri-apps/plugin-opener';
import { isTauri } from './platform';

/** Opens a URL outside the app — the system browser, or a new tab on web. */
export async function openUrl(url: string): Promise<void> {
  if (isTauri) {
    await tauriOpenUrl(url);
    return;
  }
  // `noopener` also prevents the new tab from reaching back via `window.opener`.
  window.open(url, '_blank', 'noopener,noreferrer');
}

/** Writes plain text to the system clipboard. */
export async function copyText(text: string): Promise<void> {
  if (isTauri) {
    await tauriWriteText(text);
    return;
  }
  await navigator.clipboard.writeText(text);
}
