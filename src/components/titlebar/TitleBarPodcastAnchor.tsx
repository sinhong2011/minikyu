import { HeadphonesIcon, Loading03Icon, PauseIcon, PlayIcon } from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react';
import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { useEffect, useMemo, useState } from 'react';
import { extractThumbnail } from '@/lib/media-utils';
import { formatTimestamp } from '@/lib/podcast-utils';
import { commands } from '@/lib/tauri-bindings';
import { cn } from '@/lib/utils';
import { usePlayerStore } from '@/store/player-store';

interface TitleBarPodcastAnchorProps {
  className?: string;
}

export function TitleBarPodcastAnchor({ className }: TitleBarPodcastAnchorProps) {
  const { _ } = useLingui();
  const currentEntry = usePlayerStore((state) => state.currentEntry);
  const isPlaying = usePlayerStore((state) => state.isPlaying);
  const isBuffering = usePlayerStore((state) => state.isBuffering);
  const currentTime = usePlayerStore((state) => state.currentTime);
  const duration = usePlayerStore((state) => state.duration);
  const buffered = usePlayerStore((state) => state.buffered);
  const shouldReduceMotion = useReducedMotion();
  const [feedIconUrl, setFeedIconUrl] = useState<string | null>(null);

  const entryThumbnail = useMemo(() => {
    if (!currentEntry) return null;
    return extractThumbnail(currentEntry);
  }, [currentEntry]);

  useEffect(() => {
    setFeedIconUrl(null);
    if (!currentEntry?.feed_id) return;
    commands.getFeedIconData(currentEntry.feed_id).then((result) => {
      if (result.status === 'ok' && result.data) {
        setFeedIconUrl(result.data);
      }
    });
  }, [currentEntry]);

  const artworkUrl = entryThumbnail ?? feedIconUrl;

  if (!currentEntry) return null;

  const bufferingActive = isBuffering && isPlaying;
  const progress = duration > 0 ? Math.max(0, Math.min(100, (currentTime / duration) * 100)) : 0;
  const bufferedProgress =
    duration > 0 ? Math.max(0, Math.min(100, (buffered / duration) * 100)) : 0;
  const timeLabel =
    duration > 0
      ? `${formatTimestamp(currentTime)} / ${formatTimestamp(duration)}`
      : '--:-- / --:--';

  const handleToggleFloatingMode = () => {
    commands.togglePlayerWindow();
  };

  const handlePlayPause = (e: React.MouseEvent) => {
    e.stopPropagation();
    const { isPlaying: playing, pause, resume } = usePlayerStore.getState();
    if (playing) {
      pause();
    } else {
      resume();
    }
  };

  return (
    <motion.button
      type="button"
      onClick={handleToggleFloatingMode}
      className={cn(
        'relative inline-flex h-8 max-w-[15.5rem] items-center gap-1.5 overflow-hidden rounded-full border border-border/65 bg-[linear-gradient(180deg,hsl(var(--background)/0.97),hsl(var(--background)/0.9))] px-2.5 text-foreground/90 shadow-sm transition-colors hover:bg-accent/70 hover:text-foreground',
        className
      )}
      title={_(msg`Open player`)}
      data-testid="titlebar-podcast-icon"
      whileTap={shouldReduceMotion ? undefined : { scale: 0.985 }}
    >
      <AnimatePresence>
        {bufferingActive && (
          <motion.span
            aria-hidden
            className="pointer-events-none absolute inset-0 rounded-full bg-[linear-gradient(115deg,transparent_30%,hsl(var(--primary)/0.15)_50%,transparent_70%)]"
            initial={{ x: '-130%', opacity: 0 }}
            animate={
              shouldReduceMotion
                ? { opacity: 0.25 }
                : {
                    x: ['-130%', '130%'],
                    opacity: [0.15, 0.6, 0.15],
                  }
            }
            exit={{ opacity: 0 }}
            transition={{
              duration: shouldReduceMotion ? 0.2 : 1.45,
              repeat: shouldReduceMotion ? 0 : Number.POSITIVE_INFINITY,
              ease: 'easeInOut',
            }}
          />
        )}
      </AnimatePresence>

      {artworkUrl ? (
        <img
          src={artworkUrl}
          alt=""
          className="relative z-10 size-5 shrink-0 rounded-full object-cover"
        />
      ) : (
        <HugeiconsIcon
          icon={HeadphonesIcon}
          className={cn('relative z-10 h-3.5 w-3.5 shrink-0', isPlaying && 'text-primary')}
        />
      )}
      <span className="relative z-10 min-w-0 flex-1">
        <span className="block truncate text-[11px] leading-tight font-medium">
          {currentEntry.title}
        </span>
      </span>
      <span className="relative z-10 shrink-0 text-[10px] tabular-nums text-muted-foreground">
        {timeLabel}
      </span>
      <button
        type="button"
        className="relative z-10 -my-1 inline-flex h-full w-6 shrink-0 items-center justify-center rounded-full border-none bg-transparent p-0 transition-colors hover:bg-foreground/10"
        onClick={handlePlayPause}
        title={bufferingActive ? _(msg`Loading...`) : isPlaying ? _(msg`Pause`) : _(msg`Play`)}
      >
        <HugeiconsIcon
          icon={bufferingActive ? Loading03Icon : isPlaying ? PauseIcon : PlayIcon}
          className={cn('size-3', bufferingActive && 'animate-spin')}
        />
      </button>
      {/* Buffered (cached) progress - dim background bar */}
      <span
        aria-hidden
        className="pointer-events-none absolute right-0 bottom-0 left-0 h-[2px] origin-left bg-primary/25 transition-transform duration-300 ease-out"
        style={{ transform: `scaleX(${bufferedProgress / 100})` }}
      />
      {/* Playback progress - bright foreground bar */}
      <span
        aria-hidden
        className="pointer-events-none absolute right-0 bottom-0 left-0 h-[2px] origin-left bg-primary/85 transition-transform duration-250 ease-out"
        style={{ transform: `scaleX(${progress / 100})` }}
      />
    </motion.button>
  );
}
