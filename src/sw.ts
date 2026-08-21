/// <reference lib="webworker" />

/**
 * Service worker for the PWA build.
 *
 * The web target is **online-only** — there is deliberately no offline data
 * sync. This worker therefore does exactly two things:
 *
 *  1. Precaches the built app shell so the PWA is installable and starts
 *     instantly on repeat visits.
 *  2. Serves navigations from the precached shell (the app is an SPA).
 *
 * Miniflux API traffic is explicitly `NetworkOnly`, so the reader can never
 * show stale feeds, entries or unread counts from a cache.
 */

import { NavigationRoute, NetworkOnly, Serwist } from 'serwist';
import type { PrecacheEntry, SerwistGlobalConfig } from 'serwist';

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope;

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  // Take over immediately so an updated shell is not stuck behind old tabs.
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: [
    {
      // Never cache Miniflux responses — no offline sync, no stale reads.
      matcher: ({ url, sameOrigin }) => sameOrigin && url.pathname.startsWith('/miniflux-api/'),
      handler: new NetworkOnly(),
    },
  ],
});

// SPA fallback: any navigation resolves to the precached shell.
serwist.registerRoute(
  new NavigationRoute(serwist.createHandlerBoundToUrl('/index.html'), {
    denylist: [/^\/miniflux-api\//],
  })
);

serwist.addEventListeners();
