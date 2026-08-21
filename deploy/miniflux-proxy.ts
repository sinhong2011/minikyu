/**
 * The same-origin Miniflux proxy, shared by every host that needs one in code.
 *
 * Miniflux sends no CORS headers, so the PWA never calls it cross-origin —
 * every request goes to the same-origin `/miniflux-api` prefix and the
 * deployment decides what that resolves to (see `docs/developer/pwa.md`).
 * Netlify expresses that as a generated `_redirects` rule and the Docker image
 * as an nginx `proxy_pass`; Vercel and Cloudflare Pages cannot interpolate an
 * environment variable into a static rewrite, so they run this instead:
 *
 *   api/miniflux-api.ts                → Vercel Edge Function
 *   functions/miniflux-api/[[path]].ts → Cloudflare Pages Function
 *
 * Both are thin adapters over `proxyToMiniflux`; what differs is how the
 * runtime hands over `MINIFLUX_URL`, and — on Vercel — how the request path
 * survives the rewrite (see the `route` parameter). Written against
 * web-standard `Request`/`Response`/`fetch` only, so it needs no host types.
 */

const PREFIX = '/miniflux-api';

/** Hop-by-hop headers are connection-scoped and must not be forwarded. */
const HOP_BY_HOP = new Set([
  'connection',
  'keep-alive',
  'proxy-authenticate',
  'proxy-authorization',
  'te',
  'trailer',
  'transfer-encoding',
  'upgrade',
]);

/**
 * Turns whatever is in `MINIFLUX_URL` into an absolute URL.
 *
 * Hosts are configured by hand in a dashboard, and the connect dialog prompts
 * for a bare hostname ("miniflux.example.com"), so a scheme-less value is the
 * predictable mistake — and `new URL()` rejects it. Assume https, matching
 * `resolveMinifluxApiBase()` in `vite.config.ts`.
 */
function withScheme(raw: string): string {
  if (/^https?:\/\//i.test(raw)) return raw;
  const localhost = /^(localhost|127\.0\.0\.1|\[::1\])(:|$)/i.test(raw);
  return `${localhost ? 'http' : 'https'}://${raw}`;
}

function stripHopByHop(source: Headers): Headers {
  const out = new Headers();
  source.forEach((value, key) => {
    if (!HOP_BY_HOP.has(key.toLowerCase())) out.append(key, value);
  });
  return out;
}

/**
 * Forwards `request` to `rawTarget`, stripping the `/miniflux-api` prefix.
 *
 * Misconfiguration answers 500 with an explanation rather than throwing: the
 * PWA surfaces the body, so a missing variable reads as a deployment problem
 * instead of a mysterious network error.
 *
 * @param whereToSetIt Host-specific hint naming where `MINIFLUX_URL` belongs.
 * @param route Overrides the path and query to forward, for hosts where the
 *   rewrite does not leave them on `request.url`. Vercel needs it; Cloudflare
 *   routes by file path and does not.
 */
export async function proxyToMiniflux(
  request: Request,
  rawTarget: string | undefined,
  whereToSetIt: string,
  route?: { pathname: string; search: string }
): Promise<Response> {
  const trimmed = rawTarget?.trim();
  if (!trimmed) {
    return Response.json(
      {
        error: `MINIFLUX_URL is not configured. Set it ${whereToSetIt} to the Miniflux instance this deployment should proxy to.`,
      },
      { status: 500 }
    );
  }

  let target: URL;
  try {
    target = new URL(withScheme(trimmed));
  } catch {
    return Response.json({ error: `MINIFLUX_URL is not a valid URL: ${trimmed}` }, { status: 500 });
  }

  const incoming = route ?? new URL(request.url);
  // `/miniflux-api/v1/entries` → `/v1/entries`; the prefix is ours, not Miniflux's.
  const path = incoming.pathname.startsWith(PREFIX)
    ? incoming.pathname.slice(PREFIX.length)
    : incoming.pathname;

  const upstream = new URL(
    `${target.pathname.replace(/\/+$/, '')}${path}${incoming.search}`,
    target.origin
  );

  const headers = stripHopByHop(request.headers);
  // Let fetch derive Host from the upstream URL rather than leaking ours.
  headers.delete('host');

  const response = await fetch(upstream, {
    method: request.method,
    headers,
    body: request.method === 'GET' || request.method === 'HEAD' ? undefined : request.body,
    redirect: 'manual',
    // Required by the Fetch spec whenever a streaming body is passed through.
    ...(request.body ? { duplex: 'half' } : {}),
  } as RequestInit);

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: stripHopByHop(response.headers),
  });
}
