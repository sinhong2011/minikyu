import { i18n } from '@lingui/core';
import { msg } from '@lingui/core/macro';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { openPath } from '@tauri-apps/plugin-opener';
import { useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { logger } from '@/lib/logger';
import { capabilities } from '@/lib/platform';
import { commands, type DownloadState } from '@/lib/tauri-bindings';
import { listen } from '@/lib/tauri-event';

const translate = i18n._.bind(i18n);

export const downloadQueryKeys = {
  all: ['downloads'] as const,
  list: () => [...downloadQueryKeys.all, 'list'] as const,
};

export type DownloadStatus = 'downloading' | 'completed' | 'failed' | 'cancelled' | 'paused';

export type DownloadItem = {
  enclosureId: number;
  url: string;
  fileName: string;
  status: DownloadStatus;
  progress: number;
  downloadedBytes: number;
  totalBytes: number;
  filePath?: string;
  error?: string;
  speed?: number;
  eta?: string;
  mediaType?: string;
  updatedAt: number;
};

export type DownloadProgressEvent = {
  enclosure_id: number;
  file_name: string;
  url: string;
  progress: number;
  downloaded_bytes: number;
  total_bytes: number;
  status: string;
  file_path?: string;
  media_type?: string;
};

/**
 * Enclosure ids that have produced a live progress event in this session.
 *
 * The downloader persists `Downloading` rows but nothing reconciles them when
 * the app dies mid-transfer, so a `Downloading` row read from the DB is an
 * orphan from a previous run — unless it belongs to a transfer we are watching
 * right now. Only the former is rewritten as interrupted.
 */
const liveDownloadIds = new Set<number>();

function toUnixTimestamp(value?: { duration_since_unix_epoch?: number }): number {
  if (!value) return Math.floor(Date.now() / 1000);
  const unix = value.duration_since_unix_epoch;
  if (typeof unix === 'number' && Number.isFinite(unix) && unix > 0) {
    return unix;
  }
  return Math.floor(Date.now() / 1000);
}

function fileNameFromUrl(url: string): string {
  return url.split('/').pop() ?? '';
}

/** Normalize one persisted download row into the shape the UI renders. */
export function mapDownloadState(state: DownloadState): DownloadItem {
  if ('Downloading' in state) {
    const d = state.Downloading;
    return {
      enclosureId: Number(d.id),
      url: d.url,
      fileName: fileNameFromUrl(d.url),
      status: 'downloading',
      progress: d.progress,
      downloadedBytes: Number(d.downloaded_bytes),
      totalBytes: Number(d.total_bytes),
      updatedAt: toUnixTimestamp(d.started_at),
    };
  }

  if ('Completed' in state) {
    const d = state.Completed;
    return {
      enclosureId: Number(d.id),
      url: d.url,
      fileName: d.file_path?.split(/[/\\]/).pop() ?? fileNameFromUrl(d.url),
      status: 'completed',
      progress: d.progress,
      downloadedBytes: Number(d.total_bytes),
      totalBytes: Number(d.total_bytes),
      filePath: d.file_path,
      updatedAt: toUnixTimestamp(d.completed_at),
    };
  }

  if ('Failed' in state) {
    const d = state.Failed;
    return {
      enclosureId: Number(d.id),
      url: d.url,
      fileName: fileNameFromUrl(d.url),
      status: 'failed',
      progress: d.progress,
      downloadedBytes: Number(d.downloaded_bytes),
      totalBytes: 0,
      error: d.error,
      updatedAt: toUnixTimestamp(d.failed_at),
    };
  }

  if ('Paused' in state) {
    const d = state.Paused;
    return {
      enclosureId: Number(d.id),
      url: d.url,
      fileName: fileNameFromUrl(d.url),
      status: 'paused',
      progress: d.progress,
      downloadedBytes: Number(d.downloaded_bytes),
      totalBytes: Number(d.total_bytes),
      updatedAt: toUnixTimestamp(d.paused_at),
    };
  }

  const d = state.Cancelled;
  return {
    enclosureId: Number(d.id),
    url: d.url,
    fileName: fileNameFromUrl(d.url),
    status: 'cancelled',
    progress: d.progress,
    downloadedBytes: 0,
    totalBytes: 0,
    updatedAt: toUnixTimestamp(d.cancelled_at),
  };
}

/**
 * Normalize the persisted download history, rewriting transfers that the app
 * never finished as failed. See {@link liveDownloadIds} for why an id being
 * watched right now is exempt.
 */
export function mapDownloadStates(
  states: DownloadState[],
  isLive: (enclosureId: number) => boolean = (id) => liveDownloadIds.has(id)
): DownloadItem[] {
  return states.map(mapDownloadState).map((item) =>
    item.status === 'downloading' && !isLive(item.enclosureId)
      ? {
          ...item,
          status: 'failed' as DownloadStatus,
          error: translate(msg`Interrupted — app was closed`),
        }
      : item
  );
}

/** Find the download row for one enclosure URL, if any. */
export function findDownloadByUrl(
  downloads: DownloadItem[],
  url: string
): DownloadItem | undefined {
  return downloads.find((item) => item.url === url);
}

/**
 * The shared download history.
 *
 * Hydrated once from the DB and driven from there on by the `download-progress`
 * event stream via {@link useDownloadEvents} — hence no refetching: a refetch
 * would replace live rows with the downloader's last checkpoint. The two
 * mutations below write their results straight into this cache for the same
 * reason.
 */
export function useDownloads() {
  return useQuery({
    queryKey: downloadQueryKeys.list(),
    queryFn: async (): Promise<DownloadItem[]> => {
      const result = await commands.getDownloadsFromDb();

      if (result.status === 'error') {
        logger.error('Failed to load download history', { error: result.error });
        throw new Error(result.error);
      }

      return mapDownloadStates(result.data);
    },
    // The downloader is Rust-side; the PWA has no history to read.
    enabled: capabilities.downloads,
    staleTime: Number.POSITIVE_INFINITY,
    gcTime: Number.POSITIVE_INFINITY,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
}

const SPEED_EMA_ALPHA = 0.3;
/** Below this gap the byte delta is too small to estimate speed from. */
const SPEED_SAMPLE_MIN_SECONDS = 0.25;

function formatEta(remainingBytes: number, speedBps: number): string {
  if (!speedBps || speedBps <= 0 || remainingBytes <= 0) return '';
  const seconds = Math.ceil(remainingBytes / speedBps);
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.ceil(seconds / 60)}m`;
  const h = Math.floor(seconds / 3600);
  const m = Math.ceil((seconds % 3600) / 60);
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

/**
 * Merge one progress event into the cached history.
 *
 * `speed` of -1 means "sampled too soon to measure" — the previous speed and
 * ETA are carried over rather than dropping to zero and flickering.
 */
export function applyDownloadProgress(
  downloads: DownloadItem[],
  event: DownloadProgressEvent,
  speed: number,
  nowSeconds: number
): DownloadItem[] {
  const existing = downloads.find((d) => d.enclosureId === event.enclosure_id);

  if (!existing) {
    return [
      {
        enclosureId: event.enclosure_id,
        url: event.url || '',
        fileName: event.file_name || '',
        status: event.status as DownloadStatus,
        progress: event.progress,
        downloadedBytes: event.downloaded_bytes,
        totalBytes: event.total_bytes,
        speed: 0,
        eta: '',
        filePath: event.file_path,
        mediaType: event.media_type,
        updatedAt: nowSeconds,
      },
      ...downloads,
    ];
  }

  const remaining = event.total_bytes - event.downloaded_bytes;

  return downloads.map((d) =>
    d.enclosureId === event.enclosure_id
      ? {
          ...d,
          fileName: event.file_name || d.fileName,
          url: event.url || d.url,
          progress: event.progress,
          downloadedBytes: event.downloaded_bytes,
          totalBytes: event.total_bytes,
          status: event.status as DownloadStatus,
          speed: speed === -1 ? d.speed : speed,
          eta: speed > 0 && remaining > 0 ? formatEta(remaining, speed) : speed === -1 ? d.eta : '',
          filePath: event.file_path || d.filePath,
          mediaType: event.media_type || d.mediaType,
          updatedAt: nowSeconds,
        }
      : d
  );
}

/**
 * Subscribe the download cache to the downloader's progress events.
 *
 * Mount once, at the app shell — every reader of {@link useDownloads} then sees
 * live progress whether or not the download manager is open, and completion
 * toasts no longer depend on that dialog being mounted.
 */
export function useDownloadEvents() {
  const queryClient = useQueryClient();
  const speedRef = useRef<Record<number, { bytes: number; time: number; ema: number }>>({});
  const notifiedRef = useRef<Set<number>>(new Set());

  useEffect(() => {
    if (!capabilities.downloads) return;

    let unlisten: (() => void) | null = null;
    let cancelled = false;

    const bind = async () => {
      try {
        const unlistenFn = await listen<DownloadProgressEvent>('download-progress', (event) => {
          const payload = event.payload;
          const { enclosure_id: enclosureId, file_name: fileName, status } = payload;

          liveDownloadIds.add(enclosureId);

          if (status === 'completed' && !notifiedRef.current.has(enclosureId)) {
            notifiedRef.current.add(enclosureId);
            toast.success(translate(msg`Download Completed`), {
              description: fileName,
              action: payload.file_path
                ? {
                    label: translate(msg`Open`),
                    onClick: () => openPath(payload.file_path as string),
                  }
                : undefined,
            });
          } else if (status === 'failed' && !notifiedRef.current.has(enclosureId)) {
            notifiedRef.current.add(enclosureId);
            toast.error(translate(msg`Download Failed`), { description: fileName });
          }

          const now = Date.now();
          const last = speedRef.current[enclosureId];
          let speed = 0;

          if (last && status === 'downloading') {
            const elapsed = (now - last.time) / 1000;
            if (elapsed > SPEED_SAMPLE_MIN_SECONDS) {
              const instant = (payload.downloaded_bytes - last.bytes) / elapsed;
              const ema =
                last.ema > 0
                  ? SPEED_EMA_ALPHA * instant + (1 - SPEED_EMA_ALPHA) * last.ema
                  : instant;
              speed = ema;
              speedRef.current[enclosureId] = {
                bytes: payload.downloaded_bytes,
                time: now,
                ema,
              };
            } else {
              speed = -1;
            }
          } else {
            speedRef.current[enclosureId] = {
              bytes: payload.downloaded_bytes,
              time: now,
              ema: 0,
            };
          }

          queryClient.setQueryData<DownloadItem[]>(downloadQueryKeys.list(), (downloads) =>
            applyDownloadProgress(downloads ?? [], payload, speed, Math.floor(now / 1000))
          );
        });

        if (cancelled) {
          unlistenFn();
          return;
        }
        unlisten = unlistenFn;
      } catch (error) {
        logger.error('Failed to listen to download-progress event', { error });
      }
    };

    void bind();

    return () => {
      cancelled = true;
      unlisten?.();
    };
  }, [queryClient]);
}

/** Remove a single finished download from the history. */
export function useRemoveDownload() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (enclosureId: number) => {
      const result = await commands.deleteDownload(String(enclosureId));
      if (result.status === 'error') {
        logger.error('Failed to delete download', { error: result.error, enclosureId });
        throw new Error(result.error);
      }
    },
    onMutate: (enclosureId) => {
      const previous = queryClient.getQueryData<DownloadItem[]>(downloadQueryKeys.list());
      queryClient.setQueryData<DownloadItem[]>(downloadQueryKeys.list(), (downloads) =>
        (downloads ?? []).filter((d) => d.enclosureId !== enclosureId)
      );
      return { previous };
    },
    onError: (_error, _enclosureId, context) => {
      if (context?.previous) {
        queryClient.setQueryData(downloadQueryKeys.list(), context.previous);
      }
    },
  });
}

export type ClearDownloadsScope = 'completed' | 'failed' | 'finished';

/**
 * Clear finished downloads. `finished` clears everything that is not still
 * running or paused, matching the backend's "clear all" (`null`) semantics.
 */
export function useClearDownloads() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (scope: ClearDownloadsScope) => {
      const statuses: (string | null)[] =
        scope === 'completed'
          ? ['completed']
          : scope === 'failed'
            ? ['failed', 'cancelled']
            : [null];

      for (const status of statuses) {
        const result = await commands.clearDownloads(status);
        if (result.status === 'error') {
          logger.error('Failed to clear downloads', { error: result.error, status });
          throw new Error(result.error);
        }
      }
    },
    onMutate: (scope) => {
      const previous = queryClient.getQueryData<DownloadItem[]>(downloadQueryKeys.list());
      queryClient.setQueryData<DownloadItem[]>(downloadQueryKeys.list(), (downloads) =>
        (downloads ?? []).filter((d) => {
          if (scope === 'completed') return d.status !== 'completed';
          if (scope === 'failed') return d.status !== 'failed' && d.status !== 'cancelled';
          return d.status === 'downloading' || d.status === 'paused';
        })
      );
      return { previous };
    },
    onError: (_error, _scope, context) => {
      if (context?.previous) {
        queryClient.setQueryData(downloadQueryKeys.list(), context.previous);
      }
    },
  });
}
