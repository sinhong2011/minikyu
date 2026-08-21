# Minikyu PWA — the `web` target. See docs/developer/pwa.md.
#
# Two stages: bun builds the static site, nginx serves it *and* reverse-proxies
# /miniflux-api to your Miniflux. That proxy is not a convenience — Miniflux
# sends no CORS headers, so a browser can only reach it same-origin. A plain
# static host cannot run this app.
#
#   docker build -t minikyu-web .
#   docker run -p 8085:80 -e MINIFLUX_URL=https://reader.example.com minikyu-web
#
# MINIFLUX_URL is read at *container start*, not baked in: repointing the image
# at a different Miniflux is a restart, not a rebuild.

# ---------------------------------------------------------------------------
# Build
# ---------------------------------------------------------------------------
# Pinned to the same bun as mise.toml / netlify.toml / CI. Debian-based rather
# than alpine: the toolchain (lightningcss, rolldown, oxc) ships prebuilt glibc
# binaries and musl builds are the road less travelled.
#
# `--platform=$BUILDPLATFORM` pins this stage to the *builder's* architecture.
# The output is a pile of static files that run nowhere, so a multi-arch build
# compiles it once natively instead of running bun + vite under QEMU for every
# target — the difference between seconds and tens of minutes for linux/arm64.
FROM --platform=$BUILDPLATFORM oven/bun:1.4.0 AS build

WORKDIR /app

# Dependencies first, so editing src/ doesn't re-resolve the whole tree.
COPY package.json bun.lock ./
RUN --mount=type=cache,target=/root/.bun/install/cache \
    bun install --frozen-lockfile

COPY . .

# `build:web` = lingui extract && lingui compile && vite build --mode web.
# No env is needed: VITE_MINIFLUX_API_BASE only configures the dev/preview
# proxy, and this image's nginx owns that job in production.
RUN bun run build:web

# ---------------------------------------------------------------------------
# Runtime
# ---------------------------------------------------------------------------
# The tag is pinned to a line that still gets patches; bump it deliberately.
FROM nginx:1.29-alpine AS runtime

# The official entrypoint runs `envsubst` over /etc/nginx/templates/*.template
# into /etc/nginx/conf.d/ (overwriting the stock default.conf). The filter is
# essential: without it envsubst would also eat nginx's own $uri, $host and
# friends, since it substitutes every variable it finds in the environment.
ENV NGINX_ENVSUBST_FILTER=MINIFLUX_

# `.envsh` (not `.sh`) because the entrypoint *sources* those — the exports
# below have to reach the envsubst step that runs after it.
COPY --chmod=0755 docker/10-resolve-miniflux-url.envsh /docker-entrypoint.d/10-resolve-miniflux-url.envsh
COPY docker/default.conf.template /etc/nginx/templates/default.conf.template
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD wget --quiet --spider http://127.0.0.1/healthz || exit 1
