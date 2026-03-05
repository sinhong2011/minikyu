import {
  AlertCircleIcon,
  ArrowDown01Icon,
  Cancel01Icon,
  Clock01Icon,
  Download01Icon,
  HeadphonesIcon,
  Image01Icon,
  Menu01Icon,
  PauseIcon,
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
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from '@/components/ui/context-menu';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { commands } from '@/lib/tauri-bindings';
import { cn } from '@/lib/utils';
import { usePlayerStore } from '@/store/player-store';
import { useUIStore } from '@/store/ui-store';

// ── Types ────────────────────────────────────────────────────────────

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

function formatEta(remainingBytes: number, speedBps: number): string {
  if (!speedBps || speedBps <= 0 || remainingBytes <= 0) return '';
  const seconds = Math.ceil(remainingBytes / speedBps);
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.ceil(seconds / 60)}m`;
  const h = Math.floor(seconds / 3600);
  const m = Math.ceil((seconds % 3600) / 60);
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
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

  const radius = 15;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (item.progress / 100) * circumference;

  const isDone = item.status === 'completed';
  const isFailed = item.status === 'failed';
  const isActive = item.status === 'downloading';
  const isCancelled = item.status === 'cancelled';
  const isPaused = item.status === 'paused';

  return (
    <div className="relative flex size-9 shrink-0 items-center justify-center">
      <div
        className={cn(
          'flex size-9 items-center justify-center rounded-xl',
          isActive && 'bg-foreground/[0.06]',
          isDone && 'bg-emerald-500/10',
          isFailed && 'bg-destructive/8',
          isCancelled && 'bg-foreground/[0.04]',
          isPaused && 'bg-amber-500/10',
          !isActive && !isDone && !isFailed && !isCancelled && !isPaused && 'bg-foreground/[0.04]'
        )}
      >
        <HugeiconsIcon
          icon={icon}
          className={cn(
            'size-4',
            isActive && 'text-foreground/60',
            isDone && 'text-emerald-600/70 dark:text-emerald-400/70',
            isFailed && 'text-destructive/60',
            isCancelled && 'text-muted-foreground/40',
            isPaused && 'text-amber-600/60 dark:text-amber-400/60'
          )}
        />
      </div>

      {isActive && (
        <svg className="pointer-events-none absolute inset-0" viewBox="0 0 36 36" aria-hidden>
          <circle
            cx="18"
            cy="18"
            r={radius}
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            className="text-foreground/[0.06]"
          />
          <circle
            cx="18"
            cy="18"
            r={radius}
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            className="text-foreground/40 transition-[stroke-dashoffset] duration-500 ease-out"
            style={{ transform: 'rotate(-90deg)', transformOrigin: '50% 50%' }}
          />
        </svg>
      )}
    </div>
  );
}

function DownloadRow({
  item,
  compact,
  tabIndex,
  rowRef,
  onOpenFile,
  onOpenFolder,
  onCopyUrl,
  onCancel,
  onPause,
  onResume,
  onRetry,
  onRemove,
  onPlay,
}: {
  item: DownloadItem;
  compact?: boolean;
  tabIndex?: number;
  rowRef?: React.Ref<HTMLDivElement>;
  onOpenFile: (path: string) => void;
  onOpenFolder: (path: string) => void;
  onCopyUrl: (url: string) => void;
  onCancel: (item: DownloadItem) => void;
  onPause: (item: DownloadItem) => void;
  onResume: (item: DownloadItem) => void;
  onRetry: (item: DownloadItem) => void;
  onRemove: (id: number) => void;
  onPlay: (item: DownloadItem) => void;
}) {
  const { _ } = useLingui();
  const ext = getFileExt(item.fileName);
  const host = hostnameFromUrl(item.url);
  const displayName = item.fileName || `Download ${item.enclosureId}`;

  return (
    <ContextMenu>
      <ContextMenuTrigger>
        <motion.div
          ref={rowRef}
          role="option"
          tabIndex={tabIndex}
          layout
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.2 }}
          className={cn(
            'relative flex items-center outline-none transition-colors',
            'hover:bg-foreground/[0.03]',
            'focus-visible:ring-1 focus-visible:ring-ring',
            compact ? 'gap-2 rounded-lg px-3 py-1.5' : 'gap-3 rounded-xl px-3 py-3'
          )}
        >
          {compact ? (
            <>
              <DownloadIcon item={item} />
              <span className="min-w-0 flex-1 truncate text-sm" title={displayName}>
                {displayName}
              </span>
              {item.status === 'downloading' && (
                <span className="shrink-0 tabular-nums text-xs text-muted-foreground">
                  {item.progress}%
                </span>
              )}
              {item.status === 'paused' && (
                <span className="shrink-0 text-xs text-amber-500/80">{_(msg`Paused`)}</span>
              )}
              {item.status === 'failed' && (
                <span className="shrink-0 text-xs text-destructive/80">{_(msg`Failed`)}</span>
              )}
              {item.status === 'completed' && (
                <HugeiconsIcon
                  icon={Tick02Icon}
                  className="size-3.5 shrink-0 text-emerald-500/70"
                />
              )}
            </>
          ) : (
            <>
              <DownloadIcon item={item} />

              <div className="min-w-0 flex-1">
                {/* Title + primary action */}
                <div className="flex items-center gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span
                        className="truncate text-[13px] font-medium leading-snug"
                        title={displayName}
                      >
                        {displayName}
                      </span>
                      {ext && (
                        <span className="shrink-0 rounded bg-foreground/[0.04] px-1 py-px text-[9px] font-semibold uppercase tracking-wider text-muted-foreground/50">
                          {ext}
                        </span>
                      )}
                    </div>
                    {host && (
                      <span className="block truncate text-[11px] text-muted-foreground/50">
                        {host}
                      </span>
                    )}
                  </div>

                  {/* Single primary action */}
                  {item.status === 'downloading' && (
                    <button
                      type="button"
                      onClick={() => onPause(item)}
                      className="flex size-6 shrink-0 items-center justify-center rounded-full bg-foreground/[0.04] text-muted-foreground/60 transition-colors hover:bg-foreground/10 hover:text-foreground"
                      title={_(msg`Pause`)}
                    >
                      <HugeiconsIcon icon={PauseIcon} className="size-3" />
                    </button>
                  )}
                  {item.status === 'paused' && (
                    <button
                      type="button"
                      onClick={() => onResume(item)}
                      className="flex size-6 shrink-0 items-center justify-center rounded-full bg-foreground/[0.04] text-muted-foreground/60 transition-colors hover:bg-foreground/10 hover:text-foreground"
                      title={_(msg`Resume`)}
                    >
                      <HugeiconsIcon icon={PlayIcon} className="size-3" />
                    </button>
                  )}
                  {(item.status === 'failed' || item.status === 'cancelled') && (
                    <button
                      type="button"
                      onClick={() => onRetry(item)}
                      className="flex size-6 shrink-0 items-center justify-center rounded-full bg-foreground/[0.04] text-muted-foreground/60 transition-colors hover:bg-foreground/10 hover:text-foreground"
                      title={_(msg`Retry`)}
                    >
                      <HugeiconsIcon icon={RefreshIcon} className="size-3" />
                    </button>
                  )}
                  {item.status === 'completed' && (
                    <button
                      type="button"
                      onClick={() =>
                        item.filePath ? onOpenFile(item.filePath) : onCopyUrl(item.url)
                      }
                      className="flex size-6 shrink-0 items-center justify-center rounded-full bg-foreground/[0.04] text-muted-foreground/60 transition-colors hover:bg-foreground/10 hover:text-foreground"
                      title={item.filePath ? _(msg`Open`) : _(msg`Copy URL`)}
                    >
                      <HugeiconsIcon icon={ViewIcon} className="size-3" />
                    </button>
                  )}
                </div>

                {/* Progress bar — active/paused downloads */}
                {(item.status === 'downloading' || item.status === 'paused') && (
                  <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-foreground/[0.06]">
                    <div
                      className={cn(
                        'h-full rounded-full transition-[width] duration-500 ease-out',
                        item.status === 'downloading' && 'bg-foreground/35',
                        item.status === 'paused' && 'bg-amber-500/40'
                      )}
                      style={{ width: `${item.progress}%` }}
                    />
                  </div>
                )}

                {/* Stat badges — pill style */}
                <div className="mt-1.5 flex flex-wrap items-center gap-1">
                  {item.status === 'downloading' && (
                    <>
                      <span className="inline-flex items-center gap-1 rounded-full bg-foreground/[0.04] px-1.5 py-0.5 text-[10px] tabular-nums text-muted-foreground/70">
                        <HugeiconsIcon icon={ArrowDown01Icon} className="size-2.5" />
                        {formatBytes(item.downloadedBytes)}
                        {item.totalBytes > 0 && ` / ${formatBytes(item.totalBytes)}`}
                      </span>
                      {item.speed !== undefined && item.speed > 0 && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-foreground/[0.04] px-1.5 py-0.5 text-[10px] tabular-nums text-foreground/60">
                          {formatSpeed(item.speed)}
                        </span>
                      )}
                      {item.eta && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-foreground/[0.04] px-1.5 py-0.5 text-[10px] tabular-nums text-muted-foreground/70">
                          <HugeiconsIcon icon={Clock01Icon} className="size-2.5" />
                          {item.eta}
                        </span>
                      )}
                    </>
                  )}
                  {item.status === 'paused' && (
                    <>
                      <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-medium text-amber-600/80 dark:text-amber-400/80">
                        {_(msg`Paused`)} · {item.progress}%
                      </span>
                      <span className="inline-flex items-center gap-1 rounded-full bg-foreground/[0.04] px-1.5 py-0.5 text-[10px] tabular-nums text-muted-foreground/70">
                        {formatBytes(item.downloadedBytes)}
                        {item.totalBytes > 0 && ` / ${formatBytes(item.totalBytes)}`}
                      </span>
                    </>
                  )}
                  {item.status === 'completed' && item.totalBytes > 0 && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-1.5 py-0.5 text-[10px] tabular-nums text-emerald-600/80 dark:text-emerald-400/70">
                      <HugeiconsIcon icon={Tick02Icon} className="size-2.5" />
                      {formatBytes(item.totalBytes)}
                    </span>
                  )}
                  {item.status === 'failed' && (
                    <span
                      className="inline-flex max-w-full items-center gap-1 truncate rounded-full bg-destructive/10 px-1.5 py-0.5 text-[10px] text-destructive/80"
                      title={item.error}
                    >
                      <HugeiconsIcon icon={AlertCircleIcon} className="size-2.5 shrink-0" />
                      <span className="truncate">{item.error || _(msg`Download failed`)}</span>
                    </span>
                  )}
                  {item.status === 'cancelled' && (
                    <span className="inline-flex items-center rounded-full bg-foreground/[0.04] px-1.5 py-0.5 text-[10px] text-muted-foreground/60">
                      {_(msg`Cancelled`)}
                    </span>
                  )}
                </div>
              </div>
            </>
          )}
        </motion.div>
      </ContextMenuTrigger>
      <ContextMenuContent className="w-48">
        {item.status === 'downloading' && (
          <>
            <ContextMenuItem onClick={() => onPause(item)}>{_(msg`Pause`)}</ContextMenuItem>
            <ContextMenuItem variant="destructive" onClick={() => onCancel(item)}>
              {_(msg`Cancel`)}
            </ContextMenuItem>
          </>
        )}
        {item.status === 'paused' && (
          <>
            <ContextMenuItem onClick={() => onResume(item)}>{_(msg`Resume`)}</ContextMenuItem>
            <ContextMenuItem variant="destructive" onClick={() => onCancel(item)}>
              {_(msg`Cancel`)}
            </ContextMenuItem>
          </>
        )}
        {item.status === 'completed' && (
          <>
            {item.filePath && (
              <>
                <ContextMenuItem onClick={() => onOpenFile(item.filePath as string)}>
                  {_(msg`Open File`)}
                </ContextMenuItem>
                <ContextMenuItem onClick={() => onOpenFolder(item.filePath as string)}>
                  {_(msg`Show in folder`)}
                </ContextMenuItem>
              </>
            )}
            {inferMediaType(item.fileName) === 'audio' && (
              <ContextMenuItem onClick={() => onPlay(item)}>{_(msg`Play`)}</ContextMenuItem>
            )}
            <ContextMenuSeparator />
            <ContextMenuItem variant="destructive" onClick={() => onRemove(item.enclosureId)}>
              {_(msg`Remove`)}
            </ContextMenuItem>
          </>
        )}
        {(item.status === 'failed' || item.status === 'cancelled') && (
          <>
            <ContextMenuItem onClick={() => onRetry(item)}>{_(msg`Retry`)}</ContextMenuItem>
            <ContextMenuSeparator />
            <ContextMenuItem variant="destructive" onClick={() => onRemove(item.enclosureId)}>
              {_(msg`Remove`)}
            </ContextMenuItem>
          </>
        )}
        <ContextMenuSeparator />
        <ContextMenuItem onClick={() => onCopyUrl(item.url)}>{_(msg`Copy URL`)}</ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}

// ── Main component ───────────────────────────────────────────────────

export function DownloadManagerDialog() {
  const { _ } = useLingui();
  const [downloads, setDownloads] = useState<DownloadItem[]>([]);
  const [activeTab, setActiveTab] = useState<FilterTab>('all');
  const downloadsOpen = useUIStore((state) => state.downloadsOpen);
  const setDownloadsOpen = useUIStore((state) => state.setDownloadsOpen);
  const compact = useUIStore((state) => state.downloadsCompact);
  const toggleCompact = useUIStore((state) => state.toggleDownloadsCompact);
  const speedRef = useRef<Record<number, { bytes: number; time: number; ema: number }>>({});
  const completedRef = useRef<Set<number>>(new Set());
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const rowRefs = useRef<(HTMLDivElement | null)[]>([]);

  // ── Data loading & event listening ──

  useEffect(() => {
    let unlisten: (() => void) | null = null;

    const setup = async () => {
      try {
        const result = await commands.getDownloadsFromDb();
        if (result.status === 'ok') {
          const mapped = result.data.map((h): DownloadItem => {
            if ('Downloading' in h) {
              const d = h.Downloading;
              return {
                enclosureId: Number(d.id),
                url: d.url,
                fileName: d.url.split('/').pop() ?? '',
                status: 'downloading',
                progress: d.progress,
                downloadedBytes: Number(d.downloaded_bytes),
                totalBytes: Number(d.total_bytes),
              };
            }
            if ('Completed' in h) {
              const d = h.Completed;
              return {
                enclosureId: Number(d.id),
                url: d.url,
                fileName: d.file_path?.split(/[/\\]/).pop() ?? '',
                status: 'completed',
                progress: d.progress,
                downloadedBytes: Number(d.total_bytes),
                totalBytes: Number(d.total_bytes),
                filePath: d.file_path,
              };
            }
            if ('Failed' in h) {
              const d = h.Failed;
              return {
                enclosureId: Number(d.id),
                url: d.url,
                fileName: d.url.split('/').pop() ?? '',
                status: 'failed',
                progress: d.progress,
                downloadedBytes: 0,
                totalBytes: 0,
                error: d.error,
              };
            }
            if ('Paused' in h) {
              const d = h.Paused;
              return {
                enclosureId: Number(d.id),
                url: d.url,
                fileName: d.url.split('/').pop() ?? '',
                status: 'paused',
                progress: d.progress,
                downloadedBytes: Number(d.downloaded_bytes),
                totalBytes: Number(d.total_bytes),
              };
            }
            const d = h.Cancelled;
            return {
              enclosureId: Number(d.id),
              url: d.url,
              fileName: d.url.split('/').pop() ?? '',
              status: 'cancelled',
              progress: d.progress,
              downloadedBytes: 0,
              totalBytes: 0,
            };
          });

          // Mark stale "downloading" items as failed (interrupted by app close)
          const cleaned = mapped.map((item) =>
            item.status === 'downloading'
              ? {
                  ...item,
                  status: 'failed' as DownloadStatus,
                  error: 'Interrupted — app was closed',
                }
              : item
          );

          setDownloads(cleaned);
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
          const last = speedRef.current[enclosure_id];
          let speed = 0;
          const EmaAlpha = 0.3;
          if (last && status === 'downloading') {
            const timeDiff = (now - last.time) / 1000;
            if (timeDiff > 0.25) {
              const instantSpeed = (downloaded_bytes - last.bytes) / timeDiff;
              const ema =
                last.ema > 0 ? EmaAlpha * instantSpeed + (1 - EmaAlpha) * last.ema : instantSpeed;
              speed = ema;
              speedRef.current[enclosure_id] = { bytes: downloaded_bytes, time: now, ema };
            } else {
              speed = -1; // keep previous speed
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
  }, []);

  // ── Computed ──

  const counts = useMemo(() => {
    let active = 0;
    let completed = 0;
    let failed = 0;
    for (const d of downloads) {
      if (d.status === 'downloading' || d.status === 'paused') active++;
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
          ? downloads.filter((d) => d.status === 'downloading' || d.status === 'paused')
          : activeTab === 'completed'
            ? downloads.filter((d) => d.status === 'completed')
            : downloads.filter((d) => d.status === 'failed' || d.status === 'cancelled');

    const isActive = (s: DownloadStatus) => s === 'downloading' || s === 'paused';
    // Active downloads first, then recent first
    return [...list].sort((a, b) => {
      if (isActive(a.status) && !isActive(b.status)) return -1;
      if (!isActive(a.status) && isActive(b.status)) return 1;
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

  const handleListKeyDown = (e: React.KeyboardEvent) => {
    const maxIndex = filtered.length - 1;
    if (maxIndex < 0) return;

    switch (e.key) {
      case 'ArrowDown': {
        e.preventDefault();
        const next = Math.min(focusedIndex + 1, maxIndex);
        setFocusedIndex(next);
        rowRefs.current[next]?.focus();
        break;
      }
      case 'ArrowUp': {
        e.preventDefault();
        const prev = Math.max(focusedIndex - 1, 0);
        setFocusedIndex(prev);
        rowRefs.current[prev]?.focus();
        break;
      }
      case 'Enter': {
        e.preventDefault();
        const item = filtered[focusedIndex];
        if (!item) break;
        if (item.status === 'completed' && item.filePath) handleOpenFile(item.filePath);
        else if (item.status === 'failed' || item.status === 'cancelled') handleRetry(item);
        break;
      }
      case 'Delete':
      case 'Backspace': {
        e.preventDefault();
        const item = filtered[focusedIndex];
        if (!item) break;
        if (item.status !== 'downloading' && item.status !== 'paused') {
          handleRemove(item.enclosureId);
        }
        break;
      }
      case ' ': {
        e.preventDefault();
        const item = filtered[focusedIndex];
        if (!item) break;
        if (item.status === 'downloading') handlePause(item);
        else if (item.status === 'paused') handleResume(item);
        break;
      }
    }
  };

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
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={toggleCompact}
              className="flex size-7 items-center justify-center rounded-full text-muted-foreground/50 transition-colors hover:bg-foreground/5 hover:text-foreground"
              title={compact ? _(msg`Expanded view`) : _(msg`Compact view`)}
            >
              <HugeiconsIcon icon={compact ? ViewIcon : Menu01Icon} className="size-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setDownloadsOpen(false)}
              className="flex size-7 items-center justify-center rounded-full text-muted-foreground/50 transition-colors hover:bg-foreground/5 hover:text-foreground"
            >
              <HugeiconsIcon icon={Cancel01Icon} className="size-3.5" />
            </button>
          </div>
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
        <div
          role="listbox"
          className="flex flex-1 flex-col gap-1 overflow-y-auto px-2 py-1"
          onKeyDown={handleListKeyDown}
        >
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
              {filtered.map((dl, i) => (
                <DownloadRow
                  key={dl.enclosureId}
                  item={dl}
                  compact={compact}
                  tabIndex={i === focusedIndex ? 0 : -1}
                  rowRef={(el) => {
                    rowRefs.current[i] = el;
                  }}
                  onOpenFile={handleOpenFile}
                  onOpenFolder={handleOpenFolder}
                  onCopyUrl={handleCopyUrl}
                  onCancel={handleCancel}
                  onPause={handlePause}
                  onResume={handleResume}
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
