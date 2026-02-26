/**
 * Test bridge for e2e testing via WebDriver executeScript.
 * Exposes Zustand stores on window.__TEST__ in development builds only.
 * This file should only be imported when import.meta.env.DEV is true.
 */
import { usePlayerStore } from '@/store/player-store';
import { useUIStore } from '@/store/ui-store';

declare global {
  interface Window {
    // biome-ignore lint/style/useNamingConvention: test bridge global
    __TEST__?: {
      playerStore: typeof usePlayerStore;
      uiStore: typeof useUIStore;
    };
  }
}

if (import.meta.env.DEV) {
  window.__TEST__ = {
    playerStore: usePlayerStore,
    uiStore: useUIStore,
  };
}
