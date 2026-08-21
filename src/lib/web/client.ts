/**
 * Minimal Miniflux REST client for the PWA build.
 *
 * The desktop build reaches Miniflux from Rust, so CORS never applies. A browser
 * does apply it, and Miniflux does not send CORS headers of its own. Two
 * supported deployments:
 *
 *  - **dev**: requests go to the same-origin `/miniflux-api` prefix, which
 *    `vite.config.ts` proxies to `VITE_MINIFLUX_API_BASE`.
 *  - **prod**: serve the PWA behind the same reverse proxy as Miniflux, or add
 *    CORS headers there. See `docs/developer/pwa.md`.
 */

import { accountStorage } from './storage';

/** Same-origin prefix that the dev proxy and the documented reverse proxy own. */
export const API_PREFIX = '/miniflux-api';

/** Raised for any non-2xx response, carrying the HTTP status for callers. */
export class MinifluxHttpError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'MinifluxHttpError';
    this.status = status;
  }
}

/**
 * Header values are Latin-1 in the Fetch spec, so anything outside it makes
 * `fetch()` throw `String contains non ISO-8859-1 code point` before a request
 * is ever sent. An API token pasted with an IME on, or copied out of a page
 * along with a zero-width space, does exactly that — and the raw DOMException
 * reads like a browser bug rather than "your token is wrong". Miniflux tokens
 * are printable ASCII, so anything else is rejected here with a message that
 * points at the real cause.
 */
function tokenHeader(token: string): Record<string, string> {
  const trimmed = token.trim();
  if (!/^[\x21-\x7e]+$/.test(trimmed)) {
    throw new MinifluxHttpError(
      400,
      'API token contains characters that cannot be sent in a request header. ' +
        'Copy it again from Miniflux → Settings → API Keys, with no surrounding ' +
        'spaces or full-width characters.'
    );
  }
  return { 'X-Auth-Token': trimmed };
}

/**
 * `btoa()` is Latin-1 only and throws on, say, a CJK password. Miniflux decodes
 * Basic credentials as UTF-8, so encode to bytes first and base64 those.
 */
function basicHeader(username: string, password: string): Record<string, string> {
  const bytes = new TextEncoder().encode(`${username}:${password}`);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return { Authorization: `Basic ${btoa(binary)}` };
}

function authHeaders(): Record<string, string> {
  const account = accountStorage.get();
  if (!account) {
    throw new MinifluxHttpError(401, 'Not connected to a Miniflux server');
  }
  if (account.auth_token) {
    return tokenHeader(account.auth_token);
  }
  if (account.username && account.password) {
    return basicHeader(account.username, account.password);
  }
  throw new MinifluxHttpError(401, 'Stored account has no usable credentials');
}

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  /** JSON request body. */
  body?: unknown;
  /** Raw (already-serialised) body, e.g. OPML for the import endpoint. */
  rawBody?: string;
  /** Query string parameters; `null`/`undefined` values are dropped. */
  query?: Record<string, string | number | boolean | null | undefined>;
  /** Read the response as text instead of JSON (OPML export). */
  responseType?: 'json' | 'text' | 'none';
  /**
   * Auth headers to use instead of the stored account's. Only the connect flow
   * needs this, to validate credentials before persisting them.
   */
  authHeaders?: Record<string, string>;
}

/**
 * Every request is same-origin under {@link API_PREFIX}.
 *
 * Which Miniflux instance that resolves to is a deployment decision (the dev
 * proxy target, or the production reverse proxy) — never the `server_url` the
 * user typed. Sending the browser straight at an arbitrary origin would be
 * blocked by CORS, since Miniflux emits no CORS headers.
 */
function buildUrl(path: string, options: RequestOptions): string {
  const url = new URL(`${API_PREFIX}/v1/${path}`, window.location.origin);
  for (const [key, value] of Object.entries(options.query ?? {})) {
    if (value !== null && value !== undefined) {
      url.searchParams.set(key, String(value));
    }
  }
  // Keep it relative so the proxy prefix is preserved.
  return `${url.pathname}${url.search}`;
}

export async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, rawBody, responseType = 'json' } = options;

  const headers: Record<string, string> = { ...(options.authHeaders ?? authHeaders()) };
  if (body !== undefined) headers['Content-Type'] = 'application/json';

  const response = await fetch(buildUrl(path, options), {
    method,
    headers,
    body: rawBody ?? (body === undefined ? undefined : JSON.stringify(body)),
  });

  if (!response.ok) {
    // Miniflux reports errors as {"error_message": "..."}; fall back to status text.
    let message = response.statusText || `HTTP ${response.status}`;
    try {
      const payload = (await response.json()) as { error_message?: string };
      if (payload?.error_message) message = payload.error_message;
    } catch {
      // Non-JSON error body; keep the status text.
    }
    throw new MinifluxHttpError(response.status, message);
  }

  if (responseType === 'none' || response.status === 204) return undefined as T;
  if (responseType === 'text') return (await response.text()) as T;
  return (await response.json()) as T;
}

/** Builds the auth headers for a not-yet-stored account (the connect flow). */
export function credentialsFor(config: {
  auth_token?: string | null;
  username?: string | null;
  password?: string | null;
}): Record<string, string> {
  if (config.auth_token) {
    return tokenHeader(config.auth_token);
  }
  if (config.username && config.password) {
    return basicHeader(config.username, config.password);
  }
  throw new MinifluxHttpError(400, 'Either auth_token or username/password must be provided');
}
