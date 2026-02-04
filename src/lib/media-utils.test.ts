import { describe, expect, it } from 'vitest';
import type { Entry } from '@/lib/tauri-bindings';
import { extractThumbnail } from './media-utils';

describe('extractThumbnail', () => {
  it('should extract thumbnail from enclosures if present', () => {
    const entry = {
      enclosures: [{ mime_type: 'image/jpeg', url: 'https://example.com/image.jpg' }],
    } as Entry;
    expect(extractThumbnail(entry)).toBe('https://example.com/image.jpg');
  });

  it('should extract thumbnail from img tag in content if no enclosure', () => {
    const entry = {
      content: '<p>Hello</p><img src="https://example.com/content.png">',
    } as Entry;
    expect(extractThumbnail(entry)).toBe('https://example.com/content.png');
  });

  it('should prefer enclosures over content img tags', () => {
    const entry = {
      enclosures: [{ mime_type: 'image/jpeg', url: 'https://example.com/enclosure.jpg' }],
      content: '<img src="https://example.com/content.png">',
    } as Entry;
    expect(extractThumbnail(entry)).toBe('https://example.com/enclosure.jpg');
  });

  it('should return null if no image found', () => {
    const entry = {
      content: '<p>Just text</p>',
    } as Entry;
    expect(extractThumbnail(entry)).toBeNull();
  });
});
