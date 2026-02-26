import { describe, expect, it } from 'vitest';
import type { Entry } from '@/lib/tauri-bindings';
import { extractThumbnail } from './media-utils';

describe('extractThumbnail', () => {
  it('should extract thumbnail from image enclosure', () => {
    const entry = {
      // biome-ignore lint/style/useNamingConvention: API response format
      enclosures: [{ mime_type: 'image/jpeg', url: 'https://example.com/image.jpg' }],
    } as Entry;
    expect(extractThumbnail(entry)).toBe('https://example.com/image.jpg');
  });

  it('should prefer image enclosure over content', () => {
    const entry = {
      // biome-ignore lint/style/useNamingConvention: API response format
      enclosures: [{ mime_type: 'image/jpeg', url: 'https://example.com/enclosure.jpg' }],
      content: '<itunes:image href="https://example.com/itunes.jpg" />',
    } as Entry;
    expect(extractThumbnail(entry)).toBe('https://example.com/enclosure.jpg');
  });

  it('should extract from <itunes:image> in content', () => {
    const entry = {
      content: '<itunes:image href="https://example.com/podcast-cover.jpg" />',
    } as Entry;
    expect(extractThumbnail(entry)).toBe('https://example.com/podcast-cover.jpg');
  });

  it('should extract from <media:thumbnail> in content', () => {
    const entry = {
      content: '<media:thumbnail url="https://example.com/thumb.jpg" />',
    } as Entry;
    expect(extractThumbnail(entry)).toBe('https://example.com/thumb.jpg');
  });

  it('should extract from <media:content medium="image"> in content', () => {
    const entry = {
      content: '<media:content medium="image" url="https://example.com/media.jpg" />',
    } as Entry;
    expect(extractThumbnail(entry)).toBe('https://example.com/media.jpg');
  });

  it('should extract from <podcast:images> srcset', () => {
    const entry = {
      content:
        '<podcast:images srcset="https://example.com/cover.jpg 3000w, https://example.com/cover-sm.jpg 600w" />',
    } as Entry;
    expect(extractThumbnail(entry)).toBe('https://example.com/cover.jpg');
  });

  it('should prefer itunes:image over img tag', () => {
    const entry = {
      content:
        '<itunes:image href="https://example.com/cover.jpg" /><img src="https://example.com/inline.png">',
    } as Entry;
    expect(extractThumbnail(entry)).toBe('https://example.com/cover.jpg');
  });

  it('should fall back to img tag in content', () => {
    const entry = {
      content: '<p>Hello</p><img src="https://example.com/content.png">',
    } as Entry;
    expect(extractThumbnail(entry)).toBe('https://example.com/content.png');
  });

  it('should return null if no image found', () => {
    const entry = {
      content: '<p>Just text</p>',
    } as Entry;
    expect(extractThumbnail(entry)).toBeNull();
  });
});
