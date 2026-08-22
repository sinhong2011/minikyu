/**
 * Keeps `<meta name="theme-color">` in step with the app's own background.
 *
 * In an installed PWA the window title bar is painted by the browser, not by
 * us, and Chromium colours it from `theme-color` — the meta tag wins over the
 * manifest's static `theme_color`, and it re-reads the tag when it changes.
 * Without this the title bar keeps the one hard-coded colour from
 * `PWA_HEAD_TAGS` while the app below it follows the light/dark theme, which is
 * the seam visible at the top of the window.
 *
 * Harmless in the Tauri build: the desktop window draws its own title bar and
 * never reads the tag.
 */

/** Set on the tag this module owns, so it is never confused with the static ones. */
const RUNTIME_MARKER = 'data-runtime-theme-color';

/**
 * Resolves a custom property to a concrete `#rrggbb`.
 *
 * The tokens are `oklch()` and `color-mix()` expressions, so the value has to
 * be run through the engine rather than parsed: a probe element resolves it,
 * and a 1×1 canvas converts whatever colour space it lands in to sRGB bytes.
 * Returns null if the property is unset or resolves to something transparent.
 */
function resolveToHex(property: string): string | null {
  const probe = document.createElement('span');
  probe.style.cssText = 'position:absolute;width:0;height:0;visibility:hidden';
  probe.style.backgroundColor = `var(${property})`;
  document.body.append(probe);
  const resolved = getComputedStyle(probe).backgroundColor;
  probe.remove();

  if (!resolved || resolved === 'transparent' || resolved === 'rgba(0, 0, 0, 0)') return null;

  const context = document.createElement('canvas').getContext('2d');
  if (!context) return null;
  context.fillStyle = resolved;
  context.fillRect(0, 0, 1, 1);
  const [r, g, b] = context.getImageData(0, 0, 1, 1).data;
  if (r === undefined || g === undefined || b === undefined) return null;

  const hex = (value: number) => value.toString(16).padStart(2, '0');
  return `#${hex(r)}${hex(g)}${hex(b)}`;
}

/**
 * Points the title bar at the colour the window actually shows.
 *
 * With a background image and transparency on, `--background` is literally
 * `transparent` and the panels are tinted with `--background-base`; that tint
 * is the closest solid match, since a title bar cannot be see-through.
 */
export function syncThemeColor(): void {
  const color = resolveToHex('--background') ?? resolveToHex('--background-base');
  if (!color) return;

  let meta = document.head.querySelector<HTMLMetaElement>(`meta[${RUNTIME_MARKER}]`);
  if (!meta) {
    meta = document.createElement('meta');
    meta.name = 'theme-color';
    meta.setAttribute(RUNTIME_MARKER, '');
    // The browser takes the first `theme-color` whose media matches, and the
    // static tags in the document head carry `prefers-color-scheme` queries.
    // Inserting ahead of them makes this unconditional tag the one that wins.
    document.head.prepend(meta);
  }

  if (meta.content !== color) meta.content = color;
}
