import type { router as appRouter } from '@/router';

type AppRouter = typeof appRouter;

let current: AppRouter | null = null;

/**
 * Hand the router to code that has to navigate from outside React — the
 * command palette, the native menu, keyboard shortcuts.
 *
 * They cannot import `@/router` directly: that module pulls in `routeTree.gen`,
 * which reaches every screen, so the import would close a cycle back onto the
 * caller. Registering it from `main.tsx` keeps the dependency one-way — the
 * type-only import above is erased at build time.
 */
export function registerRouter(router: AppRouter): void {
  current = router;
}

export function getRouter(): AppRouter {
  if (!current) {
    throw new Error('Router used before registerRouter() ran in main.tsx');
  }
  return current;
}
