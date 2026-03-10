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
    expect(
      isAllowedVideoIframeSrc('https://player.bilibili.com/player.html?bvid=BV1xx411c7mD')
    ).toBe(true);
  });

  it('allows protocol-relative bilibili URLs', () => {
    expect(isAllowedVideoIframeSrc('//player.bilibili.com/player.html?bvid=BV1xx411c7mD')).toBe(
      true
    );
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
    expect(result).toBe(
      '//player.bilibili.com/player.html?isOutside=true&bvid=BV1xx411c7mD&p=1&danmaku=0'
    );
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
    expect(result).toBe(
      '//player.bilibili.com/player.html?isOutside=true&bvid=BV1xx411c7mD&p=1&danmaku=0'
    );
  });
});
