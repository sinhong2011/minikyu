import {
  Download01Icon,
  GoBackward15SecIcon,
  GoForward30SecIcon,
  Loading03Icon,
  NextIcon,
  PauseIcon,
  PlayIcon,
  PreviousIcon,
  StopCircleIcon,
  VolumeHighIcon,
  VolumeLowIcon,
  VolumeMute01Icon,
} from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react';
import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { emit } from '@tauri-apps/api/event';
import { motion, useMotionValue, useTransform } from 'motion/react';
import { useEffect, useRef, useState } from 'react';
import { Slider } from '@/components/ui/slider';
import { PLAYER_CMD, type PlayerCmdPayload } from '@/lib/player-events';
import { formatTimestamp } from '@/lib/podcast-utils';

interface PlayerWindowControlsProps {
  currentTime: number;
  duration: number;
  buffered: number;
  isPlaying: boolean;
  isBuffering: boolean;
  playbackSpeed: number;
  volume: number;
  isMuted: boolean;
}

function sendCmd(action: PlayerCmdPayload['action'], value?: number | string) {
  emit(PLAYER_CMD, { action, value } satisfies PlayerCmdPayload).catch(() => {});
}

function volumeIcon(volume: number, isMuted: boolean) {
  if (isMuted || volume === 0) return VolumeMute01Icon;
  if (volume < 0.5) return VolumeLowIcon;
  return VolumeHighIcon;
}

function VolumeSlider({
  volume,
  isMuted,
  onChange,
}: {
  volume: number;
  isMuted: boolean;
  onChange: (v: number) => void;
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const displayVolume = isMuted ? 0 : volume;
  const active = isHovered || isDragging;

  // Motion values for instant, render-free updates during drag
  const mv = useMotionValue(displayVolume);
  const fillScale = useTransform(mv, [0, 1], [0, 1]);
  const thumbLeft = useTransform(mv, (v: number) => `calc(${v * 100}% - 5px)`);

  // Sync prop changes (mute toggle, external volume) when not dragging
  useEffect(() => {
    if (!isDragging) {
      mv.set(displayVolume);
    }
  }, [displayVolume, isDragging, mv]);

  const getVolumeFromPointer = (clientX: number) => {
    if (!trackRef.current) return mv.get();
    const rect = trackRef.current.getBoundingClientRect();
    return Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    e.preventDefault();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    setIsDragging(true);
    const v = getVolumeFromPointer(e.clientX);
    mv.set(v);
    onChange(v);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging) return;
    const v = getVolumeFromPointer(e.clientX);
    mv.set(v);
    onChange(v);
  };

  const handlePointerUp = () => {
    setIsDragging(false);
  };

  return (
    <div
      ref={trackRef}
      className="relative flex h-4 w-20 cursor-pointer items-center"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerEnter={() => setIsHovered(true)}
      onPointerLeave={() => {
        setIsHovered(false);
        setIsDragging(false);
      }}
      title={`${Math.round(displayVolume * 100)}%`}
    >
      {/* Track */}
      <motion.div
        className="absolute inset-x-0 rounded-full bg-muted/40"
        animate={{ height: active ? 6 : 4 }}
        transition={{ type: 'spring', stiffness: 400, damping: 30 }}
      />
      {/* Fill — driven by motion value, no spring lag during drag */}
      <motion.div
        className="absolute left-0 origin-left rounded-full bg-primary"
        style={{ width: '100%', scaleX: fillScale }}
        animate={{ height: active ? 6 : 4 }}
        transition={{ type: 'spring', stiffness: 400, damping: 30 }}
      />
      {/* Glow */}
      <motion.div
        className="absolute left-0 origin-left rounded-full bg-primary/20 blur-[3px]"
        style={{ width: '100%', scaleX: fillScale }}
        animate={{
          height: active ? 10 : 0,
          opacity: active ? 1 : 0,
        }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
      />
      {/* Thumb — position driven by motion value */}
      <motion.div
        className="absolute top-1/2 size-2.5 -translate-y-1/2 rounded-full bg-primary shadow-sm shadow-primary/25"
        style={{ left: thumbLeft }}
        animate={{
          scale: isDragging ? 1.4 : active ? 1 : 0,
          opacity: active ? 1 : 0,
        }}
        transition={{ type: 'spring', stiffness: 400, damping: 25 }}
      />
    </div>
  );
}

export function PlayerWindowControls({
  currentTime,
  duration,
  buffered,
  isPlaying,
  isBuffering,
  playbackSpeed,
  volume,
  isMuted,
}: PlayerWindowControlsProps) {
  const { _ } = useLingui();
  const [isSeeking, setIsSeeking] = useState(false);
  const [seekValue, setSeekValue] = useState(0);
  const [hoverPct, setHoverPct] = useState<number | null>(null);
  const sliderRef = useRef<HTMLDivElement>(null);

  const bufferingActive = isBuffering && isPlaying;
  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;
  const bufferedProgress =
    duration > 0 ? Math.max(0, Math.min(100, (buffered / duration) * 100)) : 0;
  const displayTime = isSeeking && duration > 0 ? (seekValue / 100) * duration : currentTime;
  const currentLabel = duration > 0 ? formatTimestamp(displayTime) : '--:--';
  const durationLabel = duration > 0 ? formatTimestamp(duration) : '--:--';

  const hoverTime =
    hoverPct !== null && duration > 0 ? formatTimestamp((hoverPct / 100) * duration) : null;

  const handleSeekChange = (value: number | readonly number[]) => {
    const pct = typeof value === 'number' ? value : (value[0] ?? 0);
    setIsSeeking(true);
    setSeekValue(pct);
  };

  const handleSeekCommit = (value: number | readonly number[]) => {
    const pct = typeof value === 'number' ? value : (value[0] ?? 0);
    if (duration > 0) {
      sendCmd('seek', (pct / 100) * duration);
    }
    setIsSeeking(false);
  };

  const handleSliderHover = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!sliderRef.current || duration <= 0) return;
    const rect = sliderRef.current.getBoundingClientRect();
    const pct = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100));
    setHoverPct(pct);
  };

  const handleCycleSpeed = () => {
    const speeds = [1, 1.25, 1.5, 1.75, 2];
    const idx = speeds.findIndex((s) => Math.abs(s - playbackSpeed) < 0.01);
    const next = speeds[(idx + 1) % speeds.length] ?? 1;
    sendCmd('set-speed', next);
  };

  return (
    <div className="shrink-0 space-y-3 px-4 pt-3 pb-2">
      {/* Time labels */}
      <div className="flex items-center justify-between text-[11px] tabular-nums text-muted-foreground">
        <span>{currentLabel}</span>
        <span>{durationLabel}</span>
      </div>

      {/* Progress slider with hover preview */}
      <div
        ref={sliderRef}
        className="group relative"
        onPointerMove={handleSliderHover}
        onPointerLeave={() => setHoverPct(null)}
      >
        {/* Hover time tooltip */}
        {hoverPct !== null && hoverTime && !isSeeking && (
          <span
            className="pointer-events-none absolute -top-7 z-10 -translate-x-1/2 rounded bg-foreground/90 px-1.5 py-0.5 text-[10px] tabular-nums text-background"
            style={{ left: `${hoverPct}%` }}
          >
            {hoverTime}
          </span>
        )}

        <span
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-1/2 h-1 -translate-y-1/2 origin-left rounded-full bg-primary/20 transition-transform duration-300 ease-out"
          style={{ transform: `scaleX(${bufferedProgress / 100})` }}
        />
        <Slider
          className="relative z-[1] [&_[data-slot=slider-track]]:h-1 [&_[data-slot=slider-track]]:bg-muted/40 [&_[data-slot=slider-thumb]]:z-[2] [&_[data-slot=slider-thumb]]:size-3"
          value={[isSeeking ? seekValue : progress]}
          min={0}
          max={100}
          step={0.1}
          onValueChange={handleSeekChange}
          onValueCommitted={handleSeekCommit}
        />
      </div>

      {/* Transport controls — centered prev/play/next */}
      <div className="flex items-center justify-center gap-2">
        <button
          type="button"
          className="inline-flex size-9 items-center justify-center rounded-full text-foreground/80 transition-colors hover:bg-foreground/10 hover:text-foreground"
          onClick={() => sendCmd('prev-track')}
          title={_(msg`Previous`)}
        >
          <HugeiconsIcon icon={PreviousIcon} className="size-4" />
        </button>

        <button
          type="button"
          className="inline-flex size-9 items-center justify-center rounded-full text-foreground/80 transition-colors hover:bg-foreground/10 hover:text-foreground"
          onClick={() => sendCmd('skip-back')}
          title={_(msg`Skip back 15s`)}
        >
          <HugeiconsIcon icon={GoBackward15SecIcon} className="size-5" />
        </button>

        <button
          type="button"
          className="inline-flex size-11 items-center justify-center rounded-full bg-foreground/10 text-foreground transition-colors hover:bg-foreground/15"
          onClick={() => sendCmd(isPlaying ? 'pause' : 'play')}
          title={bufferingActive ? _(msg`Loading...`) : isPlaying ? _(msg`Pause`) : _(msg`Play`)}
        >
          <HugeiconsIcon
            icon={bufferingActive ? Loading03Icon : isPlaying ? PauseIcon : PlayIcon}
            className={bufferingActive ? 'size-5 animate-spin' : 'size-5'}
          />
        </button>

        <button
          type="button"
          className="inline-flex size-9 items-center justify-center rounded-full text-foreground/80 transition-colors hover:bg-foreground/10 hover:text-foreground"
          onClick={() => sendCmd('skip-forward')}
          title={_(msg`Skip forward 30s`)}
        >
          <HugeiconsIcon icon={GoForward30SecIcon} className="size-5" />
        </button>

        <button
          type="button"
          className="inline-flex size-9 items-center justify-center rounded-full text-foreground/80 transition-colors hover:bg-foreground/10 hover:text-foreground"
          onClick={() => sendCmd('next-track')}
          title={_(msg`Next`)}
        >
          <HugeiconsIcon icon={NextIcon} className="size-4" />
        </button>
      </div>

      {/* Secondary controls */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1">
          <button
            type="button"
            className="inline-flex h-7 items-center justify-center rounded-full px-2 text-[11px] font-semibold tabular-nums text-foreground/80 transition-colors hover:bg-foreground/10 hover:text-foreground"
            onClick={handleCycleSpeed}
            title={_(msg`Playback speed`)}
          >
            {playbackSpeed}x
          </button>

          <button
            type="button"
            className="inline-flex size-8 items-center justify-center rounded-full text-foreground/80 transition-colors hover:bg-foreground/10 hover:text-foreground"
            onClick={() => sendCmd('download')}
            title={_(msg`Download`)}
          >
            <HugeiconsIcon icon={Download01Icon} className="size-3.5" />
          </button>
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            className="inline-flex size-7 items-center justify-center rounded-full text-foreground/80 transition-colors hover:bg-foreground/10 hover:text-foreground"
            onClick={() => sendCmd('toggle-mute')}
            title={isMuted ? _(msg`Unmute`) : _(msg`Mute`)}
          >
            <HugeiconsIcon icon={volumeIcon(volume, isMuted)} className="size-3.5" />
          </button>

          <VolumeSlider
            volume={volume}
            isMuted={isMuted}
            onChange={(v) => sendCmd('set-volume', v)}
          />

          <button
            type="button"
            className="inline-flex size-8 items-center justify-center rounded-full text-foreground/60 transition-colors hover:bg-rose-500/10 hover:text-rose-500"
            onClick={() => sendCmd('dismiss')}
            title={_(msg`Stop`)}
          >
            <HugeiconsIcon icon={StopCircleIcon} className="size-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
