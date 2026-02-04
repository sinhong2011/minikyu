import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { logger } from './logger-middleware';

interface UIState {
  leftSidebarVisible: boolean;
  commandPaletteOpen: boolean;
  preferencesOpen: boolean;
  downloadsOpen: boolean;
  lastQuickPaneEntry: string | null;
  selectedEntryId: string | undefined;
  selectionMode: boolean;
  searchFiltersVisible: boolean;

  toggleLeftSidebar: () => void;
  setLeftSidebarVisible: (visible: boolean) => void;
  toggleCommandPalette: () => void;
  setCommandPaletteOpen: (open: boolean) => void;
  togglePreferences: () => void;
  setPreferencesOpen: (open: boolean) => void;
  toggleDownloads: () => void;
  setDownloadsOpen: (open: boolean) => void;
  setLastQuickPaneEntry: (text: string) => void;
  setSelectedEntryId: (entryId: string | undefined) => void;
  toggleEntrySelection: (entryId: string) => void;
  setSelectionMode: (enabled: boolean) => void;
  clearSelection: () => void;
  setSearchFiltersVisible: (visible: boolean) => void;
  toggleSearchFilters: () => void;
}

export const useUIStore = create<UIState>()(
  logger(
    devtools(
      (set) => {
        console.log('[ui-store] creating actions, set type:', typeof set);
        return {
          leftSidebarVisible: true,
          commandPaletteOpen: false,
          preferencesOpen: false,
          downloadsOpen: false,
          lastQuickPaneEntry: null,
          selectedEntryId: undefined,
          selectionMode: false,
          searchFiltersVisible: false,

          toggleLeftSidebar: () => {
            console.log('[ui-store] toggleLeftSidebar called');
            set(
              (state: UIState) => ({
                leftSidebarVisible: !state.leftSidebarVisible,
              }),
              undefined,
              'toggleLeftSidebar'
            );
          },

          setLeftSidebarVisible: (visible: boolean) =>
            set({ leftSidebarVisible: visible }, undefined, 'setLeftSidebarVisible'),

          toggleCommandPalette: () =>
            set(
              (state: UIState) => ({
                commandPaletteOpen: !state.commandPaletteOpen,
              }),
              undefined,
              'toggleCommandPalette'
            ),

          setCommandPaletteOpen: (open: boolean) =>
            set({ commandPaletteOpen: open }, undefined, 'setCommandPaletteOpen'),

          togglePreferences: () =>
            set(
              (state: UIState) => ({ preferencesOpen: !state.preferencesOpen }),
              undefined,
              'togglePreferences'
            ),

          setPreferencesOpen: (open: boolean) =>
            set({ preferencesOpen: open }, undefined, 'setPreferencesOpen'),

          toggleDownloads: () =>
            set(
              (state: UIState) => ({
                downloadsOpen: !state.downloadsOpen,
              }),
              undefined,
              'toggleDownloads'
            ),

          setDownloadsOpen: (open: boolean) =>
            set({ downloadsOpen: open }, undefined, 'setDownloadsOpen'),

          setLastQuickPaneEntry: (text: string | null) =>
            set({ lastQuickPaneEntry: text }, undefined, 'setLastQuickPaneEntry'),

          setSelectedEntryId: (entryId: string | undefined) =>
            set({ selectedEntryId: entryId }, undefined, 'setSelectedEntryId'),

          setSearchFiltersVisible: (visible: boolean) =>
            set({ searchFiltersVisible: visible }, undefined, 'setSearchFiltersVisible'),

          toggleSearchFilters: () =>
            set(
              (state: UIState) => ({
                searchFiltersVisible: !state.searchFiltersVisible,
              }),
              undefined,
              'toggleSearchFilters'
            ),
        };
      },
      {
        name: 'ui-store',
      }
    ),
    'ui-store'
  )
);
