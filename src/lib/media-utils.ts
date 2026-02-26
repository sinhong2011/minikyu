import type { Entry } from '@/lib/tauri-bindings';

// Patterns ordered by specificity for podcast/media cover art
const CONTENT_IMAGE_PATTERNS: RegExp[] = [
  // Podcast 2.0 namespace
  /<podcast:images[^>]+srcset="([^"\s]+)/i,
  // iTunes/Apple podcast image
  /<itunes:image[^>]+href="([^">]+)"/i,
  // Media RSS thumbnail
  /<media:thumbnail[^>]+url="([^">]+)"/i,
  // Media RSS content with image medium
  /<media:content[^>]+medium="image"[^>]+url="([^">]+)"/i,
  /<media:content[^>]+url="([^">]+)"[^>]+medium="image"/i,
  // Standard RSS image element
  /<image>\s*<url>([^<]+)<\/url>/i,
  // HTML img tag (fallback)
  /<img[^>]+src="([^">]+)"/i,
];

/**
 * Extracts a thumbnail URL from an entry.
 * Priority: image enclosures > podcast/media tags in content > img tags.
 */
export function extractThumbnail(entry: Entry): string | null {
  // 1. Check enclosures for image types
  if (entry.enclosures && entry.enclosures.length > 0) {
    const imageEnclosure = entry.enclosures.find((e) => e.mime_type.startsWith('image/'));
    if (imageEnclosure) {
      return imageEnclosure.url;
    }
  }

  // 2. Search content with prioritized patterns
  if (entry.content) {
    for (const pattern of CONTENT_IMAGE_PATTERNS) {
      const match = entry.content.match(pattern);
      if (match?.[1]) {
        return match[1];
      }
    }
  }

  return null;
}
