# Video Embed Support Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow YouTube and Bilibili video iframes to render inline in RSS entry content.

**Architecture:** Modify DOMPurify config to whitelist `<iframe>` from trusted video domains, add an iframe replace handler in the html-react-parser options to normalize Bilibili URLs and set security attributes, and add responsive CSS for video iframes.

**Tech Stack:** DOMPurify, html-react-parser, Tailwind CSS

**Spec:** `docs/superpowers/specs/2026-03-10-video-embed-support-design.md`

---

## Chunk 1: Video Embed Support

### Task 1: Extract video domain utilities

**Files:**
- Create: `src/lib/video-embed-utils.ts`
- Create: `src/lib/video-embed-utils.test.ts`

This module contains the trusted domain list and Bilibili URL rewriting logic, kept separate from SafeHtml for testability.

- [ ] **Step 1: Write failing tests for domain validation and Bilibili URL rewriting**

Create `src/lib/video-embed-utils.test.ts`:

```typescript
import { describe, expect, it } from 'vitest';
import { isAllowedVideoIframeSrc, rewriteBilibiliSrc } from './video-embed-utils';

describe('isAllowedVideoIframeSrc', () => {
  it('allows youtube.com embed URLs', () => {
    expect(isAllowedVideoIframeSrc('https://www.youtube.com/embed/dQw4w9WgXcQ')).toBe(true);
  });

  it('allows youtube-nocookie.com embed URLs', () => {
    expect(isAllowedVideoIframeSrc('https://www.youtube-nocookie.com/embed/abc123')).toBe(true);
  });

  it('allows player.bilibili.com URLs', () => {
    expect(isAllowedVideoIframeSrc('https://player.bilibili.com/player.html?bvid=BV1xx411c7mD')).toBe(true);
  });

  it('allows protocol-relative bilibili URLs', () => {
    expect(isAllowedVideoIframeSrc('//player.bilibili.com/player.html?bvid=BV1xx411c7mD')).toBe(true);
  });

  it('rejects unknown domains', () => {
    expect(isAllowedVideoIframeSrc('https://evil.com/embed/video')).toBe(false);
  });

  it('rejects javascript: protocol', () => {
    expect(isAllowedVideoIframeSrc('javascript:alert(1)')).toBe(false);
  });

  it('rejects data: protocol', () => {
    expect(isAllowedVideoIframeSrc('data:text/html,<script>alert(1)</script>')).toBe(false);
  });

  it('rejects empty src', () => {
    expect(isAllowedVideoIframeSrc('')).toBe(false);
  });

  it('rejects malformed URLs', () => {
    expect(isAllowedVideoIframeSrc('not-a-url')).toBe(false);
  });
});

describe('rewriteBilibiliSrc', () => {
  it('rewrites bilibili iframe with bvid query param', () => {
    const src = 'https://www.bilibili.com/blackboard/html5mobileplayer.html?bvid=BV1xx411c7mD&p=1';
    const result = rewriteBilibiliSrc(src);
    expect(result).toBe('//player.bilibili.com/player.html?isOutside=true&bvid=BV1xx411c7mD&p=1&danmaku=0');
  });

  it('returns null for non-bilibili URLs', () => {
    expect(rewriteBilibiliSrc('https://youtube.com/embed/abc')).toBeNull();
  });

  it('returns null if no bvid found', () => {
    expect(rewriteBilibiliSrc('https://bilibili.com/some/page')).toBeNull();
  });

  it('extracts bvid from path like /video/BVxxx', () => {
    const src = 'https://www.bilibili.com/video/BV1xx411c7mD';
    const result = rewriteBilibiliSrc(src);
    expect(result).toBe('//player.bilibili.com/player.html?isOutside=true&bvid=BV1xx411c7mD&p=1&danmaku=0');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `bun run vitest run src/lib/video-embed-utils.test.ts`
Expected: FAIL — module does not exist

- [ ] **Step 3: Implement video-embed-utils**

Create `src/lib/video-embed-utils.ts`:

```typescript
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
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `bun run vitest run src/lib/video-embed-utils.test.ts`
Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/video-embed-utils.ts src/lib/video-embed-utils.test.ts
git commit -m "feat: Add video embed URL utilities for YouTube and Bilibili"
```

---

### Task 2: Update DOMPurify config to allow trusted video iframes

**Files:**
- Modify: `src/components/miniflux/SafeHtml.tsx:724-742` (`sanitizeReaderHtml` function)

The DOMPurify config needs to:
1. Add `iframe` to allowed tags
2. Whitelist iframe-specific attributes
3. Add an `afterSanitizeAttributes` hook that removes iframes with non-trusted `src`

- [ ] **Step 1: Write a failing test for sanitizeReaderHtml iframe handling**

Add to `src/components/miniflux/SafeHtml.test.tsx` (note: the existing tests mock DOMPurify, so add a **new describe block** that imports `sanitizeReaderHtml` directly and does NOT use the mock):

Create a separate test file `src/components/miniflux/sanitize-reader-html.test.ts`:

```typescript
import { describe, expect, it } from 'vitest';
import { sanitizeReaderHtml } from './SafeHtml';

describe('sanitizeReaderHtml iframe handling', () => {
  it('preserves YouTube embed iframes', () => {
    const html = '<iframe src="https://www.youtube.com/embed/dQw4w9WgXcQ"></iframe>';
    const result = sanitizeReaderHtml(html);
    expect(result).toContain('iframe');
    expect(result).toContain('youtube.com/embed/dQw4w9WgXcQ');
  });

  it('preserves youtube-nocookie.com iframes', () => {
    const html = '<iframe src="https://www.youtube-nocookie.com/embed/abc123"></iframe>';
    const result = sanitizeReaderHtml(html);
    expect(result).toContain('iframe');
    expect(result).toContain('youtube-nocookie.com');
  });

  it('preserves Bilibili player iframes', () => {
    const html = '<iframe src="https://player.bilibili.com/player.html?bvid=BV1xx"></iframe>';
    const result = sanitizeReaderHtml(html);
    expect(result).toContain('iframe');
    expect(result).toContain('bilibili.com');
  });

  it('strips iframes from untrusted domains', () => {
    const html = '<iframe src="https://evil.com/malicious"></iframe>';
    const result = sanitizeReaderHtml(html);
    expect(result).not.toContain('iframe');
    expect(result).not.toContain('evil.com');
  });

  it('strips iframes with javascript: src', () => {
    const html = '<iframe src="javascript:alert(1)"></iframe>';
    const result = sanitizeReaderHtml(html);
    expect(result).not.toContain('javascript');
  });

  it('strips iframes with no src', () => {
    const html = '<iframe></iframe>';
    const result = sanitizeReaderHtml(html);
    expect(result).not.toContain('iframe');
  });

  it('still sanitizes other HTML as before', () => {
    const html = '<script>alert(1)</script><p>Hello</p>';
    const result = sanitizeReaderHtml(html);
    expect(result).not.toContain('script');
    expect(result).toContain('<p>Hello</p>');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run vitest run src/components/miniflux/sanitize-reader-html.test.ts`
Expected: FAIL — YouTube iframe is stripped (current behavior)

- [ ] **Step 3: Update sanitizeReaderHtml in SafeHtml.tsx**

Replace the `sanitizeReaderHtml` function at line 724:

```typescript
import { isAllowedVideoIframeSrc } from '@/lib/video-embed-utils';

export function sanitizeReaderHtml(html: string): string {
  // Hook to strip iframes with untrusted src after DOMPurify allows the tag
  DOMPurify.addHook('afterSanitizeAttributes', (node) => {
    if (node.tagName === 'IFRAME') {
      const src = node.getAttribute('src') || '';
      if (!isAllowedVideoIframeSrc(src)) {
        node.remove();
      }
    }
  });

  const sanitized = DOMPurify.sanitize(html, {
    // biome-ignore lint/style/useNamingConvention: DOMPurify API requires SCREAMING_SNAKE_CASE
    USE_PROFILES: { html: true },
    // biome-ignore lint/style/useNamingConvention: DOMPurify API requires SCREAMING_SNAKE_CASE
    ADD_TAGS: ['iframe'],
    // biome-ignore lint/style/useNamingConvention: DOMPurify API requires SCREAMING_SNAKE_CASE
    ADD_ATTR: [
      'target',
      'rel',
      'data-translation-loading',
      'data-translation-retry',
      'data-translation-role',
      'data-translation-segment-id',
      'data-testid',
      // iframe attributes
      'allow',
      'allowfullscreen',
      'referrerpolicy',
      'sandbox',
    ],
    // biome-ignore lint/style/useNamingConvention: DOMPurify API requires SCREAMING_SNAKE_CASE
    FORBID_TAGS: ['center'],
  });

  DOMPurify.removeHook('afterSanitizeAttributes');

  return stripTextAlignStyles(sanitized);
}
```

Add the import for `isAllowedVideoIframeSrc` at the top of `SafeHtml.tsx`.

- [ ] **Step 4: Run test to verify it passes**

Run: `bun run vitest run src/components/miniflux/sanitize-reader-html.test.ts`
Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/miniflux/SafeHtml.tsx src/components/miniflux/sanitize-reader-html.test.ts
git commit -m "feat: Allow trusted video iframes through DOMPurify sanitizer"
```

---

### Task 3: Add iframe replace handler in html-react-parser

**Files:**
- Modify: `src/components/miniflux/SafeHtml.tsx:1465-1553` (the `parserOptions.replace` function)

Add an `iframe` handler between the existing `img` and `pre` handlers.

- [ ] **Step 1: Write a test for iframe rendering in SafeHtml component**

Add to `src/components/miniflux/SafeHtml.test.tsx` (which mocks DOMPurify as passthrough):

```typescript
describe('SafeHtml video iframe rendering', () => {
  it('renders YouTube iframe with security attributes', () => {
    const html = '<iframe src="https://www.youtube.com/embed/dQw4w9WgXcQ"></iframe>';
    const { container } = renderSafeHtml(<SafeHtml html={html} />);
    const iframe = container.querySelector('iframe');
    expect(iframe).not.toBeNull();
    expect(iframe?.getAttribute('src')).toBe('https://www.youtube.com/embed/dQw4w9WgXcQ');
    expect(iframe?.getAttribute('referrerpolicy')).toBe('strict-origin-when-cross-origin');
    expect(iframe?.hasAttribute('allowfullscreen')).toBe(true);
  });

  it('rewrites Bilibili iframe to player URL', () => {
    const html = '<iframe src="https://www.bilibili.com/blackboard/html5mobileplayer.html?bvid=BV1xx411c7mD&p=1"></iframe>';
    const { container } = renderSafeHtml(<SafeHtml html={html} />);
    const iframe = container.querySelector('iframe');
    expect(iframe).not.toBeNull();
    expect(iframe?.getAttribute('src')).toContain('player.bilibili.com');
    expect(iframe?.getAttribute('src')).toContain('bvid=BV1xx411c7mD');
  });

  it('applies responsive video wrapper class', () => {
    const html = '<iframe src="https://www.youtube.com/embed/test123"></iframe>';
    const { container } = renderSafeHtml(<SafeHtml html={html} />);
    const wrapper = container.querySelector('[data-video-embed]');
    expect(wrapper).not.toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run vitest run src/components/miniflux/SafeHtml.test.tsx`
Expected: FAIL — no iframe handler exists yet

- [ ] **Step 3: Add iframe handler in the replace function**

In `SafeHtml.tsx`, add this block after the `if (domNode.name === 'img')` block (around line 1538) and before the `if (domNode.name === 'pre')` block:

```typescript
if (domNode.name === 'iframe') {
  const src = domNode.attribs.src || '';

  // Rewrite Bilibili iframes to standard player URL
  const rewrittenSrc = rewriteBilibiliSrc(src);
  const finalSrc = rewrittenSrc ?? src;

  return (
    <div data-video-embed className="my-4 aspect-video w-full overflow-hidden rounded-lg">
      <iframe
        src={finalSrc}
        referrerPolicy="strict-origin-when-cross-origin"
        allowFullScreen
        className="h-full w-full border-none"
        title="Embedded video"
      />
    </div>
  );
}
```

Add the import for `rewriteBilibiliSrc` at the top of `SafeHtml.tsx`:

```typescript
import { rewriteBilibiliSrc } from '@/lib/video-embed-utils';
```

Note: `isAllowedVideoIframeSrc` was already imported in Task 2.

- [ ] **Step 4: Run tests to verify they pass**

Run: `bun run vitest run src/components/miniflux/SafeHtml.test.tsx`
Expected: All tests PASS (both old and new)

- [ ] **Step 5: Run full check suite**

Run: `bun run typecheck`
Expected: No type errors

- [ ] **Step 6: Commit**

```bash
git add src/components/miniflux/SafeHtml.tsx src/components/miniflux/SafeHtml.test.tsx
git commit -m "feat: Add iframe replace handler for YouTube and Bilibili video embeds"
```

---

### Task 4: Manual verification

- [ ] **Step 1: Run the dev server**

Run: `bun run dev`

- [ ] **Step 2: Test with a YouTube RSS feed entry**

Open an entry from a YouTube feed subscription. Verify:
- The video iframe renders inline in the article content
- The video has 16:9 aspect ratio with rounded corners
- The video is playable (click play in the embed)
- The iframe is responsive (resizes with the window)

- [ ] **Step 3: Test with a Bilibili RSS feed entry**

Open an entry from a Bilibili feed. Verify:
- The Bilibili video iframe renders with the player.bilibili.com URL
- The video is playable

- [ ] **Step 4: Test security — non-video iframes are stripped**

Verify that entry content with iframes from other domains does not render the iframe (DOMPurify strips it).

- [ ] **Step 5: Run full quality gate**

Run: `bun run check:all`
Expected: All checks pass

- [ ] **Step 6: Final commit if any adjustments were needed**

```bash
git add -u
git commit -m "fix: Address issues found during manual verification"
```
