import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test';
import { credentialsFor, MinifluxHttpError } from './client';

describe('credentialsFor', () => {
  it('trims a pasted token rather than sending the surrounding whitespace', () => {
    expect(credentialsFor({ auth_token: '  token-123\t' })).toEqual({
      'X-Auth-Token': 'token-123',
    });
  });

  // Regression: a token carrying a CJK or zero-width character used to reach
  // `fetch()` and surface as "String contains non ISO-8859-1 code point", which
  // reads like a browser bug instead of a bad credential.
  it.each(['token​123', '權杖', 'token’s'])(
    'rejects the non-Latin-1 token %j with an actionable error',
    (token) => {
      expect(() => credentialsFor({ auth_token: token })).toThrow(MinifluxHttpError);
      expect(() => credentialsFor({ auth_token: token })).toThrow(/API token contains characters/);
    }
  );

  it('base64-encodes non-ASCII basic credentials as UTF-8', () => {
    const { Authorization } = credentialsFor({ username: 'user', password: '密碼' });
    expect(Authorization).toBe(`Basic ${btoa('user:\xe5\xaf\x86\xe7\xa2\xbc')}`);
    // The header value itself must be Latin-1, or `fetch()` refuses it.
    expect(Authorization).toMatch(/^[\x20-\x7e]+$/);
  });

  it('requires some credential', () => {
    expect(() => credentialsFor({})).toThrow(/auth_token or username\/password/);
  });
});

describe('request auth headers', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    localStorage.clear();
  });

  it('reports a stored token that cannot be sent as a header', async () => {
    localStorage.setItem(
      'minikyu:web:account',
      JSON.stringify({
        id: '1',
        username: 'tester',
        server_url: 'https://miniflux.example.com',
        auth_token: 'tok​en',
        isAdmin: false,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      })
    );
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const { request } = await import('./client');
    await expect(request('me')).rejects.toThrow(/API token contains characters/);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('request error messages', () => {
  const AUTH = { 'X-Auth-Token': 'token-123' };

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function respondWith(body: string, init: ResponseInit) {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(body, init))
    );
  }

  it("surfaces Miniflux's error_message", async () => {
    respondWith(JSON.stringify({ error_message: 'access forbidden' }), {
      status: 403,
      statusText: 'Forbidden',
    });

    const { request } = await import('./client');
    await expect(request('me', { authHeaders: AUTH })).rejects.toThrow(/access forbidden/);
  });

  // Regression: the same-origin proxy answers with {"error": ...}, not
  // Miniflux's {"error_message": ...}. Reading only the latter turned a
  // deployment with no MINIFLUX_URL set into a bare "Internal Server Error" on
  // the connect dialog, which reads like a rejected token.
  it("surfaces the proxy's error field for a misconfigured deployment", async () => {
    respondWith(JSON.stringify({ error: 'MINIFLUX_URL is not configured. Set it …' }), {
      status: 500,
      statusText: 'Internal Server Error',
    });

    const { request } = await import('./client');
    await expect(request('me', { authHeaders: AUTH })).rejects.toThrow(/MINIFLUX_URL is not/);
  });

  it('falls back to the status text when the body is not JSON', async () => {
    respondWith('<html>gateway down</html>', { status: 502, statusText: 'Bad Gateway' });

    const { request } = await import('./client');
    await expect(request('me', { authHeaders: AUTH })).rejects.toThrow(/Bad Gateway/);
  });
});
