/**
 * Capability gating for keyboard shortcuts, from the web target's point of view.
 *
 * Shortcuts backed by the Rust side used to stay live in the PWA: `t` reached
 * the translation router and `s` the summary stream, both of which throw
 * `UnsupportedInWebError` in a browser. The registry now resolves an
 * unavailable action to the empty string so `matchesShortcut` rejects every
 * event, and `AVAILABLE_SHORTCUT_ACTIONS` keeps those rows out of the
 * preferences pane.
 *
 * Tests run against the Tauri target (`__APP_TARGET__` is `'tauri'`), so the
 * capability map is mocked to what the browser actually gets.
 */

import { beforeEach, describe, expect, it, vi } from 'vite-plus/test';

vi.mock('@/lib/platform', () => ({
  capabilities: {
    downloads: false,
    translation: false,
    summaries: false,
    inAppBrowser: false,
  },
}));

import {
  AVAILABLE_SHORTCUT_ACTIONS,
  matchesShortcut,
  resolveShortcut,
  SHORTCUT_ACTIONS,
} from './shortcut-registry';

/** Minimal stand-in for the fields `matchesShortcut` reads. */
function keyEvent(key: string, modifiers: Partial<KeyboardEvent> = {}): KeyboardEvent {
  return {
    key,
    metaKey: false,
    ctrlKey: false,
    shiftKey: false,
    altKey: false,
    ...modifiers,
  } as KeyboardEvent;
}

const DESKTOP_ONLY = ['toggle-downloads', 'toggle-translation', 'summarize', 'open-app-browser'];

describe('shortcut availability on the web target', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it.each(DESKTOP_ONLY)('resolves %s to no shortcut', (actionId) => {
    expect(resolveShortcut(actionId)).toBe('');
  });

  it('ignores a user override for an unavailable action', () => {
    // Overrides may survive from a desktop-synced preferences blob; the
    // capability still wins.
    expect(resolveShortcut('summarize', { summarize: 'x' })).toBe('');
  });

  it.each(DESKTOP_ONLY)('never matches a key event for %s', (actionId) => {
    const action = SHORTCUT_ACTIONS.find((a) => a.id === actionId);
    const key = action?.defaultKey.split('+').pop() ?? '';
    const event = keyEvent(key, { metaKey: action?.defaultKey.includes('mod') });
    expect(matchesShortcut(event, resolveShortcut(actionId))).toBe(false);
  });

  it('omits desktop-only actions from the configurable list', () => {
    const ids = AVAILABLE_SHORTCUT_ACTIONS.map((a) => a.id);
    for (const actionId of DESKTOP_ONLY) expect(ids).not.toContain(actionId);
  });

  it('keeps every shortcut the browser can actually run', () => {
    const ids = AVAILABLE_SHORTCUT_ACTIONS.map((a) => a.id);
    for (const actionId of [
      'toggle-command-palette',
      'open-preferences',
      'toggle-sidebar',
      'next-article',
      'toggle-zen-mode',
      'scroll-down',
      'cycle-theme',
      'toggle-read',
      'toggle-star',
      'fetch-content',
      'open-browser',
      'copy-link',
    ]) {
      expect(ids).toContain(actionId);
    }
    expect(resolveShortcut('toggle-command-palette')).toBe('mod+k');
    expect(matchesShortcut(keyEvent('k', { metaKey: true }), 'mod+k')).toBe(true);
  });
});
