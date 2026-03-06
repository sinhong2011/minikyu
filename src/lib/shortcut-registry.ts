import { msg } from '@lingui/core/macro';
import { getPlatform } from '@/hooks/use-platform';

/**
 * Normalized shortcut format:
 *   [mod+][shift+][alt+]<key>
 *
 * Where:
 *   mod   = Cmd (macOS) / Ctrl (other)
 *   key   = lowercase letter, or KeyboardEvent.key value (Space, ArrowUp, etc.)
 *
 * Examples: "m", "shift+t", "mod+,", "alt+ArrowUp"
 */

export interface ShortcutAction {
  id: string;
  defaultKey: string;
  group: ShortcutGroup;
  label: ReturnType<typeof msg>;
}

export type ShortcutGroup = 'general' | 'navigation' | 'reading' | 'article' | 'links' | 'podcast';

export const SHORTCUT_GROUP_LABELS: Record<ShortcutGroup, ReturnType<typeof msg>> = {
  general: msg`General`,
  navigation: msg`Navigation`,
  reading: msg`Reading`,
  article: msg`Article Actions`,
  links: msg`Links`,
  podcast: msg`Podcast Playback`,
};

export const SHORTCUT_GROUP_ORDER: ShortcutGroup[] = [
  'general',
  'navigation',
  'reading',
  'article',
  'links',
  'podcast',
];

export const SHORTCUT_ACTIONS: ShortcutAction[] = [
  // General (mod+ required)
  { id: 'open-preferences', defaultKey: 'mod+,', group: 'general', label: msg`Open preferences` },
  {
    id: 'toggle-sidebar',
    defaultKey: 'mod+1',
    group: 'general',
    label: msg`Toggle left sidebar`,
  },
  { id: 'toggle-downloads', defaultKey: 'mod+d', group: 'general', label: msg`Toggle downloads` },

  // Navigation
  { id: 'next-article', defaultKey: 'j', group: 'navigation', label: msg`Next article` },
  { id: 'prev-article', defaultKey: 'k', group: 'navigation', label: msg`Previous article` },
  { id: 'go-to-top', defaultKey: 'g', group: 'navigation', label: msg`Go to top` },

  // Reading
  { id: 'scroll-down', defaultKey: 'Space', group: 'reading', label: msg`Scroll page` },
  { id: 'scroll-up', defaultKey: 'shift+Space', group: 'reading', label: msg`Scroll page up` },
  { id: 'scroll-line-down', defaultKey: 'ArrowDown', group: 'reading', label: msg`Scroll down` },
  { id: 'scroll-line-up', defaultKey: 'ArrowUp', group: 'reading', label: msg`Scroll up` },
  { id: 'increase-font', defaultKey: '=', group: 'reading', label: msg`Increase font size` },
  { id: 'decrease-font', defaultKey: '-', group: 'reading', label: msg`Decrease font size` },
  { id: 'widen-content', defaultKey: ']', group: 'reading', label: msg`Widen content` },
  { id: 'narrow-content', defaultKey: '[', group: 'reading', label: msg`Narrow content` },
  {
    id: 'increase-line-height',
    defaultKey: 'alt+ArrowUp',
    group: 'reading',
    label: msg`Increase line height`,
  },
  {
    id: 'decrease-line-height',
    defaultKey: 'alt+ArrowDown',
    group: 'reading',
    label: msg`Decrease line height`,
  },
  { id: 'cycle-theme', defaultKey: 'shift+t', group: 'reading', label: msg`Cycle reader theme` },

  // Article Actions
  { id: 'toggle-read', defaultKey: 'm', group: 'article', label: msg`Toggle read/unread` },
  { id: 'toggle-star', defaultKey: 'd', group: 'article', label: msg`Toggle star` },
  { id: 'toggle-translation', defaultKey: 't', group: 'article', label: msg`Toggle translation` },
  { id: 'summarize', defaultKey: 's', group: 'article', label: msg`Summarize article` },
  {
    id: 'fetch-content',
    defaultKey: 'f',
    group: 'article',
    label: msg`Fetch original content`,
  },

  // Links
  { id: 'open-browser', defaultKey: 'o', group: 'links', label: msg`Open in browser` },
  { id: 'open-app-browser', defaultKey: 'b', group: 'links', label: msg`Open in app browser` },
  { id: 'copy-link', defaultKey: 'c', group: 'links', label: msg`Copy link` },

  // Podcast
  { id: 'podcast-play-pause', defaultKey: 'Space', group: 'podcast', label: msg`Play / Pause` },
  { id: 'podcast-skip-back', defaultKey: 'ArrowLeft', group: 'podcast', label: msg`Skip back 15s` },
  {
    id: 'podcast-skip-forward',
    defaultKey: 'ArrowRight',
    group: 'podcast',
    label: msg`Skip forward 30s`,
  },
  { id: 'podcast-speed-down', defaultKey: '[', group: 'podcast', label: msg`Decrease speed` },
  { id: 'podcast-speed-up', defaultKey: ']', group: 'podcast', label: msg`Increase speed` },
  { id: 'podcast-mute', defaultKey: 'm', group: 'podcast', label: msg`Toggle mute` },
  {
    id: 'podcast-stop-after',
    defaultKey: 'shift+s',
    group: 'podcast',
    label: msg`Stop after current`,
  },
];

/**
 * Resolve the effective shortcut for an action, considering user overrides.
 */
export function resolveShortcut(
  actionId: string,
  overrides?: Partial<Record<string, string>>
): string {
  const override = overrides?.[actionId];
  if (override) return override;
  const action = SHORTCUT_ACTIONS.find((a) => a.id === actionId);
  return action?.defaultKey ?? '';
}

/**
 * Normalizes a key from KeyboardEvent.key for comparison.
 */
function normalizeEventKey(key: string): string {
  if (key === ' ') return 'space';
  return key.toLowerCase();
}

/**
 * Tests whether a KeyboardEvent matches a shortcut string.
 */
export function matchesShortcut(e: KeyboardEvent, shortcut: string): boolean {
  if (!shortcut) return false;

  const parts = shortcut.toLowerCase().split('+');
  const key = parts.pop();
  if (!key) return false;

  const needsMod = parts.includes('mod');
  const needsShift = parts.includes('shift');
  const needsAlt = parts.includes('alt');

  const hasMod = e.metaKey || e.ctrlKey;

  if (needsMod !== hasMod) return false;
  if (needsShift !== e.shiftKey) return false;
  if (needsAlt !== e.altKey) return false;

  return normalizeEventKey(e.key) === key;
}

/**
 * Convert a KeyboardEvent into a shortcut string for storage.
 * Returns null if only modifier keys are pressed.
 */
export function keyEventToShortcutString(e: KeyboardEvent): string | null {
  const modifierKeys = new Set(['Control', 'Shift', 'Alt', 'Meta', 'ContextMenu', 'OS']);
  if (modifierKeys.has(e.key)) return null;

  const parts: string[] = [];
  if (e.metaKey || e.ctrlKey) parts.push('mod');
  if (e.shiftKey) parts.push('shift');
  if (e.altKey) parts.push('alt');

  const key = e.key === ' ' ? 'Space' : e.key.length === 1 ? e.key.toLowerCase() : e.key;
  parts.push(key);
  return parts.join('+');
}

/**
 * Format a shortcut string for human display.
 */
export function formatShortcutDisplay(shortcut: string | undefined): string {
  if (!shortcut) return '';
  const isMac = getPlatform() === 'macos';

  return shortcut
    .split('+')
    .map((part) => {
      const lower = part.toLowerCase();
      if (lower === 'mod') return isMac ? '⌘' : 'Ctrl';
      if (lower === 'shift') return isMac ? '⇧' : 'Shift';
      if (lower === 'alt') return isMac ? '⌥' : 'Alt';
      if (lower === 'space') return '␣';
      if (lower === 'arrowup') return '↑';
      if (lower === 'arrowdown') return '↓';
      if (lower === 'arrowleft') return '←';
      if (lower === 'arrowright') return '→';
      if (lower === 'enter') return '↵';
      if (lower === 'backspace') return '⌫';
      if (lower === 'escape') return 'Esc';
      if (lower === 'tab') return '⇥';
      return part.length === 1 ? part.toUpperCase() : part;
    })
    .join(isMac ? '' : '+');
}
