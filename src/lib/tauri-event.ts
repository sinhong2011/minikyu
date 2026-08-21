/**
 * Target-safe wrappers around Tauri's event bus.
 *
 * The Rust→React bridge (`app.emit(...)` → `listen(...)`) only exists in the
 * desktop shell. In the PWA build `@tauri-apps/api/event` is present but
 * unusable — calling it throws `Cannot read properties of undefined (reading
 * 'transformCallback')` because there is no Tauri IPC to bind to.
 *
 * Import `listen`/`emit` from here rather than from `@tauri-apps/api/event`
 * directly: in the web build they become no-ops, so components that subscribe
 * to backend events simply never receive any. Because `isTauri` is a build-time
 * constant, the bundler can drop the Tauri code path from the web bundle
 * entirely.
 */

import {
  emit as tauriEmit,
  type EventCallback,
  type EventName,
  listen as tauriListen,
  type Options,
  type UnlistenFn,
} from '@tauri-apps/api/event';
import { isTauri } from './platform';

export type { EventCallback, EventName, Options, UnlistenFn };

/** Unsubscribe handle handed back when there is no event bus to detach from. */
const noopUnlisten: UnlistenFn = () => {};

/** Subscribes to a backend event. Resolves to a no-op unsubscribe on web. */
export async function listen<T>(
  event: EventName,
  handler: EventCallback<T>,
  options?: Options
): Promise<UnlistenFn> {
  if (!isTauri) return noopUnlisten;
  return tauriListen(event, handler, options);
}

/** Emits an event to the backend and other windows. No-op on web. */
export async function emit(event: string, payload?: unknown): Promise<void> {
  if (!isTauri) return;
  await tauriEmit(event, payload);
}
