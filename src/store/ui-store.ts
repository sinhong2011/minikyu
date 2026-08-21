import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { logger } from './logger-middleware';

export type PreferencesPane =
  | 'general'
  | 'appearance'
  | 'reader'
  | 'translation'
  | 'shortcuts'
  | 'gesture'
  | 'advanced'
  | 'about'
  | 'categories'
  | 'feeds'
  | 'users'
  | 'token'
  | 'integrations'
  | 'sync';

/** Mobile-only drill-down view inside the preferences dialog (<768px layouts). */
export type PreferencesMobileView = 'menu' | 'pane';

/**
 * Client-only UI state.
 *
 * Anything that is a *location* — the open entry, the active filter, the sort,
 * Zen Mode and the article it is showing — lives in the URL instead, via the
 * route's `validateSearch` schema. See `useSelectedEntryId` and `useZenMode`.
 */
interface UIState {
  leftSidebarVisible: boolean;
  /** Mobile-only: whether the sidebar Sheet is open (<768px layouts). */
  mobileSidebarOpen: boolean;
  commandPaletteOpen: boolean;
  preferencesOpen: boolean;
  preferencesActivePane: PreferencesPane;
  /** Mobile-only: whether the dialog shows the root menu or a pane (<768px layouts). */
  preferencesMobileView: PreferencesMobileView;
  downloadsOpen: boolean;
  downloadsCompact: boolean;
  lastQuickPaneEntry: string | null;
  selectionMode: boolean;
  searchFiltersVisible: boolean;
  inAppBrowserUrl: string | null;
  showConnectionDialog: boolean;

  toggleLeftSidebar: () => void;
  setLeftSidebarVisible: (visible: boolean) => void;
  setMobileSidebarOpen: (open: boolean) => void;
  toggleCommandPalette: () => void;
  setCommandPaletteOpen: (open: boolean) => void;
  togglePreferences: () => void;
  setPreferencesOpen: (open: boolean) => void;
  setPreferencesActivePane: (pane: PreferencesPane) => void;
  setPreferencesMobileView: (view: PreferencesMobileView) => void;
  openPreferencesToPane: (pane: PreferencesPane) => void;
  toggleDownloads: () => void;
  setDownloadsOpen: (open: boolean) => void;
  toggleDownloadsCompact: () => void;
  setLastQuickPaneEntry: (text: string) => void;
  setSelectionMode: (enabled: boolean) => void;
  setSearchFiltersVisible: (visible: boolean) => void;
  toggleSearchFilters: () => void;
  setInAppBrowserUrl: (url: string | null) => void;
  setShowConnectionDialog: (show: boolean) => void;
}

export const useUIStore = create<UIState>()(
  logger(
    devtools(
      (set) => {
        console.log('[ui-store] creating actions, set type:', typeof set);
        return {
          leftSidebarVisible: true,
          mobileSidebarOpen: false,
          commandPaletteOpen: false,
          preferencesOpen: false,
          preferencesActivePane: 'general',
          preferencesMobileView: 'menu',
          downloadsOpen: false,
          downloadsCompact: false,
          lastQuickPaneEntry: null,
          selectionMode: false,
          searchFiltersVisible: false,
          inAppBrowserUrl: null,
          showConnectionDialog: false,

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

          setMobileSidebarOpen: (open: boolean) =>
            set({ mobileSidebarOpen: open }, undefined, 'setMobileSidebarOpen'),

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
              (state: UIState) => ({
                preferencesOpen: !state.preferencesOpen,
                // A plain open always starts at the mobile root menu.
                preferencesMobileView: 'menu',
              }),
              undefined,
              'togglePreferences'
            ),

          setPreferencesOpen: (open: boolean) =>
            set(
              open
                ? { preferencesOpen: true, preferencesMobileView: 'menu' }
                : { preferencesOpen: false },
              undefined,
              'setPreferencesOpen'
            ),

          setPreferencesActivePane: (pane: PreferencesPane) =>
            set({ preferencesActivePane: pane }, undefined, 'setPreferencesActivePane'),

          setPreferencesMobileView: (view: PreferencesMobileView) =>
            set({ preferencesMobileView: view }, undefined, 'setPreferencesMobileView'),

          openPreferencesToPane: (pane: PreferencesPane) =>
            set(
              // Deep links land directly on the pane, skipping the mobile menu.
              { preferencesActivePane: pane, preferencesOpen: true, preferencesMobileView: 'pane' },
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

          toggleDownloadsCompact: () =>
            set(
              (state) => ({ downloadsCompact: !state.downloadsCompact }),
              undefined,
              'toggleDownloadsCompact'
            ),

          setLastQuickPaneEntry: (text: string | null) =>
            set({ lastQuickPaneEntry: text }, undefined, 'setLastQuickPaneEntry'),

          setSelectionMode: (enabled: boolean) =>
            set({ selectionMode: enabled }, undefined, 'setSelectionMode'),

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

          setInAppBrowserUrl: (url: string | null) =>
            set({ inAppBrowserUrl: url }, undefined, 'setInAppBrowserUrl'),

          setShowConnectionDialog: (show: boolean) =>
            set({ showConnectionDialog: show }, undefined, 'setShowConnectionDialog'),
        };
      },
      {
        name: 'ui-store',
      }
    ),
    'ui-store'
  )
);
