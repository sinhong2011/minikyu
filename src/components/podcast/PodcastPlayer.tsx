import {
  Download01Icon,
  GoBackward15SecIcon,
  GoForward30SecIcon,
  Loading03Icon,
  PauseIcon,
  PlayIcon,
  RefreshIcon,
  StopCircleIcon,
  ViewIcon,
  VolumeHighIcon,
  VolumeLowIcon,
  VolumeMute01Icon,
} from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react';
import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { listen } from '@tauri-apps/api/event';
import { openPath } from '@tauri-apps/plugin-opener';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Slider } from '@/components/ui/slider';
import {
  buildPodcastDownloadFileName,
  formatTimestamp,
  getPodcastDownloadSnapshotForUrl,
  SPEED_MAX,
  SPEED_MIN,
  SPEED_PRESETS,
  SPEED_STEP,
} from '@/lib/podcast-utils';
import type { Enclosure, Entry } from '@/lib/tauri-bindings';
import { commands } from '@/lib/tauri-bindings';
import { cn } from '@/lib/utils';
import {
  resolvePodcastFeedSettingsForSpeedUpdate,
  usePodcastFeedSettings,
  useUpdatePodcastFeedSettings,
} from '@/services/miniflux/podcast';
import { usePlayerStore } from '@/store/player-store';
import { useUIStore } from '@/store/ui-store';

interface PodcastPlayerProps {
  entry: Entry;
  enclosure: Enclosure;
}

function resolveValue(value: number | readonly number[]): number {
  return typeof value === 'number' ? value : (value[0] ?? 0);
}

export function PodcastPlayer({ entry, enclosure }: PodcastPlayerProps) {
  const { _ } = useLingui();
  const shouldReduceMotion = useReducedMotion();
  const isPlaying = usePlayerStore((s) => s.isPlaying);
  const isBuffering = usePlayerStore((s) => s.isBuffering);
  const currentTime = usePlayerStore((s) => s.currentTime);
  const duration = usePlayerStore((s) => s.duration);
  const playbackSpeed = usePlayerStore((s) => s.playbackSpeed);
  const volume = usePlayerStore((s) => s.volume);
  const isMuted = usePlayerStore((s) => s.isMuted);
  const stopAfterCurrent = usePlayerStore((s) => s.stopAfterCurrent);
  const currentEntry = usePlayerStore((s) => s.currentEntry);
  const updateFeedSettings = useUpdatePodcastFeedSettings();
  const { data: feedSettings } = usePodcastFeedSettings(entry.feed_id);
  const [speedPopoverOpen, setSpeedPopoverOpen] = useState(false);
  const [volumePopoverOpen, setVolumePopoverOpen] = useState(false);
  const [downloadStatus, setDownloadStatus] = useState<
    'idle' | 'downloading' | 'completed' | 'failed' | 'cancelled'
  >('idle');
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [downloadFilePath, setDownloadFilePath] = useState<string | null>(null);
  const [downloadPending, setDownloadPending] = useState(false);

  const isCurrentEntry = currentEntry?.id === entry.id;

  const handlePlayPause = () => {
    if (isCurrentEntry) {
      const { isPlaying: playing, pause, resume } = usePlayerStore.getState();
      if (playing) pause();
      else resume();
    } else {
      usePlayerStore.getState().play(entry, enclosure);
    }
  };

  const handleSeek = (time: number) => {
    usePlayerStore.getState().seek(time);
  };

  const handleSkipBack = () => {
    const { currentTime: t, seek } = usePlayerStore.getState();
    seek(Math.max(0, t - 15));
  };

  const handleSkipForward = () => {
    const { currentTime: t, duration: d, seek } = usePlayerStore.getState();
    seek(Math.min(d, t + 30));
  };

  const handleSpeedChange = (speed: number) => {
    usePlayerStore.getState().setSpeed(speed);
  };

  const persistSpeedPreference = (speed: number) => {
    const resolvedSettings = resolvePodcastFeedSettingsForSpeedUpdate(feedSettings);
    updateFeedSettings.mutate({
      feedId: entry.feed_id,
      autoDownloadCount: resolvedSettings.autoDownloadCount,
      playbackSpeed: speed,
      autoCleanupDays: resolvedSettings.autoCleanupDays,
    });
  };

  const handleSpeedPreset = (speed: number) => {
    handleSpeedChange(speed);
    persistSpeedPreference(speed);
    setSpeedPopoverOpen(false);
  };

  const handleVolumeChange = (value: number | readonly number[]) => {
    const v = resolveValue(value);
    usePlayerStore.getState().setVolume(v / 100);
  };

  const handleToggleMute = () => {
    usePlayerStore.getState().toggleMute();
  };

  const handleToggleStopAfter = () => {
    usePlayerStore.getState().toggleStopAfterCurrent();
  };

  useEffect(() => {
    let unlisten: (() => void) | null = null;
    let active = true;

    const resetState = () => {
      setDownloadStatus('idle');
      setDownloadProgress(0);
      setDownloadFilePath(null);
      setDownloadPending(false);
    };

    const loadHistory = async () => {
      resetState();
      const result = await commands.getDownloadsFromDb();
      if (!active || result.status === 'error') return;

      const snapshot = getPodcastDownloadSnapshotForUrl(result.data, enclosure.url);
      if (!snapshot) return;

      setDownloadStatus(snapshot.status);
      setDownloadProgress(snapshot.progress);
      if (snapshot.status === 'completed') {
        setDownloadFilePath(snapshot.filePath);
      }
    };

    const bindProgressListener = async () => {
      unlisten = await listen<{
        // biome-ignore lint/style/useNamingConvention: API event payload
        file_name: string;
        // biome-ignore lint/style/useNamingConvention: API event payload
        file_path?: string;
        // biome-ignore lint/style/useNamingConvention: API event payload
        downloaded_bytes: number;
        // biome-ignore lint/style/useNamingConvention: API event payload
        total_bytes: number;
        progress: number;
        status: string;
        url: string;
      }>('download-progress', (event) => {
        if (event.payload.url !== enclosure.url) return;

        const status = event.payload.status.toLowerCase();
        if (
          status !== 'downloading' &&
          status !== 'completed' &&
          status !== 'failed' &&
          status !== 'cancelled'
        ) {
          return;
        }

        setDownloadStatus(status);
        setDownloadProgress(event.payload.progress);
        if (status === 'completed') {
          setDownloadFilePath(event.payload.file_path ?? null);
          setDownloadPending(false);
        }
        if (status === 'failed' || status === 'cancelled') {
          setDownloadPending(false);
        }
      });

      if (!active) {
        unlisten?.();
      }
    };

    void loadHistory();
    void bindProgressListener();

    return () => {
      active = false;
      unlisten?.();
    };
  }, [enclosure.url]);

  const handleDownloadAction = async () => {
    if (downloadStatus === 'downloading') {
      useUIStore.getState().setDownloadsOpen(true);
      return;
    }

    if (downloadStatus === 'completed' && downloadFilePath) {
      await openPath(downloadFilePath);
      return;
    }

    setDownloadPending(true);
    setDownloadStatus('downloading');
    setDownloadProgress(0);

    const fileName = buildPodcastDownloadFileName(entry.title, enclosure);
    useUIStore.getState().setDownloadsOpen(true);
    toast.message(_(msg`Downloading`), {
      description: fileName,
    });

    const result = await commands.downloadFile(enclosure.url, fileName, 'audio');
    setDownloadPending(false);

    if (result.status === 'error') {
      setDownloadStatus('failed');
      toast.error(_(msg`Download Failed`), { description: result.error });
      return;
    }

    setDownloadStatus('completed');
    setDownloadProgress(100);
    setDownloadFilePath(result.data);
  };

  const showActiveControls = isCurrentEntry && duration > 0;
  const bufferingActive = isCurrentEntry && isPlaying && isBuffering;
  const playingActive = isCurrentEntry && isPlaying && !isBuffering;
  const displayTime = isCurrentEntry ? currentTime : 0;
  const displayDuration = isCurrentEntry ? duration : 0;
  const progress = displayDuration > 0 ? (displayTime / displayDuration) * 100 : 0;
  const volumeIcon = isMuted ? VolumeMute01Icon : volume < 0.5 ? VolumeLowIcon : VolumeHighIcon;
  const volumePercent = Math.round((isMuted ? 0 : volume) * 100);
  const downloadLabel = useMemo(() => {
    if (downloadStatus === 'downloading') return `${downloadProgress}%`;
    if (downloadStatus === 'completed') return _(msg`Open`);
    if (downloadStatus === 'failed' || downloadStatus === 'cancelled') return _(msg`Retry`);
    return _(msg`Download`);
  }, [downloadStatus, downloadProgress, _]);
  const downloadTitle = useMemo(() => {
    if (downloadStatus === 'downloading') return _(msg`View and manage your downloads`);
    if (downloadStatus === 'completed') return _(msg`Open`);
    if (downloadStatus === 'failed' || downloadStatus === 'cancelled') return _(msg`Retry`);
    return _(msg`Download`);
  }, [downloadStatus, _]);

  return (
    <div
      className="border-t border-border/70 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.08),transparent_55%),linear-gradient(180deg,hsl(var(--background)/0.97),hsl(var(--background)/0.91))] backdrop-blur supports-[backdrop-filter]:bg-background/78"
      data-testid="podcast-player"
    >
      <div className="space-y-1.5 px-3.5 py-2">
        <div className="relative flex items-start justify-between gap-3 overflow-hidden rounded-xl">
          <AnimatePresence>
            {bufferingActive && (
              <motion.span
                aria-hidden
                className="pointer-events-none absolute inset-0 bg-[linear-gradient(110deg,transparent_28%,hsl(var(--primary)/0.14)_50%,transparent_72%)]"
                initial={{ x: '-130%', opacity: 0 }}
                animate={
                  shouldReduceMotion
                    ? { opacity: 0.22 }
                    : {
                        x: ['-130%', '130%'],
                        opacity: [0.1, 0.4, 0.1],
                      }
                }
                exit={{ opacity: 0 }}
                transition={{
                  duration: shouldReduceMotion ? 0.01 : 1.35,
                  repeat: shouldReduceMotion ? 0 : Number.POSITIVE_INFINITY,
                  ease: 'easeInOut',
                }}
              />
            )}
          </AnimatePresence>
          <div className="min-w-0 flex-1">
            <div className="mb-0.5 flex items-center gap-1">
              <span className="relative inline-flex size-2 items-center justify-center">
                {playingActive && (
                  <motion.span
                    aria-hidden
                    className="absolute inset-0 rounded-full bg-primary/30"
                    animate={
                      shouldReduceMotion ? undefined : { scale: [1, 1.65], opacity: [0.45, 0] }
                    }
                    transition={{
                      duration: 1.25,
                      repeat: Number.POSITIVE_INFINITY,
                      ease: 'easeOut',
                    }}
                  />
                )}
                {bufferingActive && (
                  <motion.span
                    aria-hidden
                    className="absolute inset-0 rounded-full border border-primary/60"
                    animate={shouldReduceMotion ? undefined : { rotate: 360 }}
                    transition={{
                      duration: 1,
                      repeat: Number.POSITIVE_INFINITY,
                      ease: 'linear',
                    }}
                  />
                )}
                <span
                  className={cn(
                    'relative z-10 size-1.5 rounded-full bg-muted-foreground/40 transition-colors',
                    isCurrentEntry && isPlaying && 'bg-primary'
                  )}
                />
              </span>
              <p className="truncate text-[12.5px] font-medium leading-tight">{entry.title}</p>
            </div>
            <p className="truncate text-[10.5px] text-muted-foreground/90">{entry.feed.title}</p>
          </div>
          <span
            className="shrink-0 text-[10.5px] tabular-nums text-muted-foreground"
            data-testid="podcast-current-time"
          >
            {showActiveControls
              ? `${formatTimestamp(displayTime)} / ${formatTimestamp(displayDuration)}`
              : '--:-- / --:--'}
          </span>
        </div>

        <div className="relative">
          <Slider
            className="[&_[data-slot=slider-track]]:h-0.75 [&_[data-slot=slider-thumb]]:size-2.5"
            value={[showActiveControls ? progress : 0]}
            min={0}
            max={100}
            step={0.1}
            onValueChange={(value) => {
              const pct = resolveValue(value);
              if (displayDuration > 0) {
                handleSeek((pct / 100) * displayDuration);
              }
            }}
            disabled={!showActiveControls}
          />
          <AnimatePresence>
            {bufferingActive && (
              <motion.span
                aria-hidden
                className="pointer-events-none absolute inset-x-0 top-1/2 h-0.75 -translate-y-1/2 overflow-hidden rounded-full bg-primary/16"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                <motion.span
                  className="absolute inset-y-0 left-0 w-[34%] rounded-full bg-primary/80"
                  animate={
                    shouldReduceMotion
                      ? { x: 0 }
                      : {
                          x: ['-120%', '320%'],
                        }
                  }
                  transition={{
                    duration: shouldReduceMotion ? 0.01 : 1.05,
                    repeat: shouldReduceMotion ? 0 : Number.POSITIVE_INFINITY,
                    ease: 'easeInOut',
                  }}
                />
                <motion.span
                  className="absolute inset-y-0 left-0 w-[18%] rounded-full bg-primary/40 blur-[1px]"
                  animate={
                    shouldReduceMotion
                      ? { x: 0 }
                      : {
                          x: ['-150%', '360%'],
                        }
                  }
                  transition={{
                    duration: shouldReduceMotion ? 0.01 : 1.05,
                    repeat: shouldReduceMotion ? 0 : Number.POSITIVE_INFINITY,
                    ease: 'easeInOut',
                    delay: 0.08,
                  }}
                />
              </motion.span>
            )}
          </AnimatePresence>
        </div>

        <div className="flex items-center justify-between gap-1.5">
          <div className="flex items-center gap-1">
            <Popover open={speedPopoverOpen} onOpenChange={setSpeedPopoverOpen}>
              <PopoverTrigger
                className="inline-flex h-6.5 items-center gap-1 rounded-full border border-border/60 bg-background/70 px-2 text-[10.5px] font-medium tabular-nums text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                title={_(msg`Playback speed`)}
                data-testid="podcast-speed-trigger"
              >
                {playbackSpeed}x
              </PopoverTrigger>
              <PopoverContent className="w-56 p-3" align="start" side="top">
                <div className="mb-2 text-xs font-medium text-muted-foreground">
                  {_(msg`Playback speed`)}
                </div>
                <div className="mb-3 flex flex-wrap gap-1">
                  {SPEED_PRESETS.map((speed) => (
                    <Button
                      key={speed}
                      variant={playbackSpeed === speed ? 'default' : 'outline'}
                      size="xs"
                      onClick={() => handleSpeedPreset(speed)}
                    >
                      {speed}x
                    </Button>
                  ))}
                </div>
                <Slider
                  value={[playbackSpeed]}
                  min={SPEED_MIN}
                  max={SPEED_MAX}
                  step={SPEED_STEP}
                  onValueChange={(value) => {
                    const s = resolveValue(value);
                    handleSpeedChange(Math.round(s * 100) / 100);
                  }}
                  onValueCommitted={(value) => {
                    const s = resolveValue(value);
                    persistSpeedPreference(Math.round(s * 100) / 100);
                  }}
                />
                <div className="mt-1 flex justify-between text-xs text-muted-foreground">
                  <span>{SPEED_MIN}x</span>
                  <span>{SPEED_MAX}x</span>
                </div>
              </PopoverContent>
            </Popover>

            <Button
              variant={stopAfterCurrent ? 'secondary' : 'ghost'}
              size="icon-xs"
              className={cn(
                'rounded-full border border-transparent',
                stopAfterCurrent && 'border-primary/30 bg-primary/10 shadow-sm shadow-primary/20'
              )}
              onClick={handleToggleStopAfter}
              title={_(msg`Stop after this episode`)}
              data-testid="podcast-stop-after"
            >
              <HugeiconsIcon icon={StopCircleIcon} className="size-3" />
            </Button>

            <Button
              variant={
                downloadStatus === 'completed'
                  ? 'secondary'
                  : downloadStatus === 'failed'
                    ? 'outline'
                    : 'ghost'
              }
              size="icon-xs"
              className={cn(
                'rounded-full border border-transparent',
                downloadStatus === 'downloading' && 'border-primary/30 bg-primary/10',
                (downloadPending || downloadStatus === 'downloading') && 'animate-pulse'
              )}
              onClick={handleDownloadAction}
              title={downloadTitle}
              data-testid="podcast-download"
            >
              <HugeiconsIcon
                icon={
                  downloadStatus === 'completed'
                    ? ViewIcon
                    : downloadStatus === 'failed' || downloadStatus === 'cancelled'
                      ? RefreshIcon
                      : Download01Icon
                }
                className="size-3"
              />
            </Button>

            <span
              className={cn(
                'hidden text-[10px] tabular-nums text-muted-foreground sm:inline',
                downloadStatus === 'failed' && 'text-destructive'
              )}
              data-testid="podcast-download-label"
            >
              {downloadLabel}
            </span>
          </div>

          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon-xs"
              className="rounded-full"
              onClick={handleSkipBack}
              disabled={!showActiveControls}
              title={_(msg`Skip back 15s`)}
              data-testid="podcast-skip-back"
            >
              <HugeiconsIcon icon={GoBackward15SecIcon} className="size-3.5" />
            </Button>

            <span className="relative inline-flex">
              {bufferingActive && (
                <motion.span
                  aria-hidden
                  className="pointer-events-none absolute inset-0 rounded-full bg-primary/20 blur-[1.5px]"
                  animate={
                    shouldReduceMotion ? undefined : { scale: [0.98, 1.24], opacity: [0.4, 0] }
                  }
                  transition={{
                    duration: 1.1,
                    repeat: Number.POSITIVE_INFINITY,
                    ease: 'easeOut',
                  }}
                />
              )}
              {bufferingActive && (
                <motion.span
                  aria-hidden
                  className="pointer-events-none absolute -inset-1 rounded-full border border-primary/35"
                  animate={shouldReduceMotion ? undefined : { rotate: 360 }}
                  transition={{
                    duration: 1.1,
                    repeat: Number.POSITIVE_INFINITY,
                    ease: 'linear',
                  }}
                />
              )}
              {playingActive && (
                <motion.span
                  aria-hidden
                  className="pointer-events-none absolute inset-0 rounded-full bg-primary/25"
                  animate={shouldReduceMotion ? undefined : { scale: [1, 1.34], opacity: [0.5, 0] }}
                  transition={{
                    duration: 1.2,
                    repeat: Number.POSITIVE_INFINITY,
                    ease: 'easeOut',
                  }}
                />
              )}
              <Button
                variant={isCurrentEntry && isPlaying ? 'default' : 'secondary'}
                size="icon"
                className={cn(
                  'size-8 rounded-full transition-all',
                  isCurrentEntry && isPlaying && 'shadow-md shadow-primary/30'
                )}
                onClick={handlePlayPause}
                title={
                  bufferingActive
                    ? _(msg`Loading...`)
                    : isCurrentEntry && isPlaying
                      ? _(msg`Pause`)
                      : _(msg`Play`)
                }
                data-testid="podcast-play-pause"
              >
                <AnimatePresence mode="wait" initial={false}>
                  <motion.span
                    key={
                      bufferingActive ? 'loading' : isCurrentEntry && isPlaying ? 'pause' : 'play'
                    }
                    initial={{ opacity: 0, scale: 0.84, y: 1 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.84, y: -1 }}
                    transition={{ duration: shouldReduceMotion ? 0.01 : 0.16 }}
                  >
                    <HugeiconsIcon
                      icon={
                        bufferingActive
                          ? Loading03Icon
                          : isCurrentEntry && isPlaying
                            ? PauseIcon
                            : PlayIcon
                      }
                      className={cn('size-4.5', bufferingActive && 'animate-spin')}
                    />
                  </motion.span>
                </AnimatePresence>
              </Button>
            </span>

            <Button
              variant="ghost"
              size="icon-xs"
              className="rounded-full"
              onClick={handleSkipForward}
              disabled={!showActiveControls}
              title={_(msg`Skip forward 30s`)}
              data-testid="podcast-skip-forward"
            >
              <HugeiconsIcon icon={GoForward30SecIcon} className="size-3.5" />
            </Button>
          </div>

          <div className="flex min-w-[82px] items-center justify-end gap-1">
            <Popover open={volumePopoverOpen} onOpenChange={setVolumePopoverOpen}>
              <PopoverTrigger
                className="inline-flex h-6.5 w-6.5 items-center justify-center rounded-full border border-border/60 bg-background/70 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                title={isMuted ? _(msg`Unmute`) : _(msg`Mute`)}
              >
                <HugeiconsIcon icon={volumeIcon} className="size-3" />
              </PopoverTrigger>
              <PopoverContent className="w-44 p-3" align="end" side="top">
                <div className="mb-2 flex items-center justify-between text-xs text-muted-foreground">
                  <span>{_(msg`Volume`)}</span>
                  <span className="tabular-nums">{volumePercent}%</span>
                </div>
                <div className="mb-2 flex justify-end">
                  <Button
                    variant="ghost"
                    size="xs"
                    className="h-6 rounded-full px-2"
                    onClick={handleToggleMute}
                  >
                    {isMuted ? _(msg`Unmute`) : _(msg`Mute`)}
                  </Button>
                </div>
                <Slider
                  value={[volumePercent]}
                  min={0}
                  max={100}
                  step={1}
                  onValueChange={handleVolumeChange}
                />
              </PopoverContent>
            </Popover>
            <span className="w-8 text-right text-[10px] tabular-nums text-muted-foreground/80">
              {volumePercent}%
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
