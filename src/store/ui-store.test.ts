import { beforeEach, describe, expect, it } from 'vitest';
import { useUIStore } from './ui-store';

describe('UIStore', () => {
  beforeEach(() => {
    // Reset store state before each test
    useUIStore.setState({
      leftSidebarVisible: true,
      commandPaletteOpen: false,
      preferencesOpen: false,
      preferencesActivePane: 'general',
    });
  });

  it('has correct initial state', () => {
    const state = useUIStore.getState();
    expect(state.leftSidebarVisible).toBe(true);
    expect(state.commandPaletteOpen).toBe(false);
    expect(state.preferencesOpen).toBe(false);
    expect(state.preferencesActivePane).toBe('general');
  });

  it('toggles left sidebar visibility', () => {
    const { toggleLeftSidebar } = useUIStore.getState();

    toggleLeftSidebar();
    expect(useUIStore.getState().leftSidebarVisible).toBe(false);

    toggleLeftSidebar();
    expect(useUIStore.getState().leftSidebarVisible).toBe(true);
  });

  it('sets left sidebar visibility directly', () => {
    const { setLeftSidebarVisible } = useUIStore.getState();

    setLeftSidebarVisible(false);
    expect(useUIStore.getState().leftSidebarVisible).toBe(false);

    setLeftSidebarVisible(true);
    expect(useUIStore.getState().leftSidebarVisible).toBe(true);
  });

  it('toggles preferences dialog', () => {
    const { togglePreferences } = useUIStore.getState();

    togglePreferences();
    expect(useUIStore.getState().preferencesOpen).toBe(true);

    togglePreferences();
    expect(useUIStore.getState().preferencesOpen).toBe(false);
  });

  it('toggles command palette', () => {
    const { toggleCommandPalette } = useUIStore.getState();

    toggleCommandPalette();
    expect(useUIStore.getState().commandPaletteOpen).toBe(true);

    toggleCommandPalette();
    expect(useUIStore.getState().commandPaletteOpen).toBe(false);
  });

  it('sets active preferences pane', () => {
    const { setPreferencesActivePane } = useUIStore.getState();

    setPreferencesActivePane('about');
    expect(useUIStore.getState().preferencesActivePane).toBe('about');

    setPreferencesActivePane('advanced');
    expect(useUIStore.getState().preferencesActivePane).toBe('advanced');
  });
});
