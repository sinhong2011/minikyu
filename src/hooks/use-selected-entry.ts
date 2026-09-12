import { useRouterState } from '@tanstack/react-router';
import { isReaderEntryEcho } from '@/lib/history-intent';

function selectedEntryFromSearch(entry: string | undefined): string | undefined {
  return isReaderEntryEcho(entry) ? undefined : entry;
}

/**
 * The open entry, read from the URL.
 *
 * `?entry=` is the single source of truth for what the reader shows: the
 * selection is a location, so it has to be linkable, survive a reload, and be
 * closable with Back. Nothing mirrors it into a store — a second copy is what
 * forced the two-way sync this replaced.
 *
 * Read through `useRouterState` rather than `useSearch({ from: '/' })` so that
 * components outside the `/` route — the app shell, the command palette — can
 * use it too.
 *
 * After swipe-back, iOS may replay the closed `?entry=`. That echo is dropped
 * here so the phone overlay never remounts for a frame.
 */
export function useSelectedEntryId(): string | undefined {
  return useRouterState({
    select: (state) =>
      selectedEntryFromSearch((state.location.search as { entry?: string }).entry),
  });
}

/**
 * Same value for imperative callers outside React, which read it at invocation
 * time the way they read the Zustand stores.
 *
 * Deliberately goes to `window.location` rather than the router instance:
 * everything that needs this is rendered inside the route tree, so importing
 * the router here would close an import cycle back through `routeTree.gen`.
 * The router runs on the browser history, so the two agree.
 */
export function getSelectedEntryId(): string | undefined {
  return selectedEntryFromSearch(
    new URLSearchParams(window.location.search).get('entry') ?? undefined
  );
}
