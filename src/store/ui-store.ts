import { create } from 'zustand';
import { devtools } from 'zustand/middleware';

interface UIState {
  leftSidebarVisible: boolean;
  commandPaletteOpen: boolean;
  preferencesOpen: boolean;
  lastQuickPaneEntry: string | null;

  toggleLeftSidebar: () => void;
  setLeftSidebarVisible: (visible: boolean) => void;
  toggleCommandPalette: () => void;
  setCommandPaletteOpen: (open: boolean) => void;
  togglePreferences: () => void;
  setPreferencesOpen: (open: boolean) => void;
  setLastQuickPaneEntry: (text: string) => void;
}

export const useUIStore = create<UIState>()(
  devtools(
    (set) => ({
      leftSidebarVisible: true,
      commandPaletteOpen: false,
      preferencesOpen: false,
      lastQuickPaneEntry: null,

      toggleLeftSidebar: () =>
        set(
          (state) => ({ leftSidebarVisible: !state.leftSidebarVisible }),
          undefined,
          'toggleLeftSidebar'
        ),

      setLeftSidebarVisible: (visible) =>
        set({ leftSidebarVisible: visible }, undefined, 'setLeftSidebarVisible'),

      toggleCommandPalette: () =>
        set(
          (state) => ({ commandPaletteOpen: !state.commandPaletteOpen }),
          undefined,
          'toggleCommandPalette'
        ),

      setCommandPaletteOpen: (open) =>
        set({ commandPaletteOpen: open }, undefined, 'setCommandPaletteOpen'),

      togglePreferences: () =>
        set(
          (state) => ({ preferencesOpen: !state.preferencesOpen }),
          undefined,
          'togglePreferences'
        ),

      setPreferencesOpen: (open) => set({ preferencesOpen: open }, undefined, 'setPreferencesOpen'),

      setLastQuickPaneEntry: (text) =>
        set({ lastQuickPaneEntry: text }, undefined, 'setLastQuickPaneEntry'),
    }),
    {
      name: 'ui-store',
    }
  )
);
