import { afterEach, describe, expect, it, vi } from 'vite-plus/test';
import { proxyToMiniflux } from './miniflux-proxy';

const WHERE = 'in the dashboard';

/** Captures the upstream request the proxy makes, answering 200 to all of them. */
function stubUpstream() {
  const fetchMock = vi.fn().mockResolvedValue(new Response('{}', { status: 200 }));
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

type FetchMock = ReturnType<typeof stubUpstream>;

/** The single upstream call the proxy is expected to have made. */
function upstreamCall(mock: FetchMock): [URL, RequestInit] {
  const call = mock.mock.calls[0];
  if (!call) throw new Error('the proxy made no upstream request');
  return call as unknown as [URL, RequestInit];
}

const upstreamUrl = (mock: FetchMock): string => upstreamCall(mock)[0].toString();

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('proxyToMiniflux configuration', () => {
  it('explains a missing MINIFLUX_URL instead of throwing', async () => {
    const response = await proxyToMiniflux(
      new Request('https://pwa.test/miniflux-api/v1/me'),
      '',
      WHERE
    );
    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toMatchObject({
      error: expect.stringContaining('MINIFLUX_URL is not configured'),
    });
  });

  // Regression: a dashboard value entered the way the connect dialog prompts
  // for it ("reader.example.com") used to fail `new URL()` and 500 every call.
  it('assumes https for a scheme-less target', async () => {
    const fetchMock = stubUpstream();
    const response = await proxyToMiniflux(
      new Request('https://pwa.test/miniflux-api/v1/me'),
      'reader.example.com',
      WHERE
    );
    expect(response.status).toBe(200);
    expect(upstreamUrl(fetchMock)).toBe('https://reader.example.com/v1/me');
  });

  it('keeps localhost on http', async () => {
    const fetchMock = stubUpstream();
    await proxyToMiniflux(
      new Request('https://pwa.test/miniflux-api/v1/me'),
      'localhost:8080',
      WHERE
    );
    expect(upstreamUrl(fetchMock)).toBe('http://localhost:8080/v1/me');
  });
});

describe('proxyToMiniflux forwarding', () => {
  it('strips the prefix and preserves the query', async () => {
    const fetchMock = stubUpstream();
    await proxyToMiniflux(
      new Request('https://pwa.test/miniflux-api/v1/entries?limit=10&status=unread'),
      'https://reader.example.com',
      WHERE
    );
    expect(upstreamUrl(fetchMock)).toBe(
      'https://reader.example.com/v1/entries?limit=10&status=unread'
    );
  });

  // Vercel matches a dynamic `api/` segment against one path segment only, so
  // its adapter rebuilds the path and hands it over explicitly.
  it('honours an explicit route override', async () => {
    const fetchMock = stubUpstream();
    await proxyToMiniflux(
      new Request('https://pwa.test/api/miniflux-api?__mfpath=v1/entries'),
      'https://reader.example.com',
      WHERE,
      { pathname: '/miniflux-api/v1/entries', search: '?limit=10' }
    );
    expect(upstreamUrl(fetchMock)).toBe('https://reader.example.com/v1/entries?limit=10');
  });

  it('drops hop-by-hop headers but keeps credentials', async () => {
    const fetchMock = stubUpstream();
    await proxyToMiniflux(
      new Request('https://pwa.test/miniflux-api/v1/me', {
        headers: { 'X-Auth-Token': 'token-123', Connection: 'keep-alive' },
      }),
      'https://reader.example.com',
      WHERE
    );
    const headers = upstreamCall(fetchMock)[1].headers as Headers;
    expect(headers.get('x-auth-token')).toBe('token-123');
    expect(headers.get('connection')).toBeNull();
    expect(headers.get('host')).toBeNull();
  });

  it('honours a base path on the target', async () => {
    const fetchMock = stubUpstream();
    await proxyToMiniflux(
      new Request('https://pwa.test/miniflux-api/v1/me'),
      'https://example.com/reader/',
      WHERE
    );
    expect(upstreamUrl(fetchMock)).toBe('https://example.com/reader/v1/me');
  });
});
