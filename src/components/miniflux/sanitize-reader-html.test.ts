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

  it('preserves YouTube iframe with all Miniflux attributes', () => {
    const html =
      '<iframe width="650" height="350" frameborder="0" src="https://www.youtube-nocookie.com/embed/yRV8fSw6HaE" allowfullscreen="" sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox" loading="lazy" referrerpolicy="strict-origin-when-cross-origin"></iframe><br/>test';
    const result = sanitizeReaderHtml(html);
    expect(result).toContain('iframe');
    expect(result).toContain('youtube-nocookie.com/embed/yRV8fSw6HaE');
  });

  it('still sanitizes other HTML as before', () => {
    const html = '<script>alert(1)</script><p>Hello</p>';
    const result = sanitizeReaderHtml(html);
    expect(result).not.toContain('script');
    expect(result).toContain('<p>Hello</p>');
  });
});
