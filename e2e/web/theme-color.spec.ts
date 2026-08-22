/**
 * Title-bar colour of the installed PWA.
 *
 * An installed app window's title bar is painted by the browser from
 * `<meta name="theme-color">` (which overrides the manifest's `theme_color` on
 * Chromium desktop). It used to be a single hard-coded near-black, so the bar
 * sat a shade off the app's own background — visible as a seam across the top
 * of the window. `src/lib/theme-color.ts` now keeps the tag on the resolved
 * `--background` token; these tests hold it there for both schemes.
 */

import { expect, type Page, test } from '@playwright/test';

/** The tag `theme-color.ts` owns — the unconditional one that wins. */
const RUNTIME_META = 'meta[name="theme-color"][data-runtime-theme-color]';

/** The window background as sRGB bytes, straight off the rendered page. */
async function renderedBackground(page: Page): Promise<[number, number, number]> {
  return page.evaluate(() => {
    const context = document.createElement('canvas').getContext('2d');
    if (!context) throw new Error('no 2d context');
    context.fillStyle = getComputedStyle(document.body).backgroundColor;
    context.fillRect(0, 0, 1, 1);
    const [r, g, b] = context.getImageData(0, 0, 1, 1).data;
    return [r, g, b] as [number, number, number];
  });
}

function hexToRgb(hex: string): [number, number, number] {
  const match = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex);
  if (!match) throw new Error(`not a #rrggbb colour: ${hex}`);
  return [
    Number.parseInt(match[1] ?? '', 16),
    Number.parseInt(match[2] ?? '', 16),
    Number.parseInt(match[3] ?? '', 16),
  ];
}

for (const scheme of ['dark', 'light'] as const) {
  test.describe(`theme-color (${scheme})`, () => {
    test.use({ colorScheme: scheme });

    test('matches the window background', async ({ page }) => {
      await page.goto('/');

      const meta = page.locator(RUNTIME_META);
      await expect(meta).toHaveCount(1, { timeout: 15_000 });
      const content = await meta.getAttribute('content');
      expect(content, 'theme-color should be a resolved #rrggbb').toMatch(/^#[0-9a-f]{6}$/);

      const [metaR, metaG, metaB] = hexToRgb(content ?? '');
      const [bgR, bgG, bgB] = await renderedBackground(page);

      // Exact, not approximate: both sides come from the same token, so any
      // drift means the title bar stopped tracking the app background.
      expect(
        [metaR, metaG, metaB],
        'The PWA title bar colour drifted from the app background — see src/lib/theme-color.ts'
      ).toEqual([bgR, bgG, bgB]);
    });

    test('wins over the static first-paint tags', async ({ page }) => {
      await page.goto('/');
      await expect(page.locator(RUNTIME_META)).toHaveCount(1, { timeout: 15_000 });

      // The browser takes the first theme-color whose media matches, so the
      // runtime tag has to sit ahead of the media-scoped ones from index.html.
      const isFirst = await page.evaluate(
        (selector) =>
          document.head.querySelector('meta[name="theme-color"]') ===
          document.head.querySelector(selector),
        RUNTIME_META
      );
      expect(isFirst, 'runtime theme-color must be the first such tag in <head>').toBe(true);
    });
  });
}
