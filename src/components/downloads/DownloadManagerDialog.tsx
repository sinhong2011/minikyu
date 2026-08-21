import {
  AlertCircleIcon,
  Cancel01Icon,
  Clock01Icon,
  CloudDownloadIcon,
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
import { copyText } from '@/lib/shell';
import { openPath, revealItemInDir } from '@tauri-apps/plugin-opener';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Tabs, TabsList, TabsTab } from '@/components/animate-ui/components/base/tabs';
import { Button } from '@/components/ui/button';
import { DataTable, type DataTableColumnDef, type DataTableRow } from '@/components/ui/data-table';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Tooltip, TooltipPanel, TooltipTrigger } from '@/components/ui/tooltip';
import { commands } from '@/lib/tauri-bindings';
import { installAndRelaunch } from '@/lib/updater';
import { cn } from '@/lib/utils';
import {
  type DownloadItem,
  type DownloadStatus,
  useClearDownloads,
  useDownloads,
  useRemoveDownload,
} from '@/services/downloads';
import { usePlayerStore } from '@/store/player-store';
import { useUIStore } from '@/store/ui-store';
import { useUpdaterStore } from '@/store/updater-store';

type FilterTab = 'all' | 'active' | 'completed' | 'failed';

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

const UPDATER_SENTINEL_ID = -1;

const MEDIA_ICONS = {
  audio: HeadphonesIcon,
  image: Image01Icon,
  video: Video01Icon,
  file: Download01Icon,
} as const;

function DownloadIcon({ item }: { item: DownloadItem }) {
  const isUpdater = item.enclosureId === UPDATER_SENTINEL_ID;
  const type = inferMediaType(item.fileName);
  const icon = isUpdater ? CloudDownloadIcon : MEDIA_ICONS[type];

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
  const [activeTab, setActiveTab] = useState<FilterTab>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const downloadsOpen = useUIStore((state) => state.downloadsOpen);
  const setDownloadsOpen = useUIStore((state) => state.setDownloadsOpen);
  const updaterStatus = useUpdaterStore((state) => state.status);
  const updaterVersion = useUpdaterStore((state) =>
    'version' in state ? (state as { version: string }).version : ''
  );
  const updaterProgress = useUpdaterStore((state) =>
    'progress' in state ? (state as { progress: number }).progress : 0
  );

  // History and live progress both come from the shared download cache, which
  // the app shell keeps subscribed to the downloader's events — this dialog is
  // a pure reader of it.
  const { data: downloads = [] } = useDownloads();
  const removeDownload = useRemoveDownload();
  const clearDownloads = useClearDownloads();

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
    await copyText(url);
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

  const handleRemove = (id: number) => {
    if (id === UPDATER_SENTINEL_ID) return;
    removeDownload.mutate(id);
  };

  const handleCancel = async (dl: DownloadItem) => {
    if (dl.enclosureId === UPDATER_SENTINEL_ID) return;
    if (dl.status !== 'downloading' && dl.status !== 'paused') return;
    const result = await commands.cancelDownload(dl.url);
    if (result.status === 'error') {
      toast.error(_(msg`Failed to cancel download`));
    }
  };

  const handlePause = async (dl: DownloadItem) => {
    if (dl.enclosureId === UPDATER_SENTINEL_ID) return;
    if (dl.status !== 'downloading') return;
    const result = await commands.pauseDownload(dl.url);
    if (result.status === 'error') {
      toast.error(_(msg`Failed to pause download`));
    }
  };

  const handleResume = async (dl: DownloadItem) => {
    if (dl.enclosureId === UPDATER_SENTINEL_ID) return;
    if (dl.status !== 'paused') return;
    const mediaType = dl.mediaType ?? (inferMediaType(dl.fileName) === 'audio' ? 'audio' : null);
    const result = await commands.resumeDownload(dl.url, dl.fileName, mediaType);
    if (result.status === 'error') {
      toast.error(_(msg`Failed to resume download`), { description: result.error });
    }
  };

  const handleRetry = async (dl: DownloadItem) => {
    if (dl.enclosureId === UPDATER_SENTINEL_ID) return;
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

  const syntheticUpdaterEntry = useMemo((): DownloadItem | null => {
    if (updaterStatus !== 'downloading' && updaterStatus !== 'ready') return null;
    return {
      enclosureId: UPDATER_SENTINEL_ID,
      url: 'app-update',
      fileName: `Minikyu v${updaterVersion}`,
      status: updaterStatus === 'ready' ? 'completed' : 'downloading',
      progress: updaterStatus === 'ready' ? 100 : updaterProgress,
      downloadedBytes: 0,
      totalBytes: 0,
      mediaType: 'application/octet-stream',
      updatedAt: Math.floor(Date.now() / 1000),
    };
  }, [updaterStatus, updaterVersion, updaterProgress]);

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

    const sorted = [...searchFiltered].sort((a, b) => {
      const statusDiff = statusPriority(a.status) - statusPriority(b.status);
      if (statusDiff !== 0) return statusDiff;
      if (b.updatedAt !== a.updatedAt) return b.updatedAt - a.updatedAt;
      return b.enclosureId - a.enclosureId;
    });

    if (syntheticUpdaterEntry) {
      return [syntheticUpdaterEntry, ...sorted];
    }
    return sorted;
  }, [activeTab, downloads, searchQuery, syntheticUpdaterEntry]);

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

  const handleClearTab = () => {
    clearDownloads.mutate(
      activeTab === 'completed' ? 'completed' : activeTab === 'failed' ? 'failed' : 'finished'
    );
  };

  const tabs: { key: FilterTab; label: string; count: number }[] = [
    { key: 'all', label: _(msg`All`), count: counts.all },
    { key: 'active', label: _(msg`Active`), count: counts.active },
    { key: 'completed', label: _(msg`Done`), count: counts.completed },
    { key: 'failed', label: _(msg`Failed`), count: counts.failed },
  ];

  const columns: DataTableColumnDef<DownloadItem>[] = [
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
      sortFn: (a: DataTableRow<DownloadItem>, b: DataTableRow<DownloadItem>) =>
        a.original.status.localeCompare(b.original.status),
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
        const isUpdater = item.enclosureId === UPDATER_SENTINEL_ID;

        if (isUpdater) {
          return (
            <div className="flex items-center justify-end gap-1">
              {item.status === 'completed' && (
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="h-7 rounded-lg bg-emerald-500/10 px-2.5 text-xs font-medium text-emerald-300 hover:bg-emerald-500/20"
                  title={_(msg`Install & Restart`)}
                  onClick={() => installAndRelaunch()}
                >
                  <HugeiconsIcon icon={CloudDownloadIcon} className="size-3.5" />
                  <span>{_(msg`Install & Restart`)}</span>
                </Button>
              )}
            </div>
          );
        }

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
