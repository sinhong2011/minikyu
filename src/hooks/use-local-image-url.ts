import { convertFileSrc } from '@tauri-apps/api/core';
import { useEffect, useState } from 'react';
import { getPlatform } from '@/hooks/use-platform';
import { commands } from '@/lib/tauri-bindings';

/**
 * Returns a URL suitable for displaying a local image file.
 *
 * On Windows, the Tauri asset protocol (`convertFileSrc`) does not work
 * reliably in production builds. This hook detects the platform and:
 * - Windows: reads the file via IPC and returns a base64 data URL
 * - macOS/Linux: uses `convertFileSrc` (asset protocol) directly
 *
 * Results are cached in a module-level Map keyed by file path to avoid
 * re-reading the same file on every render.
 */

const cache = new Map<string, string>();

export function useLocalImageUrl(path: string | null | undefined): string | null {
  const [url, setUrl] = useState<string | null>(() => {
    if (!path) return null;
    if (cache.has(path)) return cache.get(path) ?? null;
    if (getPlatform() !== 'windows') return convertFileSrc(path);
    return null;
  });

  useEffect(() => {
    if (!path) {
      setUrl(null);
      return;
    }

    // Non-Windows: use asset protocol directly
    if (getPlatform() !== 'windows') {
      const assetUrl = convertFileSrc(path);
      setUrl(assetUrl);
      return;
    }

    // Windows: check cache first
    const cached = cache.get(path);
    if (cached) {
      setUrl(cached);
      return;
    }

    // Windows: read via IPC command
    let cancelled = false;
    commands.readImageAsDataUrl(path).then((result) => {
      if (cancelled) return;
      if (result.status === 'ok') {
        cache.set(path, result.data);
        setUrl(result.data);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [path]);

  return url;
}

/**
 * Non-hook version for use outside React components.
 * Returns the cached URL if available, or null.
 * Triggers an async load if not cached (for Windows).
 */
export function getLocalImageUrl(path: string): string {
  if (getPlatform() !== 'windows') {
    return convertFileSrc(path);
  }

  const cached = cache.get(path);
  if (cached) return cached;

  // Trigger async load for next render
  commands.readImageAsDataUrl(path).then((result) => {
    if (result.status === 'ok') {
      cache.set(path, result.data);
    }
  });

  // Return empty string while loading (will update on next render cycle)
  return '';
}

/**
 * Clear the image URL cache. Call when the background image path changes.
 */
export function clearImageUrlCache(path?: string): void {
  if (path) {
    cache.delete(path);
  } else {
    cache.clear();
  }
}
