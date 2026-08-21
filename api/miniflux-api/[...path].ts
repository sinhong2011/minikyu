/**
 * Vercel Edge Function: same-origin proxy to Miniflux.
 *
 * `vercel.json` rewrites `/miniflux-api/*` onto this file; the proxy itself
 * lives in `deploy/miniflux-proxy.ts`, shared with the Cloudflare Pages
 * Function. Set the target under Project Settings → Environment Variables:
 *
 *   MINIFLUX_URL = https://reader.example.com
 *
 * See `docs/developer/pwa.md` for why the hop exists at all.
 */

import { proxyToMiniflux } from '../../deploy/miniflux-proxy';

export const config = { runtime: 'edge' };

export default async function handler(request: Request): Promise<Response> {
  // Read through `globalThis` rather than the bare `process` global: this file
  // is checked by the app tsconfig (which loads no ambient node types) as well
  // as tsconfig.tools.json, and edge runtimes expose `process.env` either way.
  const env = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process
    ?.env;

  return proxyToMiniflux(
    request,
    env?.MINIFLUX_URL,
    'under Project Settings → Environment Variables'
  );
}
