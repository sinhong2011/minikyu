/**
 * Target-safe modal dialogs.
 *
 * The desktop shell shows a native OS dialog through `@tauri-apps/plugin-dialog`,
 * which throws in the PWA build — there is no Tauri IPC behind it. Like
 * `shell.ts`, these have close-enough web equivalents, so the web build uses the
 * platform API rather than hiding the UI:
 *
 * | Action    | Tauri                        | Web               |
 * | --------- | ---------------------------- | ----------------- |
 * | `confirm` | native confirm dialog        | `window.confirm`  |
 * | `message` | native message dialog        | `window.alert`    |
 *
 * Import from here instead of the plugin directly. Because `isTauri` is a
 * build-time constant, the bundler drops the unused branch.
 *
 * The browser dialogs have no title bar of their own, so a `title` is prepended
 * to the message instead. They are also modal to the whole tab — acceptable for
 * the destructive confirmations these back, but reach for an `AlertDialog`
 * rather than this when the prompt is part of a richer flow.
 */

import { isTauri } from './platform';

export type DialogKind = 'info' | 'warning' | 'error';

export interface DialogOptions {
  /** Shown in the native title bar; prepended to the text on web. */
  title?: string;
  /** Native dialog icon. Browsers have no equivalent, so this is ignored there. */
  kind?: DialogKind;
}

/** Folds the title into the body for browsers, which cannot show one. */
function withTitle(message: string, title: string | undefined): string {
  return title ? `${title}\n\n${message}` : message;
}

/**
 * Asks the user to confirm an action.
 *
 * @returns `true` when confirmed, `false` when dismissed.
 */
export async function confirm(message: string, options?: DialogOptions): Promise<boolean> {
  if (isTauri) {
    const { confirm: tauriConfirm } = await import('@tauri-apps/plugin-dialog');
    return tauriConfirm(message, options);
  }
  return window.confirm(withTitle(message, options?.title));
}

/** Tells the user something, with only a dismiss action. */
export async function message(text: string, options?: DialogOptions): Promise<void> {
  if (isTauri) {
    const { message: tauriMessage } = await import('@tauri-apps/plugin-dialog');
    await tauriMessage(text, options);
    return;
  }
  window.alert(withTitle(text, options?.title));
}
