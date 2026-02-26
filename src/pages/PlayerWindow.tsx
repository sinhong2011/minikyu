import {
  ArrowShrink01Icon,
  Cancel01Icon,
  HeadphonesIcon,
  PlayListMinusIcon,
  Playlist03Icon,
} from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react';
import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { emit, listen } from '@tauri-apps/api/event';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { AnimatePresence, LayoutGroup, motion } from 'motion/react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { PlayerWindowControls } from '@/components/podcast/PlayerWindowControls';
import { PlayerWindowQueue } from '@/components/podcast/PlayerWindowQueue';
import {
  PLAYER_DISMISSED,
  PLAYER_REQUEST_SYNC,
  PLAYER_STATE_UPDATE,
  PLAYER_TRACK_CHANGE,
  type PlayerStatePayload,
  type PlayerTrackPayload,
  type UpNextEntry,
} from '@/lib/player-events';
import type { Entry } from '@/lib/tauri-bindings';
import { commands } from '@/lib/tauri-bindings';

const TRANSITION = { duration: 0.4, ease: [0.4, 0, 0.2, 1] as const };

/** Audio visualization — animated frequency bars drawn on canvas */
const BAR_COUNT = 32;
const BAR_GAP = 3;

function AudioVisualizer({ isPlaying }: { isPlaying: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const frameRef = useRef(0);
  const barsRef = useRef<number[]>(Array.from({ length: BAR_COUNT }, () => 0));
  const targetsRef = useRef<number[]>(Array.from({ length: BAR_COUNT }, () => 0));

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    if (canvas.width !== w * dpr || canvas.height !== h * dpr) {
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      ctx.scale(dpr, dpr);
    }

    ctx.clearRect(0, 0, w, h);

    const bars = barsRef.current;
    const targets = targetsRef.current;

    // Generate new targets periodically when playing
    if (isPlaying && Math.random() < 0.15) {
      for (let i = 0; i < BAR_COUNT; i++) {
        // Center bars are taller, edges shorter — creates a rounded shape
        const centerWeight = 1 - Math.abs(i - BAR_COUNT / 2) / (BAR_COUNT / 2);
        const energy = (0.15 + Math.random() * 0.85) * (0.3 + centerWeight * 0.7);
        targets[i] = energy;
      }
    } else if (!isPlaying) {
      for (let i = 0; i < BAR_COUNT; i++) {
        targets[i] = 0.03 + Math.random() * 0.04;
      }
    }

    // Smooth interpolation
    const lerpSpeed = isPlaying ? 0.12 : 0.06;
    for (let i = 0; i < BAR_COUNT; i++) {
      bars[i] = (bars[i] ?? 0) + ((targets[i] ?? 0) - (bars[i] ?? 0)) * lerpSpeed;
    }

    const barWidth = (w - (BAR_COUNT - 1) * BAR_GAP) / BAR_COUNT;
    const maxBarHeight = h * 0.8;

    // Get CSS color
    const style = getComputedStyle(canvas);
    const color = style.color || 'rgba(255,255,255,0.15)';

    for (let i = 0; i < BAR_COUNT; i++) {
      const barHeight = Math.max(2, (bars[i] ?? 0) * maxBarHeight);
      const x = i * (barWidth + BAR_GAP);
      const y = h - barHeight;
      const radius = Math.min(barWidth / 2, 4);

      ctx.beginPath();
      ctx.roundRect(x, y, barWidth, barHeight, [radius, radius, 0, 0]);
      ctx.fillStyle = color;
      ctx.fill();
    }

    frameRef.current = requestAnimationFrame(draw);
  }, [isPlaying]);

  useEffect(() => {
    frameRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(frameRef.current);
  }, [draw]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      className="pointer-events-none absolute inset-0 size-full rounded-2xl text-foreground/[0.07]"
      style={{
        opacity: isPlaying ? 1 : 0.5,
        transition: 'opacity 1s ease',
      }}
    />
  );
}

/** Apply theme from localStorage to documentElement */
function applyTheme() {
  const theme = localStorage.getItem('ui-theme') || 'system';
  const root = document.documentElement;

  root.classList.remove('light', 'dark');

  if (theme === 'system') {
    const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches
      ? 'dark'
      : 'light';
    root.classList.add(systemTheme);
  } else {
    root.classList.add(theme);
  }
}

function Artwork({ artworkUrl, compact }: { artworkUrl: string | null; compact: boolean }) {
  const size = compact ? 48 : 120;
  const radius = compact ? 12 : 20;

  return artworkUrl ? (
    <motion.img
      layoutId="artwork"
      src={artworkUrl}
      alt=""
      className="shrink-0 object-cover"
      style={{ width: size, height: size, borderRadius: radius }}
      transition={TRANSITION}
    />
  ) : (
    <motion.div
      layoutId="artwork"
      className="flex shrink-0 items-center justify-center bg-muted/50"
      style={{ width: size, height: size, borderRadius: radius }}
      transition={TRANSITION}
    >
      <HugeiconsIcon
        icon={HeadphonesIcon}
        className={compact ? 'size-6 text-muted-foreground' : 'size-10 text-muted-foreground'}
      />
    </motion.div>
  );
}

function TrackInfo({
  title,
  feedTitle,
  compact,
}: {
  title: string;
  feedTitle: string;
  compact: boolean;
}) {
  return (
    <motion.div
      layoutId="track-info"
      className={`min-w-0 ${compact ? 'text-start' : 'text-center'}`}
      transition={TRANSITION}
    >
      <p className="truncate text-[15px] font-semibold leading-snug">{title}</p>
      <p className="mt-0.5 truncate text-[12px] text-muted-foreground">{feedTitle}</p>
    </motion.div>
  );
}

export function PlayerWindow() {
  const { _ } = useLingui();

  const [entry, setEntry] = useState<Entry | null>(null);
  const [artworkUrl, setArtworkUrl] = useState<string | null>(null);
  const [queue, setQueue] = useState<UpNextEntry[]>([]);
  const [showQueue, setShowQueue] = useState(false);
  const [state, setState] = useState<PlayerStatePayload>({
    currentTime: 0,
    duration: 0,
    buffered: 0,
    isPlaying: false,
    isBuffering: false,
    playbackSpeed: 1,
    volume: 1,
    isMuted: false,
  });

  // Theme sync
  useEffect(() => {
    applyTheme();

    const currentWindow = getCurrentWindow();
    const unlistenTheme = listen('theme-changed', () => {
      applyTheme();
    });
    const unlistenFocus = currentWindow.onFocusChanged(({ payload: focused }) => {
      if (focused) applyTheme();
    });

    return () => {
      unlistenTheme.then((fn) => fn());
      unlistenFocus.then((fn) => fn());
    };
  }, []);

  // Player events
  useEffect(() => {
    const unlisteners = [
      listen<PlayerStatePayload>(PLAYER_STATE_UPDATE, (event) => {
        setState(event.payload);
      }),
      listen<PlayerTrackPayload>(PLAYER_TRACK_CHANGE, (event) => {
        setEntry(event.payload.entry);
        setArtworkUrl(event.payload.artworkUrl);
        setQueue(event.payload.queue);
      }),
      listen(PLAYER_DISMISSED, () => {
        setEntry(null);
        setArtworkUrl(null);
        setQueue([]);
        setState((prev) => ({ ...prev, isPlaying: false, isBuffering: false, currentTime: 0 }));
      }),
    ];

    // Request current state from main window (in case we missed earlier broadcasts)
    emit(PLAYER_REQUEST_SYNC, {}).catch(() => {});

    return () => {
      for (const p of unlisteners) {
        p.then((fn) => fn());
      }
    };
  }, []);

  const handleClose = () => {
    getCurrentWindow().hide();
  };

  const handleMinimizeToTray = () => {
    commands.hidePlayerWindow();
    commands.showTrayPopover();
  };

  return (
    <LayoutGroup>
      <div className="relative flex h-screen select-none flex-col overflow-hidden rounded-2xl bg-background/60 text-foreground backdrop-blur-3xl backdrop-saturate-150">
        <AudioVisualizer isPlaying={state.isPlaying} />
        {/* Top bar — actions */}
        <div
          data-tauri-drag-region
          className="flex shrink-0 items-center justify-end gap-0.5 px-4 pt-3 pb-0"
        >
          <button
            type="button"
            className={`inline-flex size-7 shrink-0 items-center justify-center rounded-full transition-colors hover:bg-foreground/10 ${showQueue ? 'text-primary' : 'text-muted-foreground hover:text-foreground'}`}
            onClick={() => setShowQueue((v) => !v)}
            onPointerDown={(e) => e.stopPropagation()}
            title={showQueue ? _(msg`Hide playlist`) : _(msg`Show playlist`)}
          >
            <HugeiconsIcon
              icon={showQueue ? PlayListMinusIcon : Playlist03Icon}
              className="size-3.5"
            />
          </button>
          <button
            type="button"
            className="inline-flex size-7 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-foreground/10 hover:text-foreground"
            onClick={handleMinimizeToTray}
            onPointerDown={(e) => e.stopPropagation()}
            title={_(msg`Mini player`)}
          >
            <HugeiconsIcon icon={ArrowShrink01Icon} className="size-3.5" />
          </button>
          <button
            type="button"
            className="inline-flex size-7 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-foreground/10 hover:text-foreground"
            onClick={handleClose}
            onPointerDown={(e) => e.stopPropagation()}
            title={_(msg`Close`)}
          >
            <HugeiconsIcon icon={Cancel01Icon} className="size-3.5" />
          </button>
        </div>

        {/* Player section */}
        <div className={`flex flex-col overflow-hidden ${showQueue ? 'shrink-0' : 'flex-1'}`}>
          {entry ? (
            <>
              {/* Artwork + title — two distinct layouts */}
              {showQueue ? (
                /* Compact row layout */
                <div className="flex items-center gap-3 px-4 py-1">
                  <Artwork artworkUrl={artworkUrl} compact />
                  <TrackInfo title={entry.title} feedTitle={entry.feed.title} compact />
                </div>
              ) : (
                /* Expanded centered layout — title at top, artwork centered */
                <div className="flex flex-1 flex-col items-center px-4 pt-3 pb-2">
                  <TrackInfo title={entry.title} feedTitle={entry.feed.title} compact={false} />
                  <div data-tauri-drag-region className="flex-1" />
                  <Artwork artworkUrl={artworkUrl} compact={false} />
                  <div data-tauri-drag-region className="flex-1" />
                </div>
              )}

              {/* Controls */}
              <PlayerWindowControls
                currentTime={state.currentTime}
                duration={state.duration}
                buffered={state.buffered}
                isPlaying={state.isPlaying}
                isBuffering={state.isBuffering}
                playbackSpeed={state.playbackSpeed}
                volume={state.volume}
                isMuted={state.isMuted}
              />
            </>
          ) : (
            /* Empty state — no episode playing */
            <div
              data-tauri-drag-region
              className="flex flex-1 flex-col items-center justify-center text-muted-foreground"
            >
              <HugeiconsIcon
                icon={HeadphonesIcon}
                className="mb-2 size-8 text-muted-foreground/40"
              />
              <p className="text-[12px]">{_(msg`No episode playing`)}</p>
            </div>
          )}
        </div>

        {/* Queue */}
        <AnimatePresence initial={false}>
          {showQueue && (
            <motion.div
              key="queue"
              className="flex min-h-0 flex-1 flex-col overflow-hidden"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={TRANSITION}
            >
              <PlayerWindowQueue queue={queue} currentEntryId={entry?.id ?? null} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </LayoutGroup>
  );
}
