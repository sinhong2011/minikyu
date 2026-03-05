import {
  AlertCircleIcon,
  Cancel01Icon,
  Copy01Icon,
  Delete02Icon,
  Download01Icon,
  Folder01Icon,
  HeadphonesIcon,
  Image01Icon,
  PlayIcon,
  RefreshIcon,
  Tick02Icon,
  Video01Icon,
  ViewIcon,
} from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react';
import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { listen } from '@tauri-apps/api/event';
import { writeText } from '@tauri-apps/plugin-clipboard-manager';
import { openPath, revealItemInDir } from '@tauri-apps/plugin-opener';
import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { commands } from '@/lib/tauri-bindings';
import { cn } from '@/lib/utils';
import { usePlayerStore } from '@/store/player-store';
import { useUIStore } from '@/store/ui-store';

// ── Types ────────────────────────────────────────────────────────────

type DownloadStatus = 'downloading' | 'completed' | 'failed' | 'cancelled';
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
  mediaType?: string;
};

// ── Helpers ──────────────────────────────────────────────────────────

function inferMediaType(fileName: string): 'audio' | 'image' | 'video' | 'file' {
  const ext = fileName.split('.').pop()?.toLowerCase() ?? '';
  if (['mp3', 'm4a', 'aac', 'ogg', 'wav', 'flac', 'webm', 'opus'].includes(ext)) return 'audio';
  if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'avif', 'bmp'].includes(ext)) return 'image';
  if (['mp4', 'mkv', 'avi', 'mov', 'wmv'].includes(ext)) return 'video';
  return 'file';
}

function getFileExt(fileName: string): string {
  return fileName.split('.').pop()?.toUpperCase() ?? '';
}

function formatBytes(bytes: number): string {
  if (bytes <= 0) return '';
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

function hostnameFromUrl(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return '';
  }
}

// ── Sub-components ───────────────────────────────────────────────────

const MEDIA_ICONS = {
  audio: HeadphonesIcon,
  image: Image01Icon,
  video: Video01Icon,
  file: Download01Icon,
} as const;

/**
 * Safari-inspired icon with circular progress ring for active downloads,
 * checkmark overlay for completed, and alert overlay for failed.
 */
function DownloadIcon({ item }: { item: DownloadItem }) {
  const type = inferMediaType(item.fileName);
  const icon = MEDIA_ICONS[type];

  const radius = 17;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (item.progress / 100) * circumference;

  const isDone = item.status === 'completed';
  const isFailed = item.status === 'failed';
  const isActive = item.status === 'downloading';
  const isCancelled = item.status === 'cancelled';

  return (
    <div className="relative flex size-10 shrink-0 items-center justify-center">
      <div
        className={cn(
          'flex size-10 items-center justify-center rounded-full ring-1 ring-border/30 bg-muted/30',
          isActive && 'bg-accent/60 ring-foreground/10',
          isDone && 'bg-accent/40 ring-foreground/10',
          isFailed && 'bg-destructive/5 ring-destructive/15',
          isCancelled && 'bg-muted/40 ring-border/40'
        )}
      >
        <HugeiconsIcon
          icon={icon}
          className={cn(
            'size-4 text-muted-foreground',
            isActive && 'text-foreground/70',
            isDone && 'text-foreground/60',
            isFailed && 'text-destructive/70',
            isCancelled && 'text-muted-foreground/50'
          )}
        />
      </div>

      {isActive && (
        <svg className="pointer-events-none absolute inset-0" viewBox="0 0 40 40" aria-hidden>
          <circle
            cx="20"
            cy="20"
            r={radius}
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            className="text-foreground/5"
          />
          <circle
            cx="20"
            cy="20"
            r={radius}
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            className="text-foreground/50 transition-[stroke-dashoffset] duration-500 ease-out"
            style={{ transform: 'rotate(-90deg)', transformOrigin: '50% 50%' }}
          />
        </svg>
      )}

      {isDone && (
        <div className="absolute -end-0.5 -bottom-0.5 flex size-4 items-center justify-center rounded-full bg-foreground text-background shadow-sm">
          <HugeiconsIcon icon={Tick02Icon} className="size-2.5" />
        </div>
      )}
      {isFailed && (
        <div className="absolute -end-0.5 -bottom-0.5 flex size-4 items-center justify-center rounded-full bg-destructive text-destructive-foreground shadow-sm">
          <HugeiconsIcon icon={AlertCircleIcon} className="size-2.5" />
        </div>
      )}
    </div>
  );
}

function DownloadRow({
  item,
  onOpenFile,
  onOpenFolder,
  onCopyUrl,
  onCancel,
  onRetry,
  onRemove,
  onPlay,
}: {
  item: DownloadItem;
  onOpenFile: (path: string) => void;
  onOpenFolder: (path: string) => void;
  onCopyUrl: (url: string) => void;
  onCancel: (item: DownloadItem) => void;
  onRetry: (item: DownloadItem) => void;
  onRemove: (id: number) => void;
  onPlay: (item: DownloadItem) => void;
}) {
  const { _ } = useLingui();
  const ext = getFileExt(item.fileName);
  const host = hostnameFromUrl(item.url);
  const displayName = item.fileName || `Download ${item.enclosureId}`;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.2 }}
      className={cn(
        'flex items-center gap-3 rounded-xl px-3 py-2.5 transition-colors',
        'hover:bg-foreground/[0.03]',
        item.status === 'downloading' && 'bg-accent/30'
      )}
    >
      <DownloadIcon item={item} />

      <div className="min-w-0 flex-1">
        {/* Name row */}
        <div className="flex items-center gap-1.5">
          <span className="truncate text-sm font-medium leading-snug" title={displayName}>
            {displayName}
          </span>
          {ext && (
            <span className="shrink-0 rounded bg-foreground/[0.05] px-1 py-px text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">
              {ext}
            </span>
          )}
        </div>

        {/* Meta row */}
        <div className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground/70">
          {item.status === 'downloading' ? (
            <>
              <span className="tabular-nums">
                {formatBytes(item.downloadedBytes)}
                {item.totalBytes > 0 && ` / ${formatBytes(item.totalBytes)}`}
              </span>
              {item.speed !== undefined && item.speed > 0 && (
                <>
                  <span className="text-muted-foreground/30">·</span>
                  <span className="tabular-nums text-foreground/50">{formatSpeed(item.speed)}</span>
                </>
              )}
              <span className="text-muted-foreground/30">·</span>
              <span className="tabular-nums">{item.progress}%</span>
            </>
          ) : item.status === 'completed' ? (
            <>
              {item.totalBytes > 0 && (
                <span className="tabular-nums">{formatBytes(item.totalBytes)}</span>
              )}
              {host && (
                <>
                  {item.totalBytes > 0 && <span className="text-muted-foreground/30">·</span>}
                  <span className="truncate">{host}</span>
                </>
              )}
            </>
          ) : item.status === 'failed' ? (
            <span className="truncate text-destructive/80" title={item.error}>
              {item.error || _(msg`Download failed`)}
            </span>
          ) : (
            <span>{_(msg`Cancelled`)}</span>
          )}
        </div>
      </div>

      {/* Actions — always visible for primary, hover for secondary */}
      <div className="flex shrink-0 items-center">
        {item.status === 'downloading' && (
          <button
            type="button"
            onClick={() => onCancel(item)}
            className="flex size-7 items-center justify-center rounded-lg text-muted-foreground/60 transition-colors hover:bg-destructive/10 hover:text-destructive"
            title={_(msg`Cancel`)}
          >
            <HugeiconsIcon icon={Cancel01Icon} className="size-3.5" />
          </button>
        )}

        {(item.status === 'failed' || item.status === 'cancelled') && (
          <button
            type="button"
            onClick={() => onRetry(item)}
            className="flex size-7 items-center justify-center rounded-lg text-muted-foreground/60 transition-colors hover:bg-foreground/5 hover:text-foreground"
            title={_(msg`Retry`)}
          >
            <HugeiconsIcon icon={RefreshIcon} className="size-3.5" />
          </button>
        )}

        {item.status === 'completed' && inferMediaType(item.fileName) === 'audio' && (
          <button
            type="button"
            onClick={() => onPlay(item)}
            className="flex size-7 items-center justify-center rounded-lg text-muted-foreground/60 transition-colors hover:bg-foreground/5 hover:text-foreground"
            title={_(msg`Play`)}
          >
            <HugeiconsIcon icon={PlayIcon} className="size-3.5" />
          </button>
        )}

        {item.status === 'completed' && item.filePath && (
          <>
            <button
              type="button"
              onClick={() => item.filePath && onOpenFile(item.filePath)}
              className="flex size-7 items-center justify-center rounded-lg text-muted-foreground/60 transition-colors hover:bg-foreground/5 hover:text-foreground"
              title={_(msg`Open`)}
            >
              <HugeiconsIcon icon={ViewIcon} className="size-3.5" />
            </button>
            <button
              type="button"
              onClick={() => item.filePath && onOpenFolder(item.filePath)}
              className="flex size-7 items-center justify-center rounded-lg text-muted-foreground/60 transition-colors hover:bg-foreground/5 hover:text-foreground"
              title={_(msg`Show in Finder`)}
            >
              <HugeiconsIcon icon={Folder01Icon} className="size-3.5" />
            </button>
          </>
        )}

        <button
          type="button"
          onClick={() => onCopyUrl(item.url)}
          className="flex size-7 items-center justify-center rounded-lg text-muted-foreground/60 transition-colors hover:bg-foreground/5 hover:text-foreground"
          title={_(msg`Copy URL`)}
        >
          <HugeiconsIcon icon={Copy01Icon} className="size-3" />
        </button>
        <button
          type="button"
          onClick={() => onRemove(item.enclosureId)}
          className="flex size-7 items-center justify-center rounded-lg text-muted-foreground/60 transition-colors hover:bg-destructive/10 hover:text-destructive"
          title={_(msg`Remove`)}
        >
          <HugeiconsIcon icon={Delete02Icon} className="size-3" />
        </button>
      </div>
    </motion.div>
  );
}

// ── Main component ───────────────────────────────────────────────────

export function DownloadManagerDialog() {
  const { _ } = useLingui();
  const [downloads, setDownloads] = useState<DownloadItem[]>([]);
  const [activeTab, setActiveTab] = useState<FilterTab>('all');
  const downloadsOpen = useUIStore((state) => state.downloadsOpen);
  const setDownloadsOpen = useUIStore((state) => state.setDownloadsOpen);
  const lastUpdateRef = useRef<Record<number, { bytes: number; time: number }>>({});
  const completedRef = useRef<Set<number>>(new Set());

  // ── Data loading & event listening ──

  useEffect(() => {
    let unlisten: (() => void) | null = null;

    const setup = async () => {
      try {
        const result = await commands.getDownloadsFromDb();
        if (result.status === 'ok') {
          setDownloads(
            result.data.map((h: any) => {
              const variant = Object.keys(h)[0] as string;
              const data = h[variant];
              return {
                enclosureId: data.id || 0,
                url: data.url || '',
                fileName:
                  data.file_name || (data.file_path ? data.file_path.split(/[/\\]/).pop() : ''),
                status: variant.toLowerCase() as DownloadStatus,
                progress: data.progress || 0,
                downloadedBytes: data.downloaded_bytes || 0,
                totalBytes: data.total_bytes || 0,
                filePath: data.file_path,
                error: data.error,
              };
            })
          );
        }
      } catch (error) {
        console.error('Failed to load download history:', error);
      }

      try {
        const unlistenFn = await listen<{
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
        }>('download-progress', (event) => {
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
          const last = lastUpdateRef.current[enclosure_id];
          let speed = 0;
          if (last && status === 'downloading') {
            const timeDiff = (now - last.time) / 1000;
            if (timeDiff > 0.5) {
              speed = (downloaded_bytes - last.bytes) / timeDiff;
              lastUpdateRef.current[enclosure_id] = { bytes: downloaded_bytes, time: now };
            } else {
              speed = -1;
            }
          } else {
            lastUpdateRef.current[enclosure_id] = { bytes: downloaded_bytes, time: now };
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
                      filePath: file_path || d.filePath,
                      mediaType: media_type || d.mediaType,
                    }
                  : d
              );
            }
            return [
              ...prev,
              {
                enclosureId: enclosure_id,
                url: url || '',
                fileName: file_name || '',
                status: status as DownloadStatus,
                progress,
                downloadedBytes: downloaded_bytes,
                totalBytes: total_bytes,
                speed: 0,
                filePath: file_path,
                mediaType: media_type,
              },
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

  // ── Computed ──

  const counts = useMemo(() => {
    let active = 0;
    let completed = 0;
    let failed = 0;
    for (const d of downloads) {
      if (d.status === 'downloading') active++;
      else if (d.status === 'completed') completed++;
      else failed++;
    }
    return { all: downloads.length, active, completed, failed };
  }, [downloads]);

  const filtered = useMemo(() => {
    const list =
      activeTab === 'all'
        ? downloads
        : activeTab === 'active'
          ? downloads.filter((d) => d.status === 'downloading')
          : activeTab === 'completed'
            ? downloads.filter((d) => d.status === 'completed')
            : downloads.filter((d) => d.status === 'failed' || d.status === 'cancelled');

    // Active downloads first, then recent first
    return [...list].sort((a, b) => {
      if (a.status === 'downloading' && b.status !== 'downloading') return -1;
      if (a.status !== 'downloading' && b.status === 'downloading') return 1;
      return b.enclosureId - a.enclosureId;
    });
  }, [downloads, activeTab]);

  // ── Handlers ──

  const handleOpenFile = async (filePath: string) => {
    if (!filePath) return;
    try {
      await openPath(filePath);
    } catch (err) {
      toast.error(_(msg`Could not open file`));
      console.error('openPath failed:', err);
    }
  };

  const handleOpenFolder = async (filePath: string) => {
    if (!filePath) return;
    try {
      await revealItemInDir(filePath);
    } catch (err) {
      toast.error(_(msg`Could not reveal in folder`));
      console.error('revealItemInDir failed:', err);
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
    if (dl.status !== 'downloading') return;
    const result = await commands.cancelDownload(dl.url);
    if (result.status === 'error') {
      console.error('Failed to cancel download:', result.error);
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

  const handleClearTab = async () => {
    if (activeTab === 'completed') {
      setDownloads((prev) => prev.filter((d) => d.status !== 'completed'));
      await commands.clearDownloads('completed');
    } else if (activeTab === 'failed') {
      setDownloads((prev) => prev.filter((d) => d.status !== 'failed' && d.status !== 'cancelled'));
      await commands.clearDownloads('failed');
      await commands.clearDownloads('cancelled');
    } else {
      setDownloads((prev) => prev.filter((d) => d.status === 'downloading'));
      await commands.clearDownloads(null);
    }
  };

  const hasClearable =
    activeTab === 'completed'
      ? counts.completed > 0
      : activeTab === 'failed'
        ? counts.failed > 0
        : counts.completed + counts.failed > 0;

  const tabs: { key: FilterTab; label: string; count: number }[] = [
    { key: 'all', label: _(msg`All`), count: counts.all },
    { key: 'active', label: _(msg`Active`), count: counts.active },
    { key: 'completed', label: _(msg`Done`), count: counts.completed },
    { key: 'failed', label: _(msg`Failed`), count: counts.failed },
  ];

  // ── Render ──

  return (
    <Dialog open={downloadsOpen} onOpenChange={setDownloadsOpen}>
      <DialogContent
        className="flex h-[min(80vh,750px)] flex-col gap-0 overflow-hidden p-0 sm:max-w-xl sm:rounded-2xl"
        showCloseButton={false}
      >
        {/* ── Header ── */}
        <div className="flex items-center justify-between px-5 pt-5 pb-3">
          <DialogTitle className="flex items-center gap-2.5 text-base font-semibold">
            {_(msg`Downloads`)}
            {counts.active > 0 && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-foreground/5 px-2 py-0.5 text-[11px] font-semibold tabular-nums text-foreground/60">
                <span className="size-1 animate-pulse rounded-full bg-foreground/50" />
                {counts.active}
              </span>
            )}
          </DialogTitle>
          <button
            type="button"
            onClick={() => setDownloadsOpen(false)}
            className="flex size-7 items-center justify-center rounded-full text-muted-foreground/50 transition-colors hover:bg-foreground/5 hover:text-foreground"
          >
            <HugeiconsIcon icon={Cancel01Icon} className="size-3.5" />
          </button>
        </div>
        <DialogDescription className="sr-only">
          {_(msg`View and manage your downloads`)}
        </DialogDescription>

        {/* ── Filter pills ── */}
        <div className="flex items-center gap-1 px-5 pb-3">
          <div className="flex items-center gap-0.5 rounded-lg bg-foreground/[0.03] p-0.5">
            {tabs.map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveTab(tab.key)}
                className={cn(
                  'relative inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium transition-colors',
                  activeTab === tab.key
                    ? 'bg-background text-foreground shadow-sm shadow-black/[0.04]'
                    : 'text-muted-foreground/70 hover:text-foreground'
                )}
              >
                {tab.label}
                {tab.count > 0 && (
                  <span
                    className={cn(
                      'tabular-nums',
                      activeTab === tab.key ? 'text-foreground/50' : 'text-muted-foreground/40'
                    )}
                  >
                    {tab.count}
                  </span>
                )}
              </button>
            ))}
          </div>

          <div className="flex-1" />

          {hasClearable && (
            <button
              type="button"
              onClick={handleClearTab}
              className="text-xs font-medium text-muted-foreground/60 transition-colors hover:text-foreground"
            >
              {_(msg`Clear`)}
            </button>
          )}
        </div>

        {/* ── Separator ── */}
        <div className="mx-5 h-px bg-border/40" />

        {/* ── List ── */}
        <div className="flex flex-1 flex-col gap-1 overflow-y-auto px-2 py-1">
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="flex size-12 items-center justify-center rounded-2xl bg-foreground/[0.03]">
                <HugeiconsIcon icon={Download01Icon} className="size-5 text-muted-foreground/25" />
              </div>
              <p className="mt-3 text-sm font-medium text-muted-foreground/60">
                {activeTab === 'all'
                  ? _(msg`No downloads yet`)
                  : activeTab === 'active'
                    ? _(msg`No active downloads`)
                    : activeTab === 'completed'
                      ? _(msg`No completed downloads`)
                      : _(msg`No failed downloads`)}
              </p>
            </div>
          ) : (
            <AnimatePresence initial={false}>
              {filtered.map((dl) => (
                <DownloadRow
                  key={dl.enclosureId}
                  item={dl}
                  onOpenFile={handleOpenFile}
                  onOpenFolder={handleOpenFolder}
                  onCopyUrl={handleCopyUrl}
                  onCancel={handleCancel}
                  onRetry={handleRetry}
                  onRemove={handleRemove}
                  onPlay={handlePlay}
                />
              ))}
            </AnimatePresence>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
