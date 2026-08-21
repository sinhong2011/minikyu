import type * as React from 'react';
import { FeedCategoryDialogsHost } from './FeedCategoryDialogsHost';
import { MinifluxSettingsDialogProvider } from './store';

/**
 * The feed/category dialogs are imported statically on purpose.
 *
 * They were briefly code-split — `AppSidebar` mounts this provider on every
 * page, so the host pulled ~50 kB into first paint. But splitting it makes
 * "Add Feed" and the category dialogs asynchronous, and these open straight
 * from the sidebar, which is a common enough action that a blank frame is a
 * worse trade than the bytes. It also proved unreliable under CI, where the
 * lazy chunk never resolved.
 *
 * The dialogs worth deferring are the ones behind deliberate navigation —
 * Preferences and the command palette, split in MainWindow — not these.
 */
interface FeedCategoryDialogProviderProps {
  children: React.ReactNode;
}

export function FeedCategoryDialogProvider({ children }: FeedCategoryDialogProviderProps) {
  return (
    <MinifluxSettingsDialogProvider>
      {children}
      <FeedCategoryDialogsHost />
    </MinifluxSettingsDialogProvider>
  );
}
