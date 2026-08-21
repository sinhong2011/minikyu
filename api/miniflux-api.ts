/**
 * Vercel Edge Function: same-origin proxy to Miniflux.
 *
 * `vercel.json` rewrites `/miniflux-api/*` onto this file; the proxy itself
 * lives in `deploy/miniflux-proxy.ts`, shared with the Cloudflare Pages
 * Function. Set the target under Project Settings → Environment Variables:
 *
 *   MINIFLUX_URL = https://reader.example.com
 *
 * Why the path arrives as a query parameter rather than as a `[...path]`
 * catch-all filename: in a non-framework project Vercel matches a dynamic
 * segment in `api/` against a *single* path segment, so `/miniflux-api/v1/me`
 * 404s while `/miniflux-api/version` resolves. The rewrite therefore hands the
 * captured remainder over explicitly, and this file rebuilds the original path
 * for the shared proxy.
 *
 * See `docs/developer/pwa.md` for why the hop exists at all.
 */

import { proxyToMiniflux } from '../deploy/miniflux-proxy';

export const config = { runtime: 'edge' };

/** Query key `vercel.json` stashes the captured path in. */
const PATH_PARAM = '__mfpath';

export default async function handler(request: Request): Promise<Response> {
  // Read through `globalThis` rather than the bare `process` global: this file
  // is checked by the app tsconfig (which loads no ambient node types) as well
  // as tsconfig.tools.json, and edge runtimes expose `process.env` either way.
  const env = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process
    ?.env;

  // Vercel merges the original query string into the rewrite destination, so
  // the caller's own parameters are here too — drop only ours before forwarding.
  const incoming = new URL(request.url);
  const captured = incoming.searchParams.get(PATH_PARAM) ?? '';
  incoming.searchParams.delete(PATH_PARAM);

  return proxyToMiniflux(
    request,
    env?.MINIFLUX_URL,
    'under Project Settings → Environment Variables',
    { pathname: `/miniflux-api/${captured}`, search: incoming.search }
  );
}
