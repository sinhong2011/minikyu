import * as React from 'react';
import { useStore } from 'zustand';
import { createStore, type StoreApi } from 'zustand/vanilla';
import type { CategoryDialogState, FeedDialogState } from './dialog-state';

interface MinifluxSettingsDialogStore {
  categoryDialogState: CategoryDialogState | null;
  feedDialogState: FeedDialogState | null;
  setCategoryDialogState: (state: CategoryDialogState | null) => void;
  setFeedDialogState: (state: FeedDialogState | null) => void;
  resetForClose: () => void;
}

type MinifluxSettingsDialogStoreApi = StoreApi<MinifluxSettingsDialogStore>;

function createMinifluxSettingsDialogStore(): MinifluxSettingsDialogStoreApi {
  return createStore<MinifluxSettingsDialogStore>((set) => ({
    categoryDialogState: null,
    feedDialogState: null,
    setCategoryDialogState: (state) => set({ categoryDialogState: state }),
    setFeedDialogState: (state) => set({ feedDialogState: state }),
    resetForClose: () =>
      set({
        categoryDialogState: null,
        feedDialogState: null,
      }),
  }));
}

const MinifluxSettingsDialogStoreContext =
  React.createContext<MinifluxSettingsDialogStoreApi | null>(null);

interface MinifluxSettingsDialogProviderProps {
  children: React.ReactNode;
}

export function MinifluxSettingsDialogProvider({ children }: MinifluxSettingsDialogProviderProps) {
  const storeRef = React.useRef<MinifluxSettingsDialogStoreApi | null>(null);

  if (storeRef.current === null) {
    storeRef.current = createMinifluxSettingsDialogStore();
  }

  return (
    <MinifluxSettingsDialogStoreContext.Provider value={storeRef.current}>
      {children}
    </MinifluxSettingsDialogStoreContext.Provider>
  );
}

interface MinifluxSettingsDialogProviderBoundaryProps {
  children: React.ReactNode;
}

export function MinifluxSettingsDialogProviderBoundary({
  children,
}: MinifluxSettingsDialogProviderBoundaryProps) {
  const store = React.useContext(MinifluxSettingsDialogStoreContext);
  if (store !== null) {
    return children;
  }

  return <MinifluxSettingsDialogProvider>{children}</MinifluxSettingsDialogProvider>;
}

function useMinifluxSettingsDialogStoreApi() {
  const store = React.useContext(MinifluxSettingsDialogStoreContext);
  if (store === null) {
    throw new Error(
      'useMinifluxSettingsDialogStore must be used within MinifluxSettingsDialogProvider'
    );
  }
  return store;
}

export function useMinifluxSettingsDialogStore<T>(
  selector: (state: MinifluxSettingsDialogStore) => T
): T {
  const store = useMinifluxSettingsDialogStoreApi();
  return useStore(store, selector);
}
