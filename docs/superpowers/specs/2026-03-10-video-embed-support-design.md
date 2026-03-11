# Video Embed Support (YouTube + Bilibili)

## Problem

Entry content from RSS feeds may contain `<iframe>` embeds for YouTube and Bilibili videos. DOMPurify currently strips all `<iframe>` tags, so video embeds never render. Users see no video content even when the feed provides it.

## Solution

Allow `<iframe>` elements from trusted video domains through DOMPurify, rewrite Bilibili iframes to use their mobile player URL, and style iframes responsively.

## Changes

### 1. DOMPurify Configuration (`sanitizeReaderHtml` in `SafeHtml.tsx`)

- Add `iframe` to `ADD_TAGS`
- Whitelist iframe-specific attributes: `src`, `allowfullscreen`, `allow`, `referrerpolicy`, `sandbox`
- Add an `afterSanitizeAttributes` hook that removes any `<iframe>` whose `src` does not match the trusted domain list

Trusted domains:
- `youtube.com`, `www.youtube.com`
- `youtube-nocookie.com`, `www.youtube-nocookie.com`
- `player.bilibili.com`, `bilibili.com`, `www.bilibili.com`

The hook parses the `src` as a URL and checks the hostname against the allowlist. Any iframe with a non-matching or unparseable `src` is removed.

### 2. Parser Replace Handler (iframe case in `parserOptions.replace`)

Add a handler for `domNode.name === 'iframe'` in the existing `html-react-parser` replace function:

- For all iframes: set `referrerpolicy="strict-origin-when-cross-origin"` and `allowFullScreen`
- For Bilibili iframes: extract `bvid` from the `src` URL and reconstruct to `//player.bilibili.com/player.html?isOutside=true&bvid={bvid}&p=1&danmaku=0`
- Return the modified `<iframe>` as a React element

### 3. CSS Styling

Add responsive iframe styles to the article content area:

```css
.article-content iframe {
  aspect-ratio: 16/9;
  width: 100%;
  height: auto;
  border: none;
  border-radius: 0.5rem;
}
```

### 4. No Changes Required

- Audio engine / player store: video uses platform-embedded players, not our audio engine
- Rust backend: no new commands or types needed
- Attachments component: video enclosures from YouTube/Bilibili feeds are thumbnails, not playable — no change needed
- Tauri CSP: iframe embeds load in webview context which already allows external URLs

## Security

- Domain whitelist enforced at DOMPurify sanitization level (before HTML reaches React)
- Only `src` attributes matching trusted video domains pass through
- `referrerpolicy="strict-origin-when-cross-origin"` prevents leaking full page URL to embed providers
- Malformed or non-HTTPS iframe sources are rejected

## Files Modified

1. `src/components/miniflux/SafeHtml.tsx` — DOMPurify config + iframe replace handler
2. CSS file for article content styling (inline or dedicated)

## Reference

NextFlux implementation: `github.com/electh/nextflux` — `ArticleView.jsx` handles iframes inline with `html-react-parser`, reconstructs Bilibili mobile player URLs from `bvid` param.
