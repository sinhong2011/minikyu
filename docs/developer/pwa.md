# PWA (web) build

Minikyu ships two targets from one codebase:

| Target  | Command                            | What it is                                                     |
| ------- | ---------------------------------- | -------------------------------------------------------------- |
| `tauri` | `bun run tauri:dev` / `tauri:build` | The desktop shell. A Rust backend owns SQLite, the keychain, sync, translation, downloads and the extra windows. |
| `web`   | `bun run dev:web` / `build:web`     | An installable, **online-only** PWA that talks to the Miniflux REST API directly. |

The web target is deliberately narrow: it covers the core reading loop — connect,
browse categories and feeds, read entries, mark read/starred. **There is no
offline sync.** Every request goes to the network; nothing is mirrored locally.

## Architecture: one seam

All 100+ Tauri call sites import `commands` from `@/lib/tauri-bindings`. That
single specifier is the only thing that differs between targets:

```
                       @/lib/tauri-bindings
                                │
        ┌───────────────────────┴───────────────────────┐
        │                                               │
  src/lib/tauri-bindings.ts                    src/lib/web/commands.ts
  (re-exports generated bindings →             (Miniflux REST via fetch,
   Tauri invoke → Rust)                         localStorage for prefs)
```

`vite.config.ts` swaps the alias when `mode === 'web'`. No component or service
knows which target it is running on.

Keep it that way: **never import from `@/lib/bindings` directly**, and always
route new Tauri command usage through `@/lib/tauri-bindings`.

### Capability gating

Anything the Rust backend owns is unavailable in the browser. Gate the UI on
`@/lib/platform` rather than letting a call fail:

```ts
import { capabilities } from '@/lib/platform';

{capabilities.downloads && <DownloadManagerDialog />}
```

Commands not implemented by the web adapter resolve to a stub that throws
`UnsupportedInWebError` naming the command — that error means a missing gate,
not a missing feature. Currently off in the web build: downloads, podcast
window, auxiliary windows, tray, native notifications, native menu, native
window controls, in-app browser, background image, gestures, translation, AI
summaries, cloud sync, updater, offline sync, multi-account, secure credential
storage.

Two degrade rather than disappear, because the concept still means something:

- **Read commands with no account stored** (`getCategories`, `getFeeds`,
  `getEntriesList`, `getUnreadCounts`) return *empty* results instead of
  erroring. The desktop serves these from its SQLite mirror, so a fresh install
  shows an empty list and the welcome screen — not a stack of error toasts.
- **`syncMiniflux`** is a successful no-op. On desktop it fills the local
  mirror; here every query is already live, so `useSyncMiniflux`'s `onSuccess`
  invalidation *is* the sync. This matters because sync is called after every
  feed/category mutation, not just on connect.

### Responsive layout

The desktop layout is a resizable two-pane split (`entry-list` has a 380px
minimum) plus a reader. Below the 768px `useIsMobile()` breakpoint,
`MainWindowContent` switches to a **single pane**: the entry list, replaced by
the reader once an entry is opened. The reader's close button clears the
selection, so it doubles as "back". Without this the reader renders off-screen
past the right edge and tapping an entry appears to do nothing.

On phones the reader **overlays** the list rather than replacing it, so the
list keeps its mount state — closing the reader returns instantly with the
scroll position intact, instead of remounting the list and replaying its entry
animations.

The overlay carries **page semantics through the router**: the open entry is
the `?entry=` search param (validated in `src/routes/index.tsx`), so the reader
is deep-linkable, back/forward open and close it, and the URL feeds straight
into TanStack Query via `useEntry(id)`. Opening pushes one history entry per
reading session (prev/next replaces, so it doesn't stack); ✕ routes through
`history.back()` when that push exists, and a replace otherwise (deep links).
The read-status filter is `?status=unread|starred` on the same footing.

A single arbitrated effect in `MinifluxLayout` reconciles `?entry=` with the
selection store: when the URL moved (back/forward, deep link) it wins; when
only the store moved (desktop resume-last-reading, resets) it is mirrored into
the URL with a replace. The moved-side check matters — without it the two sync
directions race after a browser Back and re-add the param before the close
lands. Deliberately *not* a Dialog (wrong idiom for long-form reading) and not
a separate route (would unmount the list and fight the desktop's
selection-in-pane model).

The reader also gets a phone-only **bottom action bar** (Prev · Star · Next in
the thumb zone; the same buttons hide from the top toolbar under `sm`), and
the unread-count badge is static text — the digit-rolling animation was
removed deliberately.

On the same breakpoint the left sidebar becomes a **Sheet drawer**. Its open
state is `mobileSidebarOpen` in the UI store, passed to `SidebarProvider` as the
controlled `openMobile` prop — necessary because the titlebar toggle renders
*outside* the provider and cannot use its context. Following any nav `<Link>`
inside the drawer dismisses it (row-action buttons do not).

Primary chrome uses touch-sized targets below the breakpoint and keeps desktop
density above it (`size-10 sm:size-8` on titlebar/list-header buttons, `h-11
sm:h-8` filter segments, taller titlebar, and the ⌘K hint hidden where there is
no keyboard).

Primary navigation moves to a **bottom tab bar** (`MobileTabBar`: All · Today ·
Starred · History · More). More opens the sidebar drawer (categories, feeds,
account), and Settings sits at the top of the drawer. The bar hides while an
entry, the in-app browser pane, or zen mode is active.

Other phone-specific behaviors, each with the desktop treatment unchanged:

- **The app header is removed entirely on web phones** (`isWeb && isMobile`) —
  the list title row carries sync/refresh, the read-status **filter popover**
  (funnel icon, with an active-filter dot), sort, and search; navigation lives
  in the bottom tab bar. The Tauri build keeps the header even in narrow
  windows, since it carries the drag region and window controls.
- The desktop floating status pill does not render under 768px.
- The preferences dialog goes **full-screen** (`max-sm:` overrides on
  `DialogContent`), and its desktop-only sections (System Tray, Downloads,
  Background Image, Gestures, Sync) are capability-gated away.
- "Resume last reading" auto-select is desktop-only: phones always land on the
  list, never inside the reader.

### Target-safe shims

Three modules stand in front of Tauri APIs. Import from these, never from the
plugins directly:

| Import from            | Instead of                              | Web behaviour                    |
| ---------------------- | --------------------------------------- | -------------------------------- |
| `@/lib/tauri-event`    | `@tauri-apps/api/event`                 | `listen`/`emit` become no-ops    |
| `@/lib/shell`          | `plugin-opener`, `plugin-clipboard-manager` | `window.open` / `navigator.clipboard` |
| `@/lib/tauri-bindings` | `@/lib/bindings`                        | aliased to the REST adapter      |

The raw event API throws `Cannot read properties of undefined (reading
'transformCallback')` in a browser, because there is no Tauri IPC to bind to.
`openUrl` and `copyText` have exact web equivalents, so those features keep
working rather than being hidden.

`openPath` and `revealItemInDir` are deliberately *not* shimmed — revealing a
file in Finder has no web equivalent, so their callers are capability-gated.

### `i64` ids

Rust serialises `i64` as strings and the generated types say `string`; the
Miniflux REST API sends them as JSON **numbers**. `src/lib/web/normalize.ts`
coerces the id-shaped fields on the way in and `toNumericId()` converts back on
the way out. See the "Type-Safe i64 Serialization" section of `AGENTS.md`.

## CORS: the deployment constraint

The desktop app reaches Miniflux from Rust, so CORS never applies. A browser
does apply it, and **Miniflux sends no CORS headers**. So the web build never
calls the Miniflux origin directly. Every request goes to the same-origin path
`/miniflux-api/v1/...`, and the deployment decides what that resolves to.

A consequence worth knowing: in the web build the **"Server URL" field is
recorded for display only**. Which Miniflux instance the PWA talks to is fixed
by the proxy, not by what the user types. The API token still matters.

### Development

`vite.config.ts` proxies `/miniflux-api` for you:

```bash
VITE_MINIFLUX_API_BASE=https://reader.example.com bun run dev:web
```

Defaults to `http://localhost:8080` when unset.

### Production

Serve the built `dist/` and Miniflux behind the same origin. nginx:

```nginx
server {
  listen 443 ssl;
  server_name minikyu.example.com;

  # The PWA itself
  root /var/www/minikyu;
  location / {
    try_files $uri /index.html;
  }

  # Miniflux, same-origin — so no CORS is involved at all
  location /miniflux-api/ {
    proxy_pass https://miniflux.internal/;
    proxy_set_header Host              $host;
    proxy_set_header X-Real-IP         $remote_addr;
    proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }
}
```

Caddy:

```caddy
minikyu.example.com {
  handle_path /miniflux-api/* {
    reverse_proxy https://miniflux.internal
  }
  handle {
    root * /var/www/minikyu
    try_files {path} /index.html
    file_server
  }
}
```

Note the trailing slash on `proxy_pass` / `handle_path` — the `/miniflux-api`
prefix must be stripped before the request reaches Miniflux.

### Docker

A `Dockerfile` at the repo root builds the PWA and serves it from nginx with
the `/miniflux-api/` proxy already wired — the same config as above, generated
at container start. Every release publishes it to Docker Hub for `linux/amd64`
and `linux/arm64`:

```bash
docker run -p 8085:80 -e MINIFLUX_URL=https://reader.example.com \
  sinhong2011/minikyu-web

# …or from a checkout
docker build -t minikyu-web . && docker run -p 8085:80 \
  -e MINIFLUX_URL=https://reader.example.com minikyu-web
```

`MINIFLUX_URL` is read when the container starts, not baked into the image, so
repointing it at a different Miniflux is a restart rather than a rebuild. It is
required; the container exits with an explanation if it is missing.

| File | What it does |
| ---- | ------------ |
| `Dockerfile` | bun builds `dist/` → `nginx:alpine` serves it |
| `docker/10-resolve-miniflux-url.envsh` | Validates `MINIFLUX_URL`, derives `MINIFLUX_HOST`, strips trailing slashes |
| `docker/default.conf.template` | The nginx config, `envsubst`-ed into `/etc/nginx/conf.d/` at start |
| `docker-compose.yml` | The PWA next to a Miniflux + Postgres, for a from-scratch stack |
| `.github/workflows/docker-web.yml` | Smoke-tests the image on PRs, publishes it on tags |

Three details in there are easy to get wrong when hand-rolling this:

- **`NGINX_ENVSUBST_FILTER=MINIFLUX_`.** Without it, `envsubst` also replaces
  nginx's own `$uri`, `$host` and `$scheme` with empty strings.
- **`proxy_set_header Host ${MINIFLUX_HOST}`**, not `$host`. A hosted Miniflux
  routes on `Host`; sending the PWA's own hostname lands on the wrong vhost.
  (The nginx sample above can use `$host` only because both live on one name.)
- **`proxy_ssl_server_name on`.** nginx sends no SNI to an https upstream by
  default, which fails the TLS handshake on any shared host.
- **`add_header` does not inherit.** Declaring one inside a location silently
  drops every server-level header there, which is why cache policy is a `map`
  over `$uri` instead of a per-location header. The CSP and the other security
  headers are byte-identical to `netlify.toml` and `vercel.json`; change one and
  change all three.

The bun stage is pinned to `--platform=$BUILDPLATFORM`. Its output is static
files that run nowhere, so the multi-arch build compiles them once natively
instead of running vite under QEMU per target; only the nginx layer is
per-architecture, and it executes nothing at build time.

Alongside Miniflux on a compose network, plaintext is fine because the hop
never leaves the network:

```yaml
environment:
  MINIFLUX_URL: http://miniflux:8080
```

The image serves `/healthz` for orchestrator health checks — deliberately local,
so it stays green when Miniflux itself is down. Put TLS in front of it the way
you would any other container; the app only needs the two paths to share an
origin.

### One-click deploy (Netlify / Vercel / Cloudflare Workers)

All three hosts are wired up in-repo, and all three need exactly one variable:

```
MINIFLUX_URL = https://reader.example.com
```

They need *different* mechanisms because none of them can interpolate an
environment variable into a static rewrite rule:

| Host | Mechanism | Files |
| ---- | --------- | ----- |
| Netlify | `_redirects` generated at build time | `netlify.toml`, `scripts/write-deploy-redirects.ts` |
| Vercel | Edge function proxy | `vercel.json`, `api/miniflux-api.ts` |
| Cloudflare Workers | Worker proxy in front of static assets | `wrangler.jsonc`, `cloudflare/worker.ts`, `cloudflare/_headers` |

Vercel and Cloudflare run the *same* proxy — `deploy/miniflux-proxy.ts`, written
against web-standard `Request`/`Response`/`fetch`. Only the way the runtime
hands over `MINIFLUX_URL` differs, so the two entry points are a handful of
lines each. Keep new behaviour in the shared module, not in one adapter.

**Netlify.** `netlify.toml` runs `build:web && deploy:redirects`. The generator
writes two rules, in this order — the API proxy has to be matched before the SPA
catch-all, and `200!` forces it to win over any real file of that name:

```
/miniflux-api/*  https://reader.example.com/:splat  200!
/*               /index.html                        200
```

It refuses to run without `MINIFLUX_URL`, and rejects plaintext `http://` off
localhost, since credentials cross that hop.

`MINIFLUX_URL` may be given without a scheme (`reader.example.com`) on Netlify,
Vercel and Cloudflare — https is assumed, localhost excepted. The Docker image
is stricter and still wants the full URL.

**Vercel.** `vercel.json` rewrites `/miniflux-api/*` onto `api/miniflux-api.ts`,
an edge function that reads `MINIFLUX_URL` at request time. The function strips
the `/miniflux-api` prefix, drops hop-by-hop headers in both directions, and
passes the body through unbuffered. Changing the target is a dashboard edit, not
a rebuild.

The rewrite hands the captured path over as a query parameter
(`/api/miniflux-api?__mfpath=$1`) rather than relying on a `[...path]` catch-all
filename. In a non-framework project Vercel matches a dynamic segment in `api/`
against a **single** path segment, so a catch-all serves `/miniflux-api/version`
and 404s `/miniflux-api/v1/me` — i.e. everything the app actually calls. Vercel
merges the original query string into the destination, so the function deletes
`__mfpath` and forwards the rest.

**Cloudflare Workers.** `wrangler.jsonc` serves `dist/` as [Workers static
assets](https://developers.cloudflare.com/workers/static-assets/) and puts one
Worker (`cloudflare/worker.ts`) in front of them. It is a **Worker, not a Pages
project**, even though the site is static: the README's **Deploy to Cloudflare**
button (`https://deploy.workers.cloudflare.com/?url=<repo>`) only supports
Workers applications, and the build container behind it runs `wrangler deploy` —
which fails outright against a `pages_build_output_dir` config, since that needs
`wrangler pages deploy`. Four things differ from the other two hosts:

- The proxy is a plain `fetch` handler. Cloudflare passes bindings on the `env`
  argument, never `process.env`.
- Assets are matched before the Worker, so `assets.run_worker_first` lists
  `/miniflux-api/*` to hand exactly that prefix over. Everything else is served
  from `dist/`, with `not_found_handling: "single-page-application"` doing the
  SPA fallback that `cloudflare/_redirects` used to — hence no `_redirects`
  file here. (Cloudflare's could not have proxied `/miniflux-api/*` to an
  external origin anyway; that is why the Worker exists.)
- `cloudflare/_headers` (CSP and cache policy) is copied into `dist/` by
  `build:cf`. It is kept out of `public/` deliberately: Netlify would pick up
  the same file and end up with two sources of truth for its headers. It only
  applies to asset responses — Worker responses are on their own, which is fine
  for API JSON.
- `MINIFLUX_URL` goes under Settings → Variables and secrets and applies at
  request time — no rebuild to repoint it. Add it as a **secret**: secrets are
  preserved across deploys, while a plain-text variable that exists only in the
  dashboard can be dropped by the next `wrangler deploy`, which publishes the
  `vars` from `wrangler.jsonc` (where the value deliberately does not live).

The button pre-fills its **Deploy command** from the `deploy` script in
`package.json` — `bun run build:cf && bunx wrangler deploy` — so the web build
runs even if the auto-detected **Build command** is left at `bun run build`,
which builds the desktop target. Leaving that field empty just avoids building
twice. `MINIFLUX_URL` cannot be pre-filled the way the Vercel button pre-fills
its variable prompt, so it stays a step in that form.

To generate the redirects yourself for any Netlify-style host:

```bash
bun run build:web
MINIFLUX_URL=https://reader.example.com bun run deploy:redirects
```

## Security: credential storage

The desktop build stores Miniflux credentials in the **OS keychain**. A browser
has no equivalent, so the PWA keeps them in `localStorage`
(`src/lib/web/storage.ts`), which any script on the origin can read.

This is a real downgrade, and it is why `capabilities.secureCredentialStorage`
is `false` on web. Mitigations:

- Serve the PWA from an origin you control, with no third-party scripts.
- Prefer a scoped Miniflux **API token** over username/password, so it can be
  revoked from Miniflux Settings → API Keys without changing the password.
- Set a strict `Content-Security-Policy` at the reverse proxy.

### Content-Security-Policy

Because credentials sit in `localStorage`, the load-bearing rule is
**`connect-src 'self'`**: the web adapter only ever calls the same-origin
`/miniflux-api` proxy, so nothing legitimate needs a cross-origin request, and
an injected script has nowhere to post what it reads. `script-src 'self'` holds
because the built `index.html` carries no inline scripts — only the hashed
module bundle.

`netlify.toml` and `vercel.json` both ship it. The permissive directives are
deliberate:

| Directive | Value | Why |
| --------- | ----- | --- |
| `img-src` / `media-src` | `https: http: data: blob:` | Feed content embeds images and audio from arbitrary origins |
| `style-src` | `'self' 'unsafe-inline'` | React writes `style` attributes |
| `frame-src` | YouTube + Bilibili hosts | Mirrors `ALLOWED_VIDEO_HOSTS` in `src/lib/video-embed-utils.ts` |

`frame-src` is a *second* layer — DOMPurify already strips iframes whose host is
not on that list. Keep the two in step: adding a video host to
`video-embed-utils.ts` without adding it here means the embed silently fails to
load in production but works in dev, where no CSP is applied.

## Service worker

`src/sw.ts`, built by `vite-plugin-serwist`. Because there is no offline sync,
it does exactly two things:

1. Precaches the built app shell, so the PWA is installable and starts instantly.
2. Serves navigations from the precached shell (the app is an SPA).

Miniflux traffic under `/miniflux-api/` is explicitly `NetworkOnly`, so the
reader can never show stale feeds, entries or counts from a cache.

The worker is **only registered in production builds** — in dev it is not
emitted, and registering it just logs a script-evaluation error. To exercise it:

```bash
bun run build:web && bun run preview:web
```

## The HTML entry

Both targets share `index.html`. In web mode a small plugin in `vite.config.ts`
adds the manifest and theme-color tags and strips the standalone React DevTools
`<script src="http://localhost:8097">` tag, which is a desktop-dev convenience
that would 404 once deployed. Sharing one entry keeps dev (`/`) and the build
output aligned — there is no second HTML file to drift.

The Tauri build keeps its four entries (`index.html`, `quick-pane.html`,
`player-window.html`, `tray-popover.html`); the web build has only one.

## Extending the web adapter

To add a command to the web build:

1. Implement it in `src/lib/web/commands.ts`, using `request()` from
   `./client.ts` and returning the bindings' `Result` shape.
2. Normalise ids with `normalizeIds` / `toNumericId`.
3. If it unlocks a feature, flip the matching flag in `src/lib/platform.ts` and
   remove the UI gate.

Types come from the generated bindings, so the adapter is checked against the
exact contract the desktop build uses — a signature mismatch is a type error.
