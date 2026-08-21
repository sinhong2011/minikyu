import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test';
import { commands, UnsupportedInWebError } from './commands';
import { normalizeIds, toNumericId } from './normalize';

const ACCOUNT_KEY = 'minikyu:web:account';

function storeAccount() {
  localStorage.setItem(
    ACCOUNT_KEY,
    JSON.stringify({
      id: '1',
      username: 'tester',
      server_url: 'https://miniflux.example.com',
      auth_token: 'token-123',
      isAdmin: false,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    })
  );
}

function mockJson(payload: unknown) {
  const fetchMock = vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    statusText: 'OK',
    json: async () => payload,
    text: async () => JSON.stringify(payload),
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

describe('web commands: disconnected state', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.stubGlobal(
      'fetch',
      vi.fn(() => {
        throw new Error('fetch must not be called while disconnected');
      })
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    localStorage.clear();
  });

  // The desktop build serves these from its local SQLite mirror, so before an
  // account exists they return empty results and the UI shows its welcome
  // state. The web build must match, or a first-time visitor is greeted with a
  // stack of error toasts.
  it('returns an empty category list instead of erroring', async () => {
    await expect(commands.getCategories()).resolves.toEqual({ status: 'ok', data: [] });
  });

  it('returns an empty feed list instead of erroring', async () => {
    await expect(commands.getFeeds()).resolves.toEqual({ status: 'ok', data: [] });
  });

  it('returns an empty entry page instead of erroring', async () => {
    await expect(commands.getEntriesList({})).resolves.toEqual({
      status: 'ok',
      data: { total: '0', entries: [] },
    });
  });

  it('returns zeroed unread counts instead of erroring', async () => {
    await expect(commands.getUnreadCounts()).resolves.toEqual({
      status: 'ok',
      data: { total: '0', today: '0', by_feed: [], by_category: [] },
    });
  });

  it('reports that it is not connected', async () => {
    await expect(commands.minifluxIsConnected()).resolves.toEqual({ status: 'ok', data: false });
  });
});

describe('web commands: connected state', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    localStorage.clear();
  });

  it('requests categories once an account is stored', async () => {
    localStorage.clear();
    storeAccount();
    const fetchMock = mockJson([{ id: 7, user_id: 1, title: 'Tech' }]);

    const result = await commands.getCategories();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    // Always same-origin: Miniflux sends no CORS headers, so the request goes
    // through the proxied prefix rather than to the stored server_url.
    expect(String(fetchMock.mock.calls[0]?.[0])).toBe('/miniflux-api/v1/categories');
    expect(result).toEqual({
      status: 'ok',
      data: [{ id: '7', user_id: '1', title: 'Tech' }],
    });
  });

  it('drops null query parameters from the entries request', async () => {
    localStorage.clear();
    storeAccount();
    const fetchMock = mockJson({ total: 0, entries: [] });

    await commands.getEntriesList({ status: 'unread', limit: '50', search: null });

    const url = String(fetchMock.mock.calls[0]?.[0]);
    expect(url).toContain('status=unread');
    expect(url).toContain('limit=50');
    expect(url).not.toContain('search');
  });
});

describe('web commands: unsupported surface', () => {
  afterEach(() => localStorage.clear());

  it('throws a named error for desktop-only commands', () => {
    expect(() => commands.getDownloadsFromDb()).toThrow(UnsupportedInWebError);
    expect(() => commands.getDownloadsFromDb()).toThrow(/getDownloadsFromDb/);
  });
});

describe('id normalization', () => {
  // Rust serialises i64 as strings and the bindings type them as `string`;
  // Miniflux sends the same ids as JSON numbers.
  it('stringifies id-shaped fields', () => {
    expect(normalizeIds({ id: 12, user_id: 3, feed_id: 9 })).toEqual({
      id: '12',
      user_id: '3',
      feed_id: '9',
    });
  });

  it('leaves genuinely numeric fields alone', () => {
    expect(normalizeIds({ id: 1, reading_time: 4, position: 2 })).toEqual({
      id: '1',
      reading_time: 4,
      position: 2,
    });
  });

  it('recurses through arrays and nested objects', () => {
    expect(normalizeIds({ entries: [{ id: 5, feed: { id: 6, title: 'x' } }] })).toEqual({
      entries: [{ id: '5', feed: { id: '6', title: 'x' } }],
    });
  });

  it('preserves ids that are already strings, and nullish values', () => {
    expect(normalizeIds({ id: '77', category_id: null })).toEqual({
      id: '77',
      category_id: null,
    });
  });

  it('rejects ids that are not numeric on the way back out', () => {
    expect(toNumericId('42')).toBe(42);
    expect(() => toNumericId('abc', 'entry id')).toThrow(/Invalid entry id/);
  });
});
