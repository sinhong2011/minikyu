import type { Entry } from '@/lib/tauri-bindings';

/**
 * Extracts a thumbnail URL from an entry.
 * Checks enclosures first, then searches for the first img tag in the content.
 */
export function extractThumbnail(entry: Entry): string | null {
  // 1. Check enclosures for image types
  if (entry.enclosures && entry.enclosures.length > 0) {
    const imageEnclosure = entry.enclosures.find((e) => e.mime_type.startsWith('image/'));
    if (imageEnclosure) {
      return imageEnclosure.url;
    }
  }

  // 2. Search for img tag in content
  if (entry.content) {
    const imgRegex = /<img[^>]+src="([^">]+)"/i;
    const match = entry.content.match(imgRegex);
    if (match?.[1]) {
      return match[1];
    }
  }

  return null;
}
