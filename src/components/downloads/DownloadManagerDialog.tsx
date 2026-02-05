import {
  Cancel01Icon,
  Copy01Icon,
  Download01Icon,
  File01Icon,
  Folder01Icon,
  InformationCircleIcon,
  Link01Icon,
  RefreshIcon,
  ViewIcon,
} from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react';
import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { listen } from '@tauri-apps/api/event';
import { writeText } from '@tauri-apps/plugin-clipboard-manager';
import { openPath } from '@tauri-apps/plugin-opener';
import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { commands } from '@/lib/tauri-bindings';
import { cn } from '@/lib/utils';
import { useUIStore } from '@/store/ui-store';

type DownloadState = {
  enclosureId: number;
  url: string;
  fileName: string;
  status: 'downloading' | 'completed' | 'failed' | 'cancelled';
  progress: number;
  downloadedBytes: number;
  totalBytes: number;
  filePath?: string;
  error?: string;
  speed?: number;
};

export function DownloadManagerDialog() {
  const { _ } = useLingui();
  const [downloads, setDownloads] = useState<DownloadState[]>([]);
  const downloadsOpen = useUIStore((state) => state.downloadsOpen);
  const setDownloadsOpen = useUIStore((state) => state.setDownloadsOpen);
  const lastUpdateRef = useRef<Record<number, { bytes: number; time: number }>>({});
  const completedRef = useRef<Set<number>>(new Set());

  useEffect(() => {
    let unlisten: (() => void) | null = null;

    const setup = async () => {
      // Load history from DB
      try {
        const result = await commands.getDownloadsFromDb();
        if (result.status === 'ok') {
          const history = result.data;
          setDownloads(
            history.map((h: any) => {
              const variant = Object.keys(h)[0] as string;
              const data = h[variant];
              return {
                enclosureId: data.id || 0,
                url: data.url || '',
                fileName:
                  data.file_name || (data.file_path ? data.file_path.split(/[/\\]/).pop() : ''),
                status: variant.toLowerCase() as DownloadState['status'],
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
          } = event.payload;

          if (status === 'completed' && !completedRef.current.has(enclosure_id)) {
            completedRef.current.add(enclosure_id);
            toast.success(_(msg`Download Completed`), {
              description: file_name,
              action: file_path
                ? {
                    label: _(msg`Open`),
                    onClick: () => openPath(file_path),
                  }
                : undefined,
            });
          } else if (status === 'failed' && !completedRef.current.has(enclosure_id)) {
            completedRef.current.add(enclosure_id);
            toast.error(_(msg`Download Failed`), {
              description: file_name,
            });
          }

          const now = Date.now();
          const last = lastUpdateRef.current[enclosure_id];
          let speed = 0;
          if (last && status === 'downloading') {
            const timeDiff = (now - last.time) / 1000;
            if (timeDiff > 0.5) {
              speed = (downloaded_bytes - last.bytes) / timeDiff;
              lastUpdateRef.current[enclosure_id] = {
                bytes: downloaded_bytes,
                time: now,
              };
            } else {
              speed = -1;
            }
          } else {
            lastUpdateRef.current[enclosure_id] = { bytes: downloaded_bytes, time: now };
          }

          setDownloads((prev) => {
            const existingIndex = prev.findIndex((d) => d.enclosureId === enclosure_id);

            if (existingIndex !== -1) {
              return prev.map((d, i) => {
                if (i === existingIndex) {
                  return {
                    ...d,
                    fileName: file_name || d.fileName,
                    url: url || d.url,
                    progress,
                    downloadedBytes: downloaded_bytes,
                    totalBytes: total_bytes,
                    status: status as DownloadState['status'],
                    speed: speed === -1 ? d.speed : speed,
                    filePath: file_path || d.filePath,
                  };
                }
                return d;
              });
            } else {
              return [
                ...prev,
                {
                  enclosureId: enclosure_id,
                  url: url || '',
                  fileName: file_name || '',
                  status: status as DownloadState['status'],
                  progress,
                  downloadedBytes: downloaded_bytes,
                  totalBytes: total_bytes,
                  speed: 0,
                  filePath: file_path,
                },
              ];
            }
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

  const getStatusBadge = (status: DownloadState['status']) => {
    switch (status) {
      case 'downloading':
        return (
          <Badge
            variant="outline"
            className="text-blue-500 border-blue-500/30 bg-blue-500/10 animate-pulse"
          >
            {_(msg`Downloading`)}
          </Badge>
        );
      case 'completed':
        return (
          <Badge variant="outline" className="text-green-500 border-green-500/30 bg-green-500/10">
            {_(msg`Completed`)}
          </Badge>
        );
      case 'failed':
        return (
          <Badge variant="outline" className="text-red-500 border-red-500/30 bg-red-500/10">
            {_(msg`Failed`)}
          </Badge>
        );
      case 'cancelled':
        return (
          <Badge variant="outline" className="text-muted-foreground bg-muted/10">
            {_(msg`Cancelled`)}
          </Badge>
        );
      default:
        return null;
    }
  };

  const handleOpenFile = async (filePath: string) => {
    if (filePath) {
      await openPath(filePath);
    }
  };

  const handleOpenFolder = async (filePath: string) => {
    if (filePath) {
      const pathParts = filePath.split(/[/\\]/);
      pathParts.pop();
      const folderPath = pathParts.join('/');
      await openPath(folderPath);
    }
  };

  const handleCopyUrl = async (url: string) => {
    await writeText(url);
    toast.success(_(msg`URL copied to clipboard`));
  };

  const handleRemoveDownload = (id: number) => {
    setDownloads((prev) => prev.filter((d) => d.enclosureId !== id));
  };

  const handleCancelDownload = async (download: DownloadState) => {
    if (download.status === 'downloading') {
      const result = await commands.cancelDownload(download.url);
      if (result.status === 'ok') {
        console.log('Successfully cancelled download:', download);
      } else {
        console.error('Failed to cancel download:', result.error);
      }
    }
  };

  const handleRetryDownload = async (download: DownloadState) => {
    if (download.status === 'failed' || download.status === 'cancelled') {
      const result = await commands.retryDownload(download.url, download.fileName, 'image');
      if (result.status === 'ok') {
        console.log('Successfully initiated retry:', download);
      } else {
        console.error('Failed to retry download:', result.error);
      }
    }
  };

  const handleClearCompleted = () => {
    setDownloads((prev) => prev.filter((d) => d.status !== 'completed'));
  };

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const m = k * 1024;
    const g = m * 1024;

    if (bytes < k) return `${bytes} B`;
    if (bytes < m) return `${(bytes / k).toFixed(1)} KB`;
    if (bytes < g) return `${(bytes / m).toFixed(1)} MB`;
    return `${(bytes / g).toFixed(2)} GB`;
  };

  const formatSpeed = (bytesPerSec?: number): string => {
    if (!bytesPerSec || bytesPerSec <= 0) return '';
    return `${formatBytes(bytesPerSec)}/s`;
  };

  const hasCompletedDownloads = downloads.some((d) => d.status === 'completed');

  const activeDownloads = downloads.filter((d) => d.status === 'downloading');
  const totalSpeed = activeDownloads.reduce((acc, d) => acc + (d.speed || 0), 0);

  return (
    <Dialog open={downloadsOpen} onOpenChange={setDownloadsOpen}>
      <DialogContent
        className="sm:max-w-4xl max-h-[85vh] overflow-hidden flex flex-col z-[9999]"
        showCloseButton={false}
      >
        <DialogTitle className="flex items-center justify-between gap-2 px-1">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <HugeiconsIcon icon={Download01Icon} size={20} className="text-primary" />
              <span>{_(msg`Download Manager`)}</span>
            </div>
            {activeDownloads.length > 0 && (
              <Badge variant="outline" className="text-[10px] font-mono py-0 h-5">
                {activeDownloads.length} {_(msg`Active`)} • {formatSpeed(totalSpeed)}
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-4 mr-8">
            {hasCompletedDownloads && (
              <button
                type="button"
                onClick={handleClearCompleted}
                className="text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
              >
                {_(msg`Clear Completed`)}
              </button>
            )}
            <button
              type="button"
              onClick={() => setDownloadsOpen(false)}
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              <HugeiconsIcon icon={Cancel01Icon} size={18} />
            </button>
          </div>
        </DialogTitle>
        <DialogDescription className="sr-only">
          {_(msg`View and manage your downloads`)}
        </DialogDescription>

        <div className="flex-1 overflow-y-auto mt-2">
          {downloads.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-80 text-muted-foreground">
              <div className="h-20 w-20 text-muted-foreground/20 flex items-center justify-center rounded-full bg-muted/10">
                <HugeiconsIcon icon={Download01Icon} size={40} />
              </div>
              <p className="mt-4 text-center font-medium">{_(msg`No active downloads`)}</p>
              <p className="text-sm text-muted-foreground/60">
                {_(msg`Downloaded files will appear here`)}
              </p>
            </div>
          ) : (
            <div className="grid gap-2 pr-2">
              <div className="grid grid-cols-[1fr_100px_140px_100px_160px] gap-4 px-4 py-2 text-xs font-semibold text-muted-foreground border-b uppercase tracking-wider">
                <div>{_(msg`File Name`)}</div>
                <div className="text-center">{_(msg`Status`)}</div>
                <div className="text-center">{_(msg`Progress`)}</div>
                <div className="text-center">{_(msg`Size`)}</div>
                <div className="text-right">{_(msg`Actions`)}</div>
              </div>

              {downloads.map((download) => (
                <div
                  key={download.enclosureId}
                  className={cn(
                    'grid grid-cols-[1fr_100px_140px_100px_160px] gap-4 items-center p-3 rounded-lg border transition-all hover:bg-muted/30 group',
                    download.status === 'completed'
                      ? 'bg-muted/10 border-green-500/10'
                      : 'bg-card border-border'
                  )}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="p-2 rounded bg-muted/50 text-muted-foreground shrink-0">
                      <HugeiconsIcon icon={File01Icon} size={18} />
                    </div>
                    <div className="flex flex-col min-w-0">
                      <span className="truncate font-medium text-sm" title={download.fileName}>
                        {download.fileName || `Download ${download.enclosureId}`}
                      </span>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-[10px] text-muted-foreground font-mono flex items-center gap-1">
                          <HugeiconsIcon icon={Link01Icon} size={10} />
                          {download.url ? new URL(download.url).hostname : 'unknown'}
                        </span>
                        {download.speed !== undefined && download.status === 'downloading' && (
                          <span className="text-[10px] text-primary font-medium">
                            {formatSpeed(download.speed)}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-center">{getStatusBadge(download.status)}</div>

                  <div className="flex flex-col justify-center gap-1.5">
                    <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                      <span className="font-medium">{download.progress}%</span>
                    </div>
                    <Progress value={download.progress} className="h-1" />
                    {download.status === 'downloading' && (
                      <span className="text-[9px] text-muted-foreground text-center">
                        {formatBytes(download.downloadedBytes)} / {formatBytes(download.totalBytes)}
                      </span>
                    )}
                  </div>

                  <div className="flex flex-col justify-center">
                    <span className="text-xs text-muted-foreground text-center">
                      {formatBytes(download.totalBytes)}
                    </span>
                  </div>

                  <div className="flex items-center justify-end gap-1">
                    {download.status === 'downloading' && (
                      <button
                        type="button"
                        onClick={() => handleCancelDownload(download)}
                        className="h-8 w-8 flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all rounded-md"
                        title={_(msg`Cancel`)}
                      >
                        <HugeiconsIcon icon={Cancel01Icon} size={16} />
                      </button>
                    )}

                    {(download.status === 'failed' || download.status === 'cancelled') && (
                      <button
                        type="button"
                        onClick={() => handleRetryDownload(download)}
                        className="h-8 w-8 flex items-center justify-center text-muted-foreground hover:text-primary hover:bg-primary/10 transition-all rounded-md"
                        title={_(msg`Retry`)}
                      >
                        <HugeiconsIcon icon={RefreshIcon} size={16} />
                      </button>
                    )}

                    {download.status === 'completed' && download.filePath && (
                      <>
                        <button
                          type="button"
                          onClick={() => download.filePath && handleOpenFile(download.filePath)}
                          className="h-8 w-8 flex items-center justify-center text-muted-foreground hover:text-primary hover:bg-primary/10 transition-all rounded-md"
                          title={_(msg`Open File`)}
                        >
                          <HugeiconsIcon icon={ViewIcon} size={16} />
                        </button>
                        <button
                          type="button"
                          onClick={() => download.filePath && handleOpenFolder(download.filePath)}
                          className="h-8 w-8 flex items-center justify-center text-muted-foreground hover:text-primary hover:bg-primary/10 transition-all rounded-md"
                          title={_(msg`Open Folder`)}
                        >
                          <HugeiconsIcon icon={Folder01Icon} size={16} />
                        </button>
                      </>
                    )}

                    <button
                      type="button"
                      onClick={() => handleCopyUrl(download.url)}
                      className="h-8 w-8 flex items-center justify-center text-muted-foreground hover:text-primary hover:bg-primary/10 transition-all rounded-md opacity-0 group-hover:opacity-100"
                      title={_(msg`Copy URL`)}
                    >
                      <HugeiconsIcon icon={Copy01Icon} size={16} />
                    </button>

                    <button
                      type="button"
                      onClick={() => handleRemoveDownload(download.enclosureId)}
                      className="h-8 w-8 flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all rounded-md opacity-0 group-hover:opacity-100"
                      title={_(msg`Remove from list`)}
                    >
                      <HugeiconsIcon icon={Cancel01Icon} size={16} />
                    </button>

                    {download.status === 'failed' && download.error && (
                      <button
                        type="button"
                        className="h-8 w-8 flex items-center justify-center text-destructive"
                        title={download.error}
                      >
                        <HugeiconsIcon icon={InformationCircleIcon} size={16} />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
