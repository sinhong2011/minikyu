import type * as React from 'react';
import { FeedCategoryDialogsHost } from './FeedCategoryDialogsHost';
import { MinifluxSettingsDialogProvider } from './store';

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
