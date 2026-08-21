/**
 * Cloudflare Pages Function: same-origin proxy to Miniflux.
 *
 * Cloudflare Pages routes `/miniflux-api/*` here by file path — `[[path]]` is
 * a catch-all, and Functions are matched before `_redirects` and static
 * assets, so the SPA fallback in `cloudflare/_redirects` never shadows it.
 * The proxy itself lives in `deploy/miniflux-proxy.ts`, shared with the Vercel
 * Edge Function; only the way the runtime hands over the variable differs —
 * Cloudflare passes bindings on `context.env`, never `process.env`.
 *
 * Set the target under Workers & Pages → the project → Settings → Variables:
 *
 *   MINIFLUX_URL = https://reader.example.com
 *
 * See `docs/developer/pwa.md` for why the hop exists at all.
 */

import { proxyToMiniflux } from '../../deploy/miniflux-proxy';

/** Minimal shape of the Pages context, so this needs no @cloudflare/workers-types. */
interface PagesContext {
  request: Request;
  env: Record<string, string | undefined>;
}

export async function onRequest(context: PagesContext): Promise<Response> {
  return proxyToMiniflux(
    context.request,
    context.env.MINIFLUX_URL,
    'under Settings → Variables and secrets for this Pages project'
  );
}
