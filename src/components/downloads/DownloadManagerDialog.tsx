import {
  AlertCircleIcon,
  Cancel01Icon,
  Clock01Icon,
  Delete02Icon,
  Download01Icon,
  FolderOpenIcon,
  HeadphonesIcon,
  Image01Icon,
  PauseIcon,
  PlayIcon,
  RefreshIcon,
  Search01Icon,
  Video01Icon,
  ViewIcon,
} from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react';
import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import type { ColumnDef } from '@tanstack/react-table';
import { listen } from '@tauri-apps/api/event';
import { writeText } from '@tauri-apps/plugin-clipboard-manager';
import { openPath, revealItemInDir } from '@tauri-apps/plugin-opener';
import { useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Tabs, TabsList, TabsTab } from '@/components/animate-ui/components/base/tabs';
import { Button } from '@/components/ui/button';
import { DataTable } from '@/components/ui/data-table';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Tooltip, TooltipPanel, TooltipTrigger } from '@/components/ui/tooltip';
import { commands } from '@/lib/tauri-bindings';
import { cn } from '@/lib/utils';
import { usePlayerStore } from '@/store/player-store';
import { useUIStore } from '@/store/ui-store';

type DownloadStatus = 'downloading' | 'completed' | 'failed' | 'cancelled' | 'paused';
type FilterTab = 'all' | 'active' | 'completed' | 'failed';

type DownloadItem = {
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

type EventPayload = {
  // biome-ignore lint/style/useNamingConvention: API event payload
  enclosure_id: number;
  // biome-ignore lint/style/useNamingConvention: API event payload
  file_name: string;
  url: string;
  progress: number;
  // biome-ignore lint/style/useNamingConvention: API event payload
  downloaded_bytes: number;
  // biome-ignore lint/style/useNamingConvention: API event payload
  total_bytes: number;
  status: string;
  // biome-ignore lint/style/useNamingConvention: API event payload
  file_path?: string;
  // biome-ignore lint/style/useNamingConvention: API event payload
  media_type?: string;
};

function inferMediaType(fileName: string): 'audio' | 'image' | 'video' | 'file' {
  const ext = fileName.split('.').pop()?.toLowerCase() ?? '';
  if (['mp3', 'm4a', 'aac', 'ogg', 'wav', 'flac', 'webm', 'opus'].includes(ext)) return 'audio';
  if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'avif', 'bmp'].includes(ext)) return 'image';
  if (['mp4', 'mkv', 'avi', 'mov', 'wmv'].includes(ext)) return 'video';
  return 'file';
}

function hostnameFromUrl(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return '';
  }
}

function toUnixTimestamp(
  // biome-ignore lint/style/useNamingConvention: Rust-serialized SystemTime
  value?: { duration_since_unix_epoch?: number }
): number {
  if (!value) return Math.floor(Date.now() / 1000);
  const unix = value.duration_since_unix_epoch;
  if (typeof unix === 'number' && Number.isFinite(unix) && unix > 0) {
    return unix;
  }
  return Math.floor(Date.now() / 1000);
}

function formatBytes(bytes: number): string {
  if (bytes <= 0) return '-';
  const k = 1024;
  const m = k * 1024;
  const g = m * 1024;
  if (bytes < k) return `${bytes} B`;
  if (bytes < m) return `${(bytes / k).toFixed(1)} KB`;
  if (bytes < g) return `${(bytes / m).toFixed(1)} MB`;
  return `${(bytes / g).toFixed(2)} GB`;
}

function formatSpeed(bytesPerSec?: number): string {
  if (!bytesPerSec || bytesPerSec <= 0) return '';
  return `${formatBytes(bytesPerSec)}/s`;
}

function formatEta(remainingBytes: number, speedBps: number): string {
  if (!speedBps || speedBps <= 0 || remainingBytes <= 0) return '';
  const seconds = Math.ceil(remainingBytes / speedBps);
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.ceil(seconds / 60)}m`;
  const h = Math.floor(seconds / 3600);
  const m = Math.ceil((seconds % 3600) / 60);
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function formatDate(unixSeconds: number): string {
  const date = new Date(unixSeconds * 1000);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}/${month}/${day}`;
}

function statusPriority(status: DownloadStatus): number {
  if (status === 'downloading' || status === 'paused') return 0;
  if (status === 'completed') return 1;
  return 2;
}

const MEDIA_ICONS = {
  audio: HeadphonesIcon,
  image: Image01Icon,
  video: Video01Icon,
  file: Download01Icon,
} as const;

function DownloadIcon({ item }: { item: DownloadItem }) {
  const type = inferMediaType(item.fileName);
  const icon = MEDIA_ICONS[type];

  return (
    <div
      className={cn(
        'flex size-10 shrink-0 items-center justify-center rounded-2xl border border-white/5',
        item.status === 'completed' && 'bg-emerald-500/10 text-emerald-300',
        item.status === 'failed' && 'bg-destructive/10 text-destructive',
        item.status === 'cancelled' && 'bg-destructive/10 text-destructive',
        item.status === 'paused' && 'bg-amber-500/10 text-amber-300',
        item.status === 'downloading' && 'bg-cyan-500/10 text-cyan-300'
      )}
    >
      <HugeiconsIcon icon={icon} className="size-4" />
    </div>
  );
}

export function DownloadManagerDialog() {
  const { _ } = useLingui();
  const [downloads, setDownloads] = useState<DownloadItem[]>([]);
  const [activeTab, setActiveTab] = useState<FilterTab>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const downloadsOpen = useUIStore((state) => state.downloadsOpen);
  const setDownloadsOpen = useUIStore((state) => state.setDownloadsOpen);
  const speedRef = useRef<Record<number, { bytes: number; time: number; ema: number }>>({});
  const completedRef = useRef<Set<number>>(new Set());

  useEffect(() => {
    let unlisten: (() => void) | null = null;

    const setup = async () => {
      try {
        const result = await commands.getDownloadsFromDb();
        if (result.status === 'ok') {
          const mapped = result.data.map((state): DownloadItem => {
            if ('Downloading' in state) {
              const d = state.Downloading;
              return {
                enclosureId: Number(d.id),
                url: d.url,
                fileName: d.url.split('/').pop() ?? '',
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
                fileName: d.file_path?.split(/[/\\]/).pop() ?? d.url.split('/').pop() ?? '',
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
                fileName: d.url.split('/').pop() ?? '',
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
                fileName: d.url.split('/').pop() ?? '',
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
              fileName: d.url.split('/').pop() ?? '',
              status: 'cancelled',
              progress: d.progress,
              downloadedBytes: 0,
              totalBytes: 0,
              updatedAt: toUnixTimestamp(d.cancelled_at),
            };
          });

          const cleaned = mapped.map((item) =>
            item.status === 'downloading'
              ? {
                  ...item,
                  status: 'failed' as DownloadStatus,
                  error: _(msg`Interrupted — app was closed`),
                }
              : item
          );

          setDownloads(cleaned);
        }
      } catch (error) {
        console.error('Failed to load download history:', error);
      }

      try {
        const unlistenFn = await listen<EventPayload>('download-progress', (event) => {
          const {
            enclosure_id,
            file_name,
            url,
            progress,
            downloaded_bytes,
            total_bytes,
            status,
            file_path,
            media_type,
          } = event.payload;

          if (status === 'completed' && !completedRef.current.has(enclosure_id)) {
            completedRef.current.add(enclosure_id);
            toast.success(_(msg`Download Completed`), {
              description: file_name,
              action: file_path
                ? { label: _(msg`Open`), onClick: () => openPath(file_path) }
                : undefined,
            });
          } else if (status === 'failed' && !completedRef.current.has(enclosure_id)) {
            completedRef.current.add(enclosure_id);
            toast.error(_(msg`Download Failed`), { description: file_name });
          }

          const now = Date.now();
          const last = speedRef.current[enclosure_id];
          let speed = 0;
          const emaAlpha = 0.3;

          if (last && status === 'downloading') {
            const timeDiff = (now - last.time) / 1000;
            if (timeDiff > 0.25) {
              const instantSpeed = (downloaded_bytes - last.bytes) / timeDiff;
              const ema =
                last.ema > 0 ? emaAlpha * instantSpeed + (1 - emaAlpha) * last.ema : instantSpeed;
              speed = ema;
              speedRef.current[enclosure_id] = { bytes: downloaded_bytes, time: now, ema };
            } else {
              speed = -1;
            }
          } else {
            speedRef.current[enclosure_id] = { bytes: downloaded_bytes, time: now, ema: 0 };
          }

          setDownloads((prev) => {
            const idx = prev.findIndex((d) => d.enclosureId === enclosure_id);
            if (idx !== -1) {
              return prev.map((d, i) =>
                i === idx
                  ? {
                      ...d,
                      fileName: file_name || d.fileName,
                      url: url || d.url,
                      progress,
                      downloadedBytes: downloaded_bytes,
                      totalBytes: total_bytes,
                      status: status as DownloadStatus,
                      speed: speed === -1 ? d.speed : speed,
                      eta:
                        speed > 0 && total_bytes > downloaded_bytes
                          ? formatEta(total_bytes - downloaded_bytes, speed)
                          : speed === -1
                            ? d.eta
                            : '',
                      filePath: file_path || d.filePath,
                      mediaType: media_type || d.mediaType,
                      updatedAt: Math.floor(now / 1000),
                    }
                  : d
              );
            }

            return [
              {
                enclosureId: enclosure_id,
                url: url || '',
                fileName: file_name || '',
                status: status as DownloadStatus,
                progress,
                downloadedBytes: downloaded_bytes,
                totalBytes: total_bytes,
                speed: 0,
                eta: '',
                filePath: file_path,
                mediaType: media_type,
                updatedAt: Math.floor(now / 1000),
              },
              ...prev,
            ];
          });
        });

        unlisten = unlistenFn;
      } catch (error) {
        console.error('Failed to listen to download-progress event:', error);
      }
    };

    setup();
    return () => {
      unlisten?.();
    };
  }, [_]);

  const handleOpenFile = async (filePath: string) => {
    if (!filePath) return;
    try {
      await openPath(filePath);
    } catch (error) {
      toast.error(_(msg`Could not open file`));
      console.error('openPath failed:', error);
    }
  };

  const handleOpenFolder = async (filePath: string) => {
    if (!filePath) return;
    try {
      await revealItemInDir(filePath);
    } catch (error) {
      toast.error(_(msg`Could not reveal in folder`));
      console.error('revealItemInDir failed:', error);
    }
  };

  const handleCopyUrl = async (url: string) => {
    await writeText(url);
    toast.success(_(msg`URL copied to clipboard`));
  };

  const handlePlay = async (dl: DownloadItem) => {
    const entryResult = await commands.getEntryIdByEnclosureUrl(dl.url);
    if (entryResult.status !== 'ok' || !entryResult.data) {
      toast.error(_(msg`Could not find podcast entry`));
      return;
    }

    const result = await commands.getEntry(entryResult.data);
    if (result.status !== 'ok') {
      toast.error(_(msg`Could not load podcast entry`));
      return;
    }

    const entry = result.data;
    const enclosure = entry.enclosures?.find((e) => e.url === dl.url);
    if (!enclosure) {
      toast.error(_(msg`Enclosure not found for this entry`));
      return;
    }

    usePlayerStore.getState().play(entry, enclosure);
    setDownloadsOpen(false);
  };

  const handleRemove = async (id: number) => {
    setDownloads((prev) => prev.filter((d) => d.enclosureId !== id));
    const result = await commands.deleteDownload(String(id));
    if (result.status === 'error') {
      console.error('Failed to delete download:', result.error);
    }
  };

  const handleCancel = async (dl: DownloadItem) => {
    if (dl.status !== 'downloading' && dl.status !== 'paused') return;
    const result = await commands.cancelDownload(dl.url);
    if (result.status === 'error') {
      toast.error(_(msg`Failed to cancel download`));
    }
  };

  const handlePause = async (dl: DownloadItem) => {
    if (dl.status !== 'downloading') return;
    const result = await commands.pauseDownload(dl.url);
    if (result.status === 'error') {
      toast.error(_(msg`Failed to pause download`));
    }
  };

  const handleResume = async (dl: DownloadItem) => {
    if (dl.status !== 'paused') return;
    const mediaType = dl.mediaType ?? (inferMediaType(dl.fileName) === 'audio' ? 'audio' : null);
    const result = await commands.resumeDownload(dl.url, dl.fileName, mediaType);
    if (result.status === 'error') {
      toast.error(_(msg`Failed to resume download`), { description: result.error });
    }
  };

  const handleRetry = async (dl: DownloadItem) => {
    if (dl.status !== 'failed' && dl.status !== 'cancelled') return;
    const mediaType = dl.mediaType ?? (inferMediaType(dl.fileName) === 'audio' ? 'audio' : null);
    const result = await commands.retryDownload(dl.url, dl.fileName, mediaType);
    if (result.status === 'error') {
      toast.error(_(msg`Retry failed`), { description: result.error });
    }
  };

  const counts = useMemo(() => {
    let active = 0;
    let completed = 0;
    let failed = 0;

    for (const item of downloads) {
      if (item.status === 'downloading' || item.status === 'paused') active += 1;
      else if (item.status === 'completed') completed += 1;
      else failed += 1;
    }

    return {
      all: downloads.length,
      active,
      completed,
      failed,
    };
  }, [downloads]);

  const filteredDownloads = useMemo(() => {
    const tabFiltered =
      activeTab === 'all'
        ? downloads
        : activeTab === 'active'
          ? downloads.filter((d) => d.status === 'downloading' || d.status === 'paused')
          : activeTab === 'completed'
            ? downloads.filter((d) => d.status === 'completed')
            : downloads.filter((d) => d.status === 'failed' || d.status === 'cancelled');

    const query = searchQuery.trim().toLowerCase();
    const searchFiltered =
      query.length > 0
        ? tabFiltered.filter((item) => {
            const host = hostnameFromUrl(item.url);
            return (
              item.fileName.toLowerCase().includes(query) ||
              item.url.toLowerCase().includes(query) ||
              host.toLowerCase().includes(query) ||
              (item.error?.toLowerCase().includes(query) ?? false)
            );
          })
        : tabFiltered;

    return [...searchFiltered].sort((a, b) => {
      const statusDiff = statusPriority(a.status) - statusPriority(b.status);
      if (statusDiff !== 0) return statusDiff;
      if (b.updatedAt !== a.updatedAt) return b.updatedAt - a.updatedAt;
      return b.enclosureId - a.enclosureId;
    });
  }, [activeTab, downloads, searchQuery]);

  const totalDownloadedBytes = useMemo(
    () =>
      downloads
        .filter((item) => item.status === 'completed')
        .reduce((sum, item) => sum + Math.max(item.totalBytes, item.downloadedBytes), 0),
    [downloads]
  );

  const hasClearable =
    activeTab === 'completed'
      ? counts.completed > 0
      : activeTab === 'failed'
        ? counts.failed > 0
        : counts.completed + counts.failed > 0;

  const handleClearTab = async () => {
    if (activeTab === 'completed') {
      setDownloads((prev) => prev.filter((d) => d.status !== 'completed'));
      await commands.clearDownloads('completed');
      return;
    }

    if (activeTab === 'failed') {
      setDownloads((prev) => prev.filter((d) => d.status !== 'failed' && d.status !== 'cancelled'));
      await commands.clearDownloads('failed');
      await commands.clearDownloads('cancelled');
      return;
    }

    setDownloads((prev) => prev.filter((d) => d.status === 'downloading' || d.status === 'paused'));
    await commands.clearDownloads(null);
  };

  const tabs: { key: FilterTab; label: string; count: number }[] = [
    { key: 'all', label: _(msg`All`), count: counts.all },
    { key: 'active', label: _(msg`Active`), count: counts.active },
    { key: 'completed', label: _(msg`Done`), count: counts.completed },
    { key: 'failed', label: _(msg`Failed`), count: counts.failed },
  ];

  const columns: ColumnDef<DownloadItem>[] = [
    {
      accessorKey: 'fileName',
      header: _(msg`Name`),
      size: 440,
      cell: ({ row }) => {
        const item = row.original;
        const host = hostnameFromUrl(item.url);
        const displayName = item.fileName || `${_(msg`Download`)} ${item.enclosureId}`;

        return (
          <div className="flex min-w-0 items-center gap-3">
            <DownloadIcon item={item} />
            <div className="min-w-0 flex-1">
              <div className="truncate text-xs font-semibold text-foreground" title={displayName}>
                {displayName}
              </div>
              <div className="truncate text-[11px] text-muted-foreground">{host || item.url}</div>
              {(item.status === 'downloading' || item.status === 'paused') && (
                <div className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-white/10">
                  <div
                    className={cn(
                      'h-full rounded-full transition-all duration-300',
                      item.status === 'downloading' ? 'bg-cyan-400' : 'bg-amber-400'
                    )}
                    style={{ width: `${Math.min(item.progress, 100)}%` }}
                  />
                </div>
              )}
            </div>
          </div>
        );
      },
    },
    {
      accessorFn: (row) => Math.max(row.totalBytes, row.downloadedBytes),
      id: 'size',
      header: _(msg`Size`),
      size: 140,
      cell: ({ row }) => {
        const item = row.original;
        return (
          <span className="tabular-nums text-xs text-foreground/80">
            {item.totalBytes > 0
              ? formatBytes(item.totalBytes)
              : item.downloadedBytes > 0
                ? formatBytes(item.downloadedBytes)
                : '-'}
          </span>
        );
      },
    },
    {
      accessorKey: 'status',
      header: _(msg`Status`),
      size: 170,
      sortingFn: (a, b) => a.original.status.localeCompare(b.original.status),
      cell: ({ row }) => {
        const item = row.original;
        const statusLabel =
          item.status === 'downloading'
            ? _(msg`Downloading`)
            : item.status === 'paused'
              ? _(msg`Paused`)
              : item.status === 'completed'
                ? _(msg`Done`)
                : item.status === 'failed'
                  ? _(msg`Failed`)
                  : _(msg`Cancelled`);

        const pill = (
          <span
            className={cn(
              'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold leading-none',
              item.status === 'completed' && 'bg-fuchsia-500/20 text-fuchsia-200',
              item.status === 'downloading' && 'bg-cyan-500/20 text-cyan-200',
              item.status === 'paused' && 'bg-amber-500/20 text-amber-200',
              (item.status === 'failed' || item.status === 'cancelled') &&
                'bg-destructive/20 text-destructive'
            )}
          >
            {(item.status === 'failed' || item.status === 'cancelled') && item.error && (
              <HugeiconsIcon icon={AlertCircleIcon} className="size-3" />
            )}
            {statusLabel}
          </span>
        );

        return (
          <div className="flex items-center gap-2">
            {(item.status === 'failed' || item.status === 'cancelled') && item.error ? (
              <Tooltip>
                <TooltipTrigger>{pill}</TooltipTrigger>
                <TooltipPanel className="max-w-64 text-xs">{item.error}</TooltipPanel>
              </Tooltip>
            ) : (
              pill
            )}
            {item.status === 'downloading' ? (
              <span className="text-xs tabular-nums text-muted-foreground">{item.progress}%</span>
            ) : null}
          </div>
        );
      },
    },
    {
      accessorFn: (row) => row.eta || '',
      id: 'timeLeft',
      header: () => (
        <span className="inline-flex items-center gap-1.5">
          <HugeiconsIcon icon={Clock01Icon} className="size-3.5" />
          {_(msg`Time Left`)}
        </span>
      ),
      size: 150,
      cell: ({ row }) => {
        const item = row.original;
        const value =
          item.status === 'completed'
            ? _(msg`0 sec`)
            : item.status === 'downloading'
              ? item.eta || formatSpeed(item.speed) || '-'
              : item.status === 'paused'
                ? item.eta || '-'
                : '-';

        return <span className="text-xs text-foreground/75">{value}</span>;
      },
    },
    {
      accessorFn: (row) => row.updatedAt,
      id: 'updatedAt',
      header: _(msg`Last Modified`),
      size: 170,
      cell: ({ row }) => {
        const item = row.original;
        return (
          <span className="tabular-nums text-xs text-foreground/75">
            {formatDate(item.updatedAt)}
          </span>
        );
      },
    },
    {
      id: 'actions',
      enableSorting: false,
      header: '',
      size: 190,
      cell: ({ row }) => {
        const item = row.original;

        return (
          <div className="flex items-center justify-end gap-1">
            {item.status === 'completed' ? (
              <>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="size-7 rounded-lg bg-white/[0.03] hover:bg-white/[0.08]"
                  title={_(msg`Open`)}
                  onClick={() =>
                    item.filePath ? handleOpenFile(item.filePath) : handleCopyUrl(item.url)
                  }
                >
                  <HugeiconsIcon icon={ViewIcon} className="size-4" />
                </Button>
                {item.filePath ? (
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    className="size-7 rounded-lg bg-white/[0.03] hover:bg-white/[0.08]"
                    title={_(msg`Show in folder`)}
                    onClick={() => handleOpenFolder(item.filePath as string)}
                  >
                    <HugeiconsIcon icon={FolderOpenIcon} className="size-4" />
                  </Button>
                ) : null}
                {inferMediaType(item.fileName) === 'audio' ? (
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    className="size-7 rounded-lg bg-white/[0.03] hover:bg-white/[0.08]"
                    title={_(msg`Play`)}
                    onClick={() => handlePlay(item)}
                  >
                    <HugeiconsIcon icon={PlayIcon} className="size-4" />
                  </Button>
                ) : null}
              </>
            ) : null}

            {item.status === 'downloading' ? (
              <>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="size-7 rounded-lg bg-white/[0.03] hover:bg-white/[0.08]"
                  title={_(msg`Pause`)}
                  onClick={() => handlePause(item)}
                >
                  <HugeiconsIcon icon={PauseIcon} className="size-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="size-7 rounded-lg bg-white/[0.03] hover:bg-white/[0.08]"
                  title={_(msg`Stop`)}
                  onClick={() => handleCancel(item)}
                >
                  <HugeiconsIcon icon={Cancel01Icon} className="size-4" />
                </Button>
              </>
            ) : null}

            {item.status === 'paused' ? (
              <>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="size-7 rounded-lg bg-white/[0.03] hover:bg-white/[0.08]"
                  title={_(msg`Resume`)}
                  onClick={() => handleResume(item)}
                >
                  <HugeiconsIcon icon={PlayIcon} className="size-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="size-7 rounded-lg bg-white/[0.03] hover:bg-white/[0.08]"
                  title={_(msg`Stop`)}
                  onClick={() => handleCancel(item)}
                >
                  <HugeiconsIcon icon={Cancel01Icon} className="size-4" />
                </Button>
              </>
            ) : null}

            {(item.status === 'failed' || item.status === 'cancelled') && (
              <Button
                variant="ghost"
                size="icon-sm"
                className="size-7 rounded-lg bg-white/[0.03] hover:bg-white/[0.08]"
                title={_(msg`Retry`)}
                onClick={() => handleRetry(item)}
              >
                <HugeiconsIcon icon={RefreshIcon} className="size-4" />
              </Button>
            )}

            <Button
              variant="ghost"
              size="icon-sm"
              className="size-7 rounded-lg bg-white/[0.03] hover:bg-white/[0.08]"
              title={_(msg`Remove`)}
              onClick={() => handleRemove(item.enclosureId)}
            >
              <HugeiconsIcon icon={Delete02Icon} className="size-4" />
            </Button>
          </div>
        );
      },
    },
  ];

  const emptyMessage =
    searchQuery.trim().length > 0
      ? _(msg`No downloads match your search`)
      : activeTab === 'all'
        ? _(msg`No downloads yet`)
        : activeTab === 'active'
          ? _(msg`No active downloads`)
          : activeTab === 'completed'
            ? _(msg`No completed downloads`)
            : _(msg`No failed downloads`);

  return (
    <Dialog open={downloadsOpen} onOpenChange={setDownloadsOpen}>
      <DialogContent
        className="flex h-[min(82vh,800px)] flex-col gap-0 overflow-hidden border border-border/60 bg-background/90 p-0 shadow-2xl supports-[backdrop-filter]:bg-background/75 supports-[backdrop-filter]:backdrop-blur-xl sm:max-w-[min(92vw,1320px)] rounded-xl"
        showCloseButton={false}
      >
        <DialogDescription className="sr-only">
          {_(msg`View and manage your downloads`)}
        </DialogDescription>

        <button
          type="button"
          onClick={() => setDownloadsOpen(false)}
          className="absolute top-3 right-3 z-20 inline-flex size-8 items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-white/[0.06] hover:text-foreground"
          aria-label={_(msg`Close`)}
        >
          <HugeiconsIcon icon={Cancel01Icon} className="size-4" />
        </button>

        <div className="px-6 pt-2.5 pb-4">
          <DialogTitle className="text-center text-base font-semibold tracking-tight">
            {_(msg`Downloads`)}
          </DialogTitle>
        </div>

        <div className="flex items-center gap-3 px-6 pb-4">
          <div className="relative min-w-0 w-[420px] max-w-[48%]">
            <HugeiconsIcon
              icon={Search01Icon}
              className="pointer-events-none absolute top-1/2 left-3 size-5 -translate-y-1/2 text-muted-foreground"
            />
            <Input
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder={_(msg`Search in downloads`)}
              className="h-8 rounded-md border-white/12 bg-white/[0.04] pl-9 text-xs"
            />
          </div>

          <Tabs
            value={activeTab}
            onValueChange={(value) => setActiveTab(value as FilterTab)}
            className="min-w-0 flex-1 gap-0"
          >
            <TabsList className="h-8 rounded-lg border border-white/10 bg-white/[0.03] px-1">
              {tabs.map((tab) => (
                <TabsTab
                  key={tab.key}
                  value={tab.key}
                  className="min-w-[68px] rounded-lg px-2 text-xs"
                >
                  <span>{tab.label}</span>
                  <span className="tabular-nums text-muted-foreground">{tab.count}</span>
                </TabsTab>
              ))}
            </TabsList>
          </Tabs>

          <Button
            variant="outline"
            className="h-8 shrink-0 items-center rounded-md px-3 text-xs"
            onClick={handleClearTab}
            disabled={!hasClearable}
          >
            <HugeiconsIcon icon={Delete02Icon} className="!size-3.5 shrink-0" />
            <span>{_(msg`Clear`)}</span>
          </Button>
        </div>

        <div className="flex min-h-0 flex-1 flex-col px-4 pb-4">
          <DataTable
            columns={columns}
            data={filteredDownloads}
            className="mt-3 min-h-0 flex-1 gap-3"
            showPagination
            compactPagination
            pageSize={10}
            pageSizeOptions={[10, 20, 30, 50]}
            emptyMessage={emptyMessage}
            tableFrameClassName="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border-white/10 bg-black/20 backdrop-blur-xl"
            tableClassName="[border-collapse:separate] border-separate [border-spacing:0_10px] w-[calc(100%-24px)] mx-3 [&_thead_th]:px-4 [&_thead_th]:text-[11px] [&_thead_th]:font-medium [&_tbody_td]:px-4 [&_tbody_td]:py-3 [&_tbody_td:first-child]:rounded-l-xl [&_tbody_td:last-child]:rounded-r-xl"
            getRowProps={(row) => ({
              className: cn(
                'border border-white/5 transition-colors hover:bg-white/[0.04]',
                (row.original.status === 'failed' || row.original.status === 'cancelled') &&
                  'border-destructive/35 hover:bg-destructive/[0.14]'
              ),
            })}
            footerLeftContent={
              <span className="text-xs text-muted-foreground">
                {filteredDownloads.length} {_(msg`records`)} · {_(msg`Total downloaded:`)}{' '}
                <span className="font-semibold text-foreground">
                  {formatBytes(totalDownloadedBytes)}
                </span>
              </span>
            }
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
