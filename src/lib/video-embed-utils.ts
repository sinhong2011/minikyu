const ALLOWED_VIDEO_HOSTS = new Set([
  'www.youtube.com',
  'youtube.com',
  'www.youtube-nocookie.com',
  'youtube-nocookie.com',
  'player.bilibili.com',
  'bilibili.com',
  'www.bilibili.com',
]);

/**
 * Check if an iframe src URL points to a trusted video platform.
 * Accepts https: and protocol-relative (//) URLs only.
 */
export function isAllowedVideoIframeSrc(src: string): boolean {
  if (!src) return false;

  try {
    // Protocol-relative URLs need a base to parse
    const url = new URL(src, 'https://placeholder.invalid');

    if (url.protocol !== 'https:' && url.protocol !== 'http:') {
      return false;
    }

    return ALLOWED_VIDEO_HOSTS.has(url.hostname);
  } catch {
    return false;
  }
}

/**
 * Rewrite a Bilibili iframe src to the standard embedded player URL.
 * Returns null if the src is not a Bilibili URL or has no extractable bvid.
 */
export function rewriteBilibiliSrc(src: string): string | null {
  if (!src) return null;

  try {
    const url = new URL(src, 'https://placeholder.invalid');

    if (!url.hostname.includes('bilibili')) {
      return null;
    }

    // Try bvid from query param first
    let bvid = url.searchParams.get('bvid');

    // Try extracting from path like /video/BVxxx
    if (!bvid) {
      const pathMatch = url.pathname.match(/\/video\/(BV[\w]+)/);
      bvid = pathMatch?.[1] ?? null;
    }

    if (!bvid) return null;

    return `//player.bilibili.com/player.html?isOutside=true&bvid=${bvid}&p=1&danmaku=0`;
  } catch {
    return null;
  }
}
