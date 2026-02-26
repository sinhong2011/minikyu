import type { DownloadState, Enclosure, Entry } from '@/lib/tauri-bindings';

/**
 * Check if a feed is a podcast feed based on its entries.
 * A feed is a podcast when >50% of recent entries have audio enclosures.
 */
export function isPodcastFeed(entries: Entry[]): boolean {
  const recent = entries.slice(0, 20);
  if (recent.length === 0) return false;
  const audioCount = recent.filter((e) =>
    e.enclosures?.some((enc) => enc.mime_type.startsWith('audio/'))
  ).length;
  return audioCount / recent.length > 0.5;
}

/**
 * Get the first audio enclosure from an entry, if any.
 */
export function getPodcastEnclosure(entry: Entry): Enclosure | null {
  return entry.enclosures?.find((enc) => enc.mime_type.startsWith('audio/')) ?? null;
}

/**
 * Check if an entry has a podcast audio enclosure.
 */
export function isPodcastEntry(entry: Entry): boolean {
  return getPodcastEnclosure(entry) !== null;
}

/**
 * Format seconds into human-readable duration (e.g., "42 min", "1h 23m")
 */
export function formatDuration(seconds: number): string {
  if (seconds <= 0) return '';
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes} min`;
}

/**
 * Format seconds into timestamp (e.g., "1:23:45" or "23:45")
 */
export function formatTimestamp(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) {
    return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }
  return `${m}:${String(s).padStart(2, '0')}`;
}

/** Playback speed presets */
export const SPEED_PRESETS = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2] as const;

/** Speed slider range */
export const SPEED_MIN = 0.5;
export const SPEED_MAX = 3;
export const SPEED_STEP = 0.05;

const AUDIO_MIME_EXTENSION_MAP: Record<string, string> = {
  'audio/mpeg': 'mp3',
  'audio/mp3': 'mp3',
  'audio/mp4': 'm4a',
  'audio/aac': 'aac',
  'audio/x-aac': 'aac',
  'audio/ogg': 'ogg',
  'audio/webm': 'webm',
  'audio/wav': 'wav',
  'audio/x-wav': 'wav',
  'audio/flac': 'flac',
  'audio/x-flac': 'flac',
};

function sanitizePodcastFileStem(value: string): string {
  const cleaned = Array.from(value)
    .filter((char) => {
      const code = char.charCodeAt(0);
      if (code < 32) return false;
      return !/[<>:"/\\|?*]/.test(char);
    })
    .join('')
    .replace(/\s+/g, ' ')
    .trim();

  if (cleaned.length === 0) {
    return 'podcast-episode';
  }

  return cleaned.slice(0, 120);
}

function inferExtensionFromUrl(url: string): string | null {
  try {
    const parsed = new URL(url);
    const candidate = parsed.pathname.split('.').pop()?.toLowerCase() ?? '';
    if (/^[a-z0-9]{2,5}$/.test(candidate)) return candidate;
  } catch {
    const match = url.toLowerCase().match(/\.([a-z0-9]{2,5})(?:$|[?#])/);
    if (match?.[1]) return match[1];
  }

  return null;
}

/**
 * Build a safe file name for podcast downloads.
 */
export function buildPodcastDownloadFileName(entryTitle: string, enclosure: Enclosure): string {
  const stem = sanitizePodcastFileStem(entryTitle);
  const mimeExt = AUDIO_MIME_EXTENSION_MAP[enclosure.mime_type.toLowerCase()];
  const urlExt = inferExtensionFromUrl(enclosure.url);
  const ext = mimeExt ?? urlExt ?? 'mp3';
  return `${stem}.${ext}`;
}

export type PodcastDownloadSnapshot =
  | { status: 'downloading'; progress: number }
  | { status: 'completed'; progress: number; filePath: string }
  | { status: 'failed'; progress: number; error: string }
  | { status: 'cancelled'; progress: number };

/**
 * Resolve download status for one podcast URL from download history.
 */
export function getPodcastDownloadSnapshotForUrl(
  history: DownloadState[],
  enclosureUrl: string
): PodcastDownloadSnapshot | null {
  for (const item of history) {
    if ('Downloading' in item && item.Downloading.url === enclosureUrl) {
      return { status: 'downloading', progress: item.Downloading.progress };
    }

    if ('Completed' in item && item.Completed.url === enclosureUrl) {
      return {
        status: 'completed',
        progress: item.Completed.progress,
        filePath: item.Completed.file_path,
      };
    }

    if ('Failed' in item && item.Failed.url === enclosureUrl) {
      return {
        status: 'failed',
        progress: item.Failed.progress,
        error: item.Failed.error,
      };
    }

    if ('Cancelled' in item && item.Cancelled.url === enclosureUrl) {
      return {
        status: 'cancelled',
        progress: item.Cancelled.progress,
      };
    }
  }

  return null;
}
