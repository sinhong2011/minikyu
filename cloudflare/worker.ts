/**
 * Cloudflare Worker: same-origin proxy to Miniflux, in front of the PWA.
 *
 * `wrangler.jsonc` serves `dist/` as Worker static assets and routes only
 * `/miniflux-api/*` here (`assets.run_worker_first`), so this handler exists
 * for the one hop the asset router cannot do: Cloudflare's `_redirects` cannot
 * proxy to an external origin, and no static rewrite can interpolate an
 * environment variable. The proxy itself lives in `deploy/miniflux-proxy.ts`,
 * shared with the Vercel Edge Function; only the way the runtime hands over
 * the variable differs — Cloudflare passes bindings on `env`, never
 * `process.env`.
 *
 * Set the target under Settings → Variables and secrets, as a **secret**:
 *
 *   MINIFLUX_URL = https://reader.example.com
 *
 * See `docs/developer/pwa.md` for why the hop exists at all.
 */

import { proxyToMiniflux } from '../deploy/miniflux-proxy';

const PREFIX = '/miniflux-api';

/** Minimal shape of the bindings, so this needs no @cloudflare/workers-types. */
interface Env {
  MINIFLUX_URL?: string;
  ASSETS: { fetch(request: Request): Promise<Response> };
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const { pathname } = new URL(request.url);

    if (pathname === PREFIX || pathname.startsWith(`${PREFIX}/`)) {
      return proxyToMiniflux(
        request,
        env.MINIFLUX_URL,
        'under Settings → Variables and secrets for this Worker'
      );
    }

    // Unreachable while `run_worker_first` lists only the prefix above, but it
    // keeps the Worker correct on its own terms: everything else is an asset.
    return env.ASSETS.fetch(request);
  },
};
