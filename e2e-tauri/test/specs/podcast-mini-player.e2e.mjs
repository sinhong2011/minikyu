/**
 * Podcast Mini Player E2E Tests
 *
 * Tests the mini player bar (PodcastMiniPlayer.tsx) which appears at the bottom
 * of the window when an episode is playing and the player is minimized.
 *
 * Uses the test bridge (window.__TEST__) to manipulate Zustand store state,
 * then verifies DOM updates with waitUntil for animation-safe assertions.
 *
 * NOTE: The app auto-minimizes the player when a different entry is being read
 * (EntryReading useEffect). Tests account for this by explicitly controlling
 * isMinimized state and waiting for React effects to settle.
 */

const MOCK_ENTRY = {
  id: '999',
  user_id: '1',
  feed_id: '1',
  status: 'read',
  hash: 'test-hash',
  title: 'Mini Player Test Episode',
  url: 'https://example.com/episode',
  comments_url: '',
  published_at: '2026-01-01T00:00:00Z',
  created_at: '2026-01-01T00:00:00Z',
  changed_at: '2026-01-01T00:00:00Z',
  content: '<p>Test</p>',
  author: 'Author',
  share_code: '',
  starred: false,
  reading_time: 0,
  enclosures: [],
  tags: null,
  feed: {
    id: '1',
    user_id: '1',
    feed_url: 'https://example.com/feed.xml',
    site_url: 'https://example.com',
    title: 'Test Feed',
    checked_at: '2026-01-01T00:00:00Z',
    next_check_at: '2026-01-01T00:00:00Z',
    etag_header: '',
    last_modified_header: '',
    parsing_error_message: '',
    parsing_error_count: 0,
    scraper_rules: '',
    rewrite_rules: '',
    crawler: false,
    blocklist_rules: '',
    keeplist_rules: '',
    urlrewrite_rules: '',
    user_agent: '',
    cookie: '',
    username: '',
    password: '',
    disabled: false,
    no_media_player: false,
    ignore_http_cache: false,
    allow_self_signed_certificates: false,
    fetch_via_proxy: false,
    hide_globally: false,
    apprise_service_urls: '',
    disable_http2: false,
    description: '',
    category: { id: '1', title: 'Podcasts', user_id: '1', hide_globally: false },
    icon: null,
  },
};

const MOCK_ENCLOSURE = {
  id: '100',
  user_id: '1',
  entry_id: '999',
  url: 'https://example.com/episode.mp3',
  mime_type: 'audio/mpeg',
  size: '50000000',
  length: '3600',
};

async function waitForTestBridge() {
  await browser.waitUntil(
    async () => browser.execute(() => window.__TEST__ != null),
    { timeout: 5000 },
  );
}

async function resetPlayerStore() {
  await browser.execute(() => {
    window.__TEST__.playerStore.getState().dismiss();
  });
  // Wait for AnimatePresence exit animation to complete
  await browser.waitUntil(
    async () => !(await $('[data-testid="podcast-mini-player"]').isExisting()),
    { timeout: 2000, interval: 100 },
  ).catch(() => {});
}

/** Play and minimize to show mini player, then wait for DOM */
async function showMiniPlayer() {
  await browser.execute((entry, enclosure) => {
    const store = window.__TEST__.playerStore.getState();
    store.play(entry, enclosure);
  }, MOCK_ENTRY, MOCK_ENCLOSURE);

  // Wait for React effects to settle, then explicitly minimize
  await browser.pause(200);

  await browser.execute(() => {
    window.__TEST__.playerStore.getState().setMinimized(true);
  });

  await browser.waitUntil(
    async () => $('[data-testid="podcast-mini-player"]').isExisting(),
    { timeout: 3000, interval: 100, timeoutMsg: 'Mini player did not appear' },
  );
}

describe('Podcast Mini Player', () => {
  before(async () => {
    await waitForTestBridge();
  });

  afterEach(async () => {
    await resetPlayerStore();
  });

  describe('Visibility', () => {
    it('should NOT show mini player when no episode is playing', async () => {
      const miniPlayer = await $('[data-testid="podcast-mini-player"]');
      expect(await miniPlayer.isExisting()).toBe(false);
    });

    it('should show mini player when playing AND minimized', async () => {
      await showMiniPlayer();

      const miniPlayer = await $('[data-testid="podcast-mini-player"]');
      expect(await miniPlayer.isDisplayed()).toBe(true);
    });

    it('should hide mini player after dismiss', async () => {
      await showMiniPlayer();

      await browser.execute(() => {
        window.__TEST__.playerStore.getState().dismiss();
      });

      await browser.waitUntil(
        async () => !(await $('[data-testid="podcast-mini-player"]').isExisting()),
        { timeout: 2000, interval: 100, timeoutMsg: 'Mini player did not disappear' },
      );
    });
  });

  describe('Content', () => {
    beforeEach(async () => {
      await showMiniPlayer();
    });

    it('should display episode title', async () => {
      const navigate = await $('[data-testid="mini-player-navigate"]');
      const text = await navigate.getText();
      expect(text).toContain('Mini Player Test Episode');
    });

    it('should display feed title', async () => {
      const navigate = await $('[data-testid="mini-player-navigate"]');
      const text = await navigate.getText();
      expect(text).toContain('Test Feed');
    });

    it('should display time when duration is set', async () => {
      await browser.execute(() => {
        const store = window.__TEST__.playerStore.getState();
        store._updateDuration(3600);
        store._updateTime(600);
      });

      // Wait for React to re-render with new times
      await browser.waitUntil(
        async () => {
          const text = await $('[data-testid="mini-player-navigate"]').getText();
          return text.includes('10:00');
        },
        { timeout: 2000, interval: 100 },
      );

      const text = await $('[data-testid="mini-player-navigate"]').getText();
      expect(text).toContain('10:00');
      expect(text).toContain('1:00:00');
    });
  });

  describe('Controls', () => {
    beforeEach(async () => {
      await showMiniPlayer();
    });

    it('should have play/pause, skip forward, and dismiss buttons', async () => {
      const playPause = await $('[data-testid="mini-player-play-pause"]');
      const skipFwd = await $('[data-testid="mini-player-skip-forward"]');
      const dismiss = await $('[data-testid="mini-player-dismiss"]');

      expect(await playPause.isDisplayed()).toBe(true);
      expect(await skipFwd.isDisplayed()).toBe(true);
      expect(await dismiss.isDisplayed()).toBe(true);
    });

    it('should toggle play/pause on button click', async () => {
      let isPlaying = await browser.execute(() =>
        window.__TEST__.playerStore.getState().isPlaying,
      );
      expect(isPlaying).toBe(true);

      const btn = await $('[data-testid="mini-player-play-pause"]');
      await btn.click();

      await browser.waitUntil(
        async () => {
          return !(await browser.execute(() =>
            window.__TEST__.playerStore.getState().isPlaying,
          ));
        },
        { timeout: 2000, interval: 100 },
      );

      isPlaying = await browser.execute(() =>
        window.__TEST__.playerStore.getState().isPlaying,
      );
      expect(isPlaying).toBe(false);

      // Click again to resume
      await btn.click();

      await browser.waitUntil(
        async () => {
          return browser.execute(() =>
            window.__TEST__.playerStore.getState().isPlaying,
          );
        },
        { timeout: 2000, interval: 100 },
      );

      isPlaying = await browser.execute(() =>
        window.__TEST__.playerStore.getState().isPlaying,
      );
      expect(isPlaying).toBe(true);
    });

    it('should skip forward 30s on button click', async () => {
      await browser.execute(() => {
        const store = window.__TEST__.playerStore.getState();
        store._updateDuration(3600);
        store._updateTime(100);
      });

      const btn = await $('[data-testid="mini-player-skip-forward"]');
      await btn.click();

      await browser.waitUntil(
        async () => {
          const time = await browser.execute(() =>
            window.__TEST__.playerStore.getState().currentTime,
          );
          return time === 130;
        },
        { timeout: 2000, interval: 100 },
      );

      const time = await browser.execute(() =>
        window.__TEST__.playerStore.getState().currentTime,
      );
      expect(time).toBe(130);
    });

    it('should dismiss player on dismiss button click', async () => {
      const btn = await $('[data-testid="mini-player-dismiss"]');
      await btn.click();

      await browser.waitUntil(
        async () => !(await $('[data-testid="podcast-mini-player"]').isExisting()),
        { timeout: 2000, interval: 100 },
      );

      const hasEntry = await browser.execute(() =>
        window.__TEST__.playerStore.getState().currentEntry !== null,
      );
      expect(hasEntry).toBe(false);
    });
  });

  describe('Navigation', () => {
    it('should update UI store and un-minimize on navigate click', async () => {
      await showMiniPlayer();

      const navigate = await $('[data-testid="mini-player-navigate"]');
      await navigate.click();

      await browser.waitUntil(
        async () => {
          return !(await browser.execute(() =>
            window.__TEST__.playerStore.getState().isMinimized,
          ));
        },
        { timeout: 2000, interval: 100 },
      );

      const result = await browser.execute(() => ({
        selectedEntryId: window.__TEST__.uiStore.getState().selectedEntryId,
        isMinimized: window.__TEST__.playerStore.getState().isMinimized,
      }));

      expect(result.selectedEntryId).toBe('999');
      expect(result.isMinimized).toBe(false);
    });
  });
});
