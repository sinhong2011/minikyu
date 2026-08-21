import { logger } from '@/lib/logger';
import { isWeb } from '@/lib/platform';

/**
 * Registers the PWA service worker.
 *
 * No-ops in the Tauri build — the desktop shell serves the app from its own
 * protocol and must never have a service worker in front of it. Also no-ops in
 * dev, where the worker is not emitted and registering it only produces a
 * "script evaluation failed" error; use `bun run build:web && bun run
 * preview:web` to exercise it.
 */
export function registerServiceWorker(): void {
  if (!isWeb || !import.meta.env.PROD || !('serviceWorker' in navigator)) return;

  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch((error: unknown) => {
      logger.warn('Service worker registration failed', {
        error: error instanceof Error ? error.message : String(error),
      });
    });
  });
}
