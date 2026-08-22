/**
 * Sidebar unread-badge layout, in a real browser.
 *
 * Regression: with a CJK locale, `Intl.NumberFormat`'s compact notation emits
 * "18.6萬" — and a CJK ideograph is a legal line-break opportunity, unlike the
 * digits in "3824" or the "K" in "186K". The badge sat in a fixed 24px-wide
 * box, so the unit character wrapped onto a second line.
 *
 * Only a real layout engine can catch that (jsdom reports every box as 0×0),
 * so it lives here rather than in `AppSidebar.test.tsx`. The assertion is the
 * number of client rects the badge's text occupies: one rect means one line.
 *
 * Miniflux is mocked at the network boundary — the PWA talks to the
 * same-origin `/miniflux-api` prefix (see `src/lib/web/client.ts`), which makes
 * the whole sidebar drivable from fixtures with no server behind it.
 */

import { expect, type Page, test } from '@playwright/test';

const BBS = { id: 1, user_id: 1, title: 'BBS', hide_globally: false };
const YOUTUBE = { id: 2, user_id: 1, title: 'Youtube', hide_globally: false };
const CATEGORIES = [BBS, YOUTUBE];

const FEEDS = [
  {
    id: 11,
    user_id: 1,
    title: 'LINUX DO - 最新帖子',
    site_url: 'https://linux.do',
    feed_url: 'https://linux.do/latest.rss',
    category: BBS,
    hide_globally: false,
    disabled: false,
  },
  {
    id: 12,
    user_id: 1,
    title: 'V2EX',
    site_url: 'https://v2ex.com',
    feed_url: 'https://v2ex.com/index.xml',
    category: BBS,
    hide_globally: false,
    disabled: false,
  },
  {
    id: 21,
    user_id: 1,
    title: 'Some Channel',
    site_url: 'https://youtube.com',
    feed_url: 'https://youtube.com/feed.xml',
    category: YOUTUBE,
    hide_globally: false,
    disabled: false,
  },
];

/** 154000 + 32000 = 186000 unread in BBS, i.e. the "18.6萬" from the bug report. */
const UNREADS: Record<string, number> = { '11': 154_000, '12': 32_000, '21': 3 };

/** Serves the handful of endpoints the sidebar reads; everything else 404s. */
async function mockMiniflux(page: Page): Promise<void> {
  await page.route('**/miniflux-api/**', async (route) => {
    const path = new URL(route.request().url()).pathname.replace('/miniflux-api/v1/', '');
    const json = (body: unknown) => route.fulfill({ json: body });

    if (path === 'me') return json({ id: 1, username: 'tester', is_admin: true });
    if (path === 'version') return json({ version: '2.2.0' });
    if (path === 'categories') return json(CATEGORIES);
    if (path === 'feeds') return json(FEEDS);
    if (path === 'feeds/counters') return json({ reads: {}, unreads: UNREADS });
    if (path === 'entries') return json({ total: 0, entries: [] });

    const categoryFeeds = /^categories\/(\d+)\/feeds$/.exec(path);
    if (categoryFeeds) {
      const categoryId = Number(categoryFeeds[1]);
      return json(FEEDS.filter((feed) => feed.category.id === categoryId));
    }

    return route.fulfill({ status: 404, json: { error_message: `unmocked: ${path}` } });
  });
}

/** Seeds the account and locale the way a connected zh-TW user would have them. */
async function seedConnectedAccount(page: Page): Promise<void> {
  await page.addInitScript(() => {
    localStorage.setItem(
      'minikyu:web:account',
      JSON.stringify({
        id: '1',
        username: 'tester',
        isAdmin: true,
        server_url: 'https://miniflux.example.com',
        auth_token: 'test-token',
        username_password: null,
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-01T00:00:00Z',
      })
    );
    localStorage.setItem('minikyu:web:preferences', JSON.stringify({ language: 'zh-TW' }));
  });
}

/**
 * How many lines the element's text is laid out on. A `Range` over the text
 * yields one client rect per line box, which is exactly the question here.
 */
async function lineCount(page: Page, selector: string): Promise<number> {
  return page.evaluate((sel) => {
    const element = document.querySelector(sel);
    if (!element) throw new Error(`not found: ${sel}`);
    const range = document.createRange();
    range.selectNodeContents(element);
    return range.getClientRects().length;
  }, selector);
}

test.describe('sidebar unread badge', () => {
  // The phone layout swaps the sidebar for a bottom tab bar and a drawer, so
  // there is no badge row to measure there.
  test.skip(({ isMobile }) => Boolean(isMobile), 'desktop sidebar layout only');

  test.beforeEach(async ({ page }) => {
    await mockMiniflux(page);
    await seedConnectedAccount(page);
  });

  test('keeps a CJK compact count on one line', async ({ page }) => {
    await page.goto('/');

    const categoryRow = page
      .locator('[data-sidebar="menu-item"]')
      .filter({ hasText: 'BBS' })
      .first();
    const badge = categoryRow.locator('[data-slot="badge-count"]').first();

    await expect(badge).toHaveText('18.6萬', { timeout: 15_000 });

    // The bug: "18.6" and "萬" landed on separate lines inside a 24px box.
    await badge.evaluate((node) => node.setAttribute('data-badge-under-test', ''));
    expect(
      await lineCount(page, '[data-badge-under-test]'),
      'The compact unit character wrapped onto its own line — the badge needs ' +
        'whitespace-nowrap and a container that can grow past 24px.'
    ).toBe(1);

    const box = await badge.boundingBox();
    expect(box, 'badge should be laid out').toBeTruthy();
    // One 12px line box, however wide; two lines would be ~24px+.
    expect(box?.height ?? 0).toBeLessThan(20);
  });

  test('does not overlap the row title it sits beside', async ({ page }) => {
    await page.goto('/');

    const categoryRow = page
      .locator('[data-sidebar="menu-item"]')
      .filter({ hasText: 'BBS' })
      .first();
    const badge = categoryRow.locator('[data-slot="badge-count"]').first();
    await expect(badge).toHaveText('18.6萬', { timeout: 15_000 });

    // The row reserves right-hand padding for the badge; a badge that grew
    // wider than that padding would sit on top of the truncated title.
    const title = categoryRow.getByText('BBS').first();
    const [titleBox, badgeBox] = await Promise.all([title.boundingBox(), badge.boundingBox()]);
    expect(titleBox && badgeBox, 'title and badge should both be laid out').toBeTruthy();
    if (titleBox && badgeBox) {
      expect(titleBox.x + titleBox.width).toBeLessThanOrEqual(badgeBox.x);
    }
  });

  test('leaves a plain latin count alone', async ({ page }) => {
    await page.goto('/');

    const youtubeRow = page
      .locator('[data-sidebar="menu-item"]')
      .filter({ hasText: 'Youtube' })
      .first();
    const badge = youtubeRow.locator('[data-slot="badge-count"]').first();

    await expect(badge).toHaveText('3', { timeout: 15_000 });
  });
});
