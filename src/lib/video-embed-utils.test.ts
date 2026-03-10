import { describe, expect, it } from 'vitest';
import {
  extractYouTubeVideoId,
  getVideoEmbedHtml,
  isAllowedVideoIframeSrc,
  rewriteBilibiliSrc,
} from './video-embed-utils';

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

describe('extractYouTubeVideoId', () => {
  it('extracts video ID from youtube.com/watch?v=', () => {
    expect(extractYouTubeVideoId('https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toBe(
      'dQw4w9WgXcQ'
    );
  });

  it('extracts video ID from youtube.com/shorts/', () => {
    expect(extractYouTubeVideoId('https://www.youtube.com/shorts/abc123def45')).toBe('abc123def45');
  });

  it('extracts video ID from youtu.be/', () => {
    expect(extractYouTubeVideoId('https://youtu.be/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
  });

  it('returns null for non-YouTube URLs', () => {
    expect(extractYouTubeVideoId('https://vimeo.com/123456')).toBeNull();
  });

  it('returns null for YouTube channel pages', () => {
    expect(extractYouTubeVideoId('https://www.youtube.com/channel/UCxyz')).toBeNull();
  });
});

describe('getVideoEmbedHtml', () => {
  it('generates YouTube embed iframe from watch URL', () => {
    const result = getVideoEmbedHtml('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
    expect(result).toContain('youtube-nocookie.com/embed/dQw4w9WgXcQ');
    expect(result).toContain('<iframe');
  });

  it('generates Bilibili embed iframe from video URL', () => {
    const result = getVideoEmbedHtml('https://www.bilibili.com/video/BV1xx411c7mD');
    expect(result).toContain('player.bilibili.com');
    expect(result).toContain('bvid=BV1xx411c7mD');
  });

  it('returns null for non-video URLs', () => {
    expect(getVideoEmbedHtml('https://example.com/article')).toBeNull();
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
