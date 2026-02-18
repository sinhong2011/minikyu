import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { logger } from './logger-middleware';

export type PreferencesPane =
  | 'general'
  | 'appearance'
  | 'advanced'
  | 'about'
  | 'categories'
  | 'feeds'
  | 'users'
  | 'token'
  | 'integrations';

interface UIState {
  leftSidebarVisible: boolean;
  commandPaletteOpen: boolean;
  preferencesOpen: boolean;
  preferencesActivePane: PreferencesPane;
  downloadsOpen: boolean;
  lastQuickPaneEntry: string | null;
  selectedEntryId: string | undefined;
  selectionMode: boolean;
  searchFiltersVisible: boolean;
  zenModeEnabled: boolean;
  zenModeEntryId: string | null;

  toggleLeftSidebar: () => void;
  setLeftSidebarVisible: (visible: boolean) => void;
  toggleCommandPalette: () => void;
  setCommandPaletteOpen: (open: boolean) => void;
  togglePreferences: () => void;
  setPreferencesOpen: (open: boolean) => void;
  setPreferencesActivePane: (pane: PreferencesPane) => void;
  openPreferencesToPane: (pane: PreferencesPane) => void;
  toggleDownloads: () => void;
  setDownloadsOpen: (open: boolean) => void;
  setLastQuickPaneEntry: (text: string) => void;
  setSelectedEntryId: (entryId: string | undefined) => void;
  toggleEntrySelection: (entryId: string) => void;
  setSelectionMode: (enabled: boolean) => void;
  clearSelection: () => void;
  setSearchFiltersVisible: (visible: boolean) => void;
  toggleSearchFilters: () => void;
  toggleZenMode: () => void;
  setZenModeEnabled: (enabled: boolean) => void;
  setZenModeEntryId: (entryId: string | null) => void;
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
          preferencesActivePane: 'general',
          downloadsOpen: false,
          lastQuickPaneEntry: null,
          selectedEntryId: undefined,
          selectionMode: false,
          searchFiltersVisible: false,
          zenModeEnabled: false,
          zenModeEntryId: null,

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

          setPreferencesActivePane: (pane: PreferencesPane) =>
            set({ preferencesActivePane: pane }, undefined, 'setPreferencesActivePane'),

          openPreferencesToPane: (pane: PreferencesPane) =>
            set(
              { preferencesActivePane: pane, preferencesOpen: true },
              undefined,
              'openPreferencesToPane'
            ),

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

          toggleZenMode: () =>
            set(
              (state: UIState) => ({
                zenModeEnabled: !state.zenModeEnabled,
              }),
              undefined,
              'toggleZenMode'
            ),

          setZenModeEnabled: (enabled: boolean) =>
            set({ zenModeEnabled: enabled }, undefined, 'setZenModeEnabled'),

          setZenModeEntryId: (entryId: string | null) =>
            set({ zenModeEntryId: entryId }, undefined, 'setZenModeEntryId'),
        };
      },
      {
        name: 'ui-store',
      }
    ),
    'ui-store'
  )
);
