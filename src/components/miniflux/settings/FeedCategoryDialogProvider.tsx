import { lazy, Suspense, useRef } from 'react';
import type * as React from 'react';
import { MinifluxSettingsDialogProvider, useMinifluxSettingsDialogStore } from './store';

/**
 * The feed/category dialogs pull in tabs, forms and validation — a sizeable
 * chunk that used to land in the initial bundle, because `AppSidebar` mounts
 * this provider on every page and the host was imported statically.
 *
 * Loading it only once a dialog is actually requested keeps it out of first
 * paint. Note that `lazy()` fetches when the component *renders*, not when it
 * becomes visible, so the host must stay unmounted until then — a `<Host />`
 * rendered behind its own internal `open` check would defeat the split.
 */
const FeedCategoryDialogsHost = lazy(() =>
  import('./FeedCategoryDialogsHost').then((m) => ({ default: m.FeedCategoryDialogsHost }))
);

interface FeedCategoryDialogProviderProps {
  children: React.ReactNode;
}

function LazyDialogsHost() {
  const categoryDialogState = useMinifluxSettingsDialogStore((state) => state.categoryDialogState);
  const feedDialogState = useMinifluxSettingsDialogStore((state) => state.feedDialogState);

  // Latch: stay mounted once opened, so closing keeps dialog state and lets the
  // exit animation finish instead of unmounting mid-transition.
  const everOpened = useRef(false);
  if (categoryDialogState || feedDialogState) everOpened.current = true;
  if (!everOpened.current) return null;

  return (
    <Suspense>
      <FeedCategoryDialogsHost />
    </Suspense>
  );
}

export function FeedCategoryDialogProvider({ children }: FeedCategoryDialogProviderProps) {
  return (
    <MinifluxSettingsDialogProvider>
      {children}
      <LazyDialogsHost />
    </MinifluxSettingsDialogProvider>
  );
}
