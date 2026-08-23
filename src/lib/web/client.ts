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
 *
 * A third, user-chosen deployment: a Miniflux that *does* return CORS headers
 * can be called directly, at whatever URL the connect dialog was given. That is
 * the only way a hosted PWA reaches an instance its own deployment knows
 * nothing about, so the Server URL field is the user's to fill — see
 * {@link apiBaseFor} for which of the two paths a given value takes.
 */

import { accountStorage } from './storage';

/** Same-origin prefix that the dev proxy and the documented reverse proxy own. */
export const API_PREFIX = '/miniflux-api';

/**
 * `miniflux.example.com` → `https://miniflux.example.com`.
 *
 * The connect dialog prompts for a bare host, so a scheme is assumed: `http`
 * for loopback (a Miniflux on the same machine), `https` for everything else.
 * Returns `null` for anything unparseable, which callers read as "unset".
 */
export function parseServerUrl(raw: string | null | undefined): URL | null {
  const trimmed = raw?.trim();
  if (!trimmed) return null;
  const loopback = /^(localhost|127\.0\.0\.1|\[::1\])(:|\/|$)/i.test(trimmed);
  const withScheme = /^https?:\/\//i.test(trimmed)
    ? trimmed
    : `${loopback ? 'http' : 'https'}://${trimmed}`;
  try {
    return new URL(withScheme);
  } catch {
    return null;
  }
}

/**
 * Origin this build's proxy points at, if it was told one at build time. Baked
 * in by Vite, so it survives into the deployed bundle.
 */
const PROXY_TARGET_ORIGIN =
  parseServerUrl(import.meta.env.VITE_MINIFLUX_API_BASE || import.meta.env.VITE_SERVER_URL)
    ?.origin ?? null;

/**
 * Where requests for a given Server URL should go: the same-origin proxy, or
 * that URL directly.
 *
 * The proxy wins whenever it is known to reach the same instance — the value is
 * this page's own origin (the connect dialog's default), or the origin this
 * build proxies to. Those need no CORS headers, so they stay the happy path.
 *
 * Anything else is a Miniflux the deployment knows nothing about, and the only
 * way to it is a direct cross-origin call. That works **only if that instance
 * returns CORS headers for this origin** — Miniflux itself sends none, so it
 * means adding them at the reverse proxy in front of it. {@link request} says
 * as much when the call fails.
 */
export function apiBaseFor(serverUrl: string | null | undefined): string {
  const url = parseServerUrl(serverUrl);
  if (!url) return API_PREFIX;
  if (url.origin === window.location.origin) return API_PREFIX;
  if (PROXY_TARGET_ORIGIN && url.origin === PROXY_TARGET_ORIGIN) return API_PREFIX;
  return `${url.origin}${url.pathname.replace(/\/+$/, '')}`;
}

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
  /**
   * Base to send this request to instead of the stored account's. Same reason
   * as `authHeaders`: the connect flow has to reach a server that is not
   * persisted yet. Pass what {@link apiBaseFor} returned.
   */
  baseUrl?: string;
}

/** True for a base {@link apiBaseFor} resolved to a foreign origin. */
function isAbsolute(base: string): boolean {
  return /^https?:\/\//i.test(base);
}

function buildUrl(base: string, path: string, options: RequestOptions): string {
  const absolute = isAbsolute(base);
  const url = new URL(`${base}/v1/${path}`, absolute ? undefined : window.location.origin);
  for (const [key, value] of Object.entries(options.query ?? {})) {
    if (value !== null && value !== undefined) {
      url.searchParams.set(key, String(value));
    }
  }
  // A proxied request stays relative, so the prefix is preserved whatever the
  // page's own origin turns out to be.
  return absolute ? url.toString() : `${url.pathname}${url.search}`;
}

export async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, rawBody, responseType = 'json' } = options;

  const headers: Record<string, string> = { ...(options.authHeaders ?? authHeaders()) };
  if (body !== undefined) headers['Content-Type'] = 'application/json';

  const base = options.baseUrl ?? apiBaseFor(accountStorage.get()?.server_url);
  let response: Response;
  try {
    response = await fetch(buildUrl(base, path, options), {
      method,
      headers,
      body: rawBody ?? (body === undefined ? undefined : JSON.stringify(body)),
    });
  } catch (error) {
    // A cross-origin request the server does not allow fails as a bare
    // `TypeError` — the browser refuses to tell script that CORS was the
    // reason, and "Load failed" on the connect dialog reads like a typo in the
    // URL. Name the likeliest cause instead, with the fix.
    if (isAbsolute(base)) {
      const origin = new URL(base).origin;
      throw new MinifluxHttpError(
        0,
        `Could not reach ${origin}. A browser may only call a Miniflux that allows this ` +
          `site: the server has to answer with Access-Control-Allow-Origin: ` +
          `${window.location.origin} (plus Allow-Headers for X-Auth-Token / Authorization, ` +
          `and the OPTIONS preflight). Miniflux sends none of that itself, so it has to be ` +
          `added at the reverse proxy in front of it — or set the Server URL to this site ` +
          `and let its own proxy do the call.`
      );
    }
    throw error;
  }

  if (!response.ok) {
    // Two different producers answer under this prefix, with two different
    // shapes: Miniflux reports {"error_message": "..."}, while the same-origin
    // proxy in `deploy/miniflux-proxy.ts` reports its own misconfiguration as
    // {"error": "..."}. Read both. Reading only Miniflux's field turned "set
    // MINIFLUX_URL for this deployment" into a bare "Internal Server Error",
    // which on the connect dialog reads like a rejected credential.
    let message = response.statusText || `HTTP ${response.status}`;
    try {
      const payload = (await response.json()) as { error_message?: string; error?: string };
      const reported = payload?.error_message ?? payload?.error;
      if (reported) message = reported;
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
