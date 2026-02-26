import {
  ArrowExpand01Icon,
  HeadphonesIcon,
  Loading03Icon,
  NextIcon,
  PauseIcon,
  PlayIcon,
  PreviousIcon,
  ReloadIcon,
} from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react';
import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { emit, listen } from '@tauri-apps/api/event';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { AnimatePresence, motion } from 'motion/react';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  PLAYER_DISMISSED,
  PLAYER_REQUEST_SYNC,
  PLAYER_STATE_UPDATE,
  PLAYER_TRACK_CHANGE,
  type PlayerStatePayload,
  type PlayerTrackPayload,
} from '@/lib/player-events';
import { formatTimestamp } from '@/lib/podcast-utils';
import type { Entry } from '@/lib/tauri-bindings';
import { commands } from '@/lib/tauri-bindings';

// ============================================================================
// Utilities
// ============================================================================

function applyTheme() {
  const theme = localStorage.getItem('ui-theme') || 'system';
  const root = document.documentElement;
  root.classList.remove('light', 'dark');
  if (theme === 'system') {
    const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    root.classList.add(isDark ? 'dark' : 'light');
  } else {
    root.classList.add(theme);
  }
}

function sendCmd(action: string) {
  emit('player:cmd', { action });
}

const compactFmt = new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 });
function fmtCount(n: number): string {
  return compactFmt.format(n);
}

function fmtAgo(d: Date): string {
  const s = Math.floor((Date.now() - d.getTime()) / 1000);
  if (s < 60) return 'now';
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}

const EASE = [0.25, 0.1, 0.25, 1] as const;

// ============================================================================
// Transport button — ghost style, consistent sizing
// ============================================================================

function TransportBtn({
  icon,
  onClick,
  title,
  accent,
  spinning,
}: {
  icon: typeof PlayIcon;
  onClick: () => void;
  title: string;
  accent?: boolean;
  spinning?: boolean;
}) {
  return (
    <motion.button
      type="button"
      whileTap={{ scale: 0.88 }}
      className={`inline-flex size-7 items-center justify-center rounded-full transition-colors ${
        accent
          ? 'bg-foreground/[0.08] text-foreground hover:bg-foreground/[0.14]'
          : 'text-foreground/40 hover:text-foreground/70'
      }`}
      onClick={onClick}
      title={title}
    >
      <HugeiconsIcon icon={icon} className={`size-3 ${spinning ? 'animate-spin' : ''}`} />
    </motion.button>
  );
}

// ============================================================================
// Now Playing
// ============================================================================

function NowPlaying({
  entry,
  artworkUrl,
  ps,
  collapsed,
  onExpand,
}: {
  entry: Entry | null;
  artworkUrl: string | null;
  ps: PlayerStatePayload;
  collapsed: boolean;
  onExpand: () => void;
}) {
  const { _ } = useLingui();
  const buffering = ps.isBuffering && ps.isPlaying;
  const pct = ps.duration > 0 ? (ps.currentTime / ps.duration) * 100 : 0;
  const time =
    ps.duration > 0 ? `${formatTimestamp(ps.currentTime)}  ·  ${formatTimestamp(ps.duration)}` : '';

  // Empty
  if (!entry) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="flex items-center gap-3 px-4 py-3"
      >
        <div className="flex size-8 items-center justify-center rounded-[8px] bg-foreground/[0.04]">
          <HugeiconsIcon icon={HeadphonesIcon} className="size-3.5 text-muted-foreground/20" />
        </div>
        <span className="text-[12px] text-muted-foreground/30">{_(msg`Nothing playing`)}</span>
      </motion.div>
    );
  }

  // Collapsed — floating player is open
  if (collapsed) {
    return (
      <motion.button
        type="button"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.15 }}
        className="flex w-full items-center gap-2.5 px-4 py-2.5 text-start transition-colors hover:bg-foreground/[0.03]"
        onClick={onExpand}
      >
        {artworkUrl ? (
          <img src={artworkUrl} alt="" className="size-6 shrink-0 rounded-[6px] object-cover" />
        ) : (
          <div className="flex size-6 shrink-0 items-center justify-center rounded-[6px] bg-foreground/[0.04]">
            <HugeiconsIcon icon={HeadphonesIcon} className="size-3 text-muted-foreground/30" />
          </div>
        )}
        <span className="flex-1 truncate text-[10px] text-muted-foreground/50">{entry.title}</span>
        <HugeiconsIcon icon={ArrowExpand01Icon} className="size-2.5 text-muted-foreground/15" />
      </motion.button>
    );
  }

  // Full player
  return (
    <motion.div
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -4 }}
      transition={{ duration: 0.2, ease: EASE }}
      className="px-4 pt-3 pb-2"
    >
      {/* Artwork + info + expand */}
      <div className="flex items-center gap-2.5">
        {artworkUrl ? (
          <motion.img
            src={artworkUrl}
            alt=""
            className="size-10 shrink-0 rounded-[8px] object-cover"
            layoutId="pop-art"
            transition={{ type: 'spring', stiffness: 300, damping: 25 }}
          />
        ) : (
          <div className="flex size-10 shrink-0 items-center justify-center rounded-[8px] bg-foreground/[0.04]">
            <HugeiconsIcon icon={HeadphonesIcon} className="size-4 text-muted-foreground/30" />
          </div>
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate text-[10px] text-muted-foreground/35">{entry.feed.title}</p>
          <p className="truncate text-[12px] font-semibold leading-snug tracking-tight">
            {entry.title}
          </p>
        </div>
        <button
          type="button"
          className="inline-flex size-5 shrink-0 items-center justify-center rounded text-muted-foreground/15 transition-colors hover:text-muted-foreground/50"
          onClick={onExpand}
          title={_(msg`Open player`)}
        >
          <HugeiconsIcon icon={ArrowExpand01Icon} className="size-2.5" />
        </button>
      </div>

      {/* Progress bar */}
      <div className="mt-2.5 h-[2px] overflow-hidden rounded-full bg-foreground/[0.05]">
        <motion.div
          className="h-full rounded-full bg-foreground/25"
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.4, ease: 'linear' }}
        />
      </div>

      {/* Time + transport */}
      <div className="mt-1.5 flex items-center justify-between">
        <span className="text-[9px] tabular-nums text-muted-foreground/25">{time}</span>
        <div className="flex items-center gap-px">
          <TransportBtn
            icon={PreviousIcon}
            onClick={() => sendCmd('prev-track')}
            title={_(msg`Previous`)}
          />
          <TransportBtn
            icon={buffering ? Loading03Icon : ps.isPlaying ? PauseIcon : PlayIcon}
            onClick={() => sendCmd('toggle-play-pause')}
            title={buffering ? _(msg`Loading...`) : ps.isPlaying ? _(msg`Pause`) : _(msg`Play`)}
            accent
            spinning={buffering}
          />
          <TransportBtn
            icon={NextIcon}
            onClick={() => sendCmd('next-track')}
            title={_(msg`Next`)}
          />
        </div>
      </div>
    </motion.div>
  );
}

// ============================================================================
// Feed Section
// ============================================================================

function FeedSection({
  entries,
  count,
  synced,
  syncing,
  onSync,
  onOpen,
}: {
  entries: Entry[];
  count: number;
  synced: Date | null;
  syncing: boolean;
  onSync: () => void;
  onOpen: (id: string) => void;
}) {
  const { _ } = useLingui();

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center px-4 pt-2 pb-1.5">
        <span className="flex-1 text-[10px] font-medium uppercase tracking-[0.06em] text-muted-foreground/25">
          {count > 0 ? `${fmtCount(count)} ${_(msg`unread`)}` : _(msg`All read`)}
        </span>
        <div className="flex items-center gap-1">
          {synced && (
            <span className="text-[9px] tabular-nums text-muted-foreground/15">
              {fmtAgo(synced)}
            </span>
          )}
          <motion.button
            type="button"
            whileTap={{ scale: 0.8 }}
            className="inline-flex size-4 items-center justify-center text-muted-foreground/15 transition-colors hover:text-muted-foreground/50"
            onClick={onSync}
            disabled={syncing}
            title={_(msg`Sync`)}
          >
            <HugeiconsIcon
              icon={ReloadIcon}
              className={`size-2.5 ${syncing ? 'animate-spin' : ''}`}
            />
          </motion.button>
        </div>
      </div>

      {/* Entries */}
      <div className="flex-1 overflow-y-auto px-2 pb-2">
        {entries.length === 0 ? (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="py-8 text-center text-[9px] text-muted-foreground/15"
          >
            {_(msg`No new articles`)}
          </motion.p>
        ) : (
          <AnimatePresence mode="popLayout">
            {entries.map((e, i) => (
              <motion.button
                key={e.id}
                type="button"
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ delay: i * 0.03, duration: 0.18, ease: EASE }}
                className="group flex w-full gap-2 rounded-md px-2 py-1.5 text-start transition-colors hover:bg-foreground/[0.04]"
                onClick={() => onOpen(e.id)}
              >
                <div className="min-w-0 flex-1">
                  <p className="line-clamp-1 text-[11.5px] leading-tight tracking-tight text-foreground/70 transition-colors group-hover:text-foreground">
                    {e.title}
                  </p>
                  <p className="mt-0.5 truncate text-[9px] text-muted-foreground/20 transition-colors group-hover:text-muted-foreground/35">
                    {e.feed.title}
                  </p>
                </div>
              </motion.button>
            ))}
          </AnimatePresence>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// Root
// ============================================================================

export function TrayPopover() {
  const [entry, setEntry] = useState<Entry | null>(null);
  const [artworkUrl, setArtworkUrl] = useState<string | null>(null);
  const [ps, setPs] = useState<PlayerStatePayload>({
    currentTime: 0,
    duration: 0,
    buffered: 0,
    isPlaying: false,
    isBuffering: false,
    playbackSpeed: 1,
    volume: 1,
    isMuted: false,
  });
  const [count, setCount] = useState(0);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [synced, setSynced] = useState<Date | null>(null);
  const [syncing, setSyncing] = useState(false);
  const timer = useRef<ReturnType<typeof setInterval>>(undefined);

  const fetchData = useCallback(async () => {
    try {
      const [c, e] = await Promise.all([
        commands.getUnreadCounts(),
        commands.getEntriesList({
          status: 'unread',
          limit: '10',
          order: 'published_at',
          direction: 'desc',
        }),
      ]);
      if (c.status === 'ok') setCount(Number(c.data.total) || 0);
      if (e.status === 'ok' && e.data.entries) setEntries(e.data.entries);
    } catch {
      /* non-critical */
    }
  }, []);

  useEffect(() => {
    applyTheme();
    const win = getCurrentWindow();
    const u1 = listen('theme-changed', () => applyTheme());
    const u2 = win.onFocusChanged(({ payload }) => {
      if (payload) {
        applyTheme();
        fetchData();
      }
    });
    return () => {
      u1.then((f) => f());
      u2.then((f) => f());
    };
  }, [fetchData]);

  useEffect(() => {
    const u = [
      listen<PlayerStatePayload>(PLAYER_STATE_UPDATE, (ev) => setPs(ev.payload)),
      listen<PlayerTrackPayload>(PLAYER_TRACK_CHANGE, (ev) => {
        setEntry(ev.payload.entry);
        setArtworkUrl(ev.payload.artworkUrl);
      }),
      listen(PLAYER_DISMISSED, () => {
        setEntry(null);
        setArtworkUrl(null);
        setPs((p) => ({ ...p, isPlaying: false, isBuffering: false, currentTime: 0 }));
      }),
    ];
    // Request current state from main window
    emit(PLAYER_REQUEST_SYNC, {}).catch(() => {});
    return () => {
      for (const p of u) p.then((f) => f());
    };
  }, []);

  useEffect(() => {
    const u = [
      listen('sync-started', () => setSyncing(true)),
      listen('sync-completed', () => {
        setSyncing(false);
        setSynced(new Date());
        fetchData();
      }),
    ];
    return () => {
      for (const p of u) p.then((f) => f());
    };
  }, [fetchData]);

  useEffect(() => {
    fetchData();
    timer.current = setInterval(fetchData, 5 * 60_000);
    return () => clearInterval(timer.current);
  }, [fetchData]);

  const handleExpand = () => {
    getCurrentWindow().hide();
    commands.showPlayerWindow();
  };

  const handleSync = async () => {
    if (syncing) return;
    setSyncing(true);
    const r = await commands.syncMiniflux();
    setSyncing(false);
    if (r.status === 'ok') {
      setSynced(new Date());
      fetchData();
    }
  };

  const handleOpen = (id: string) => {
    commands.trayShowWindow();
    emit('navigate-to-entry', { entryId: id });
    getCurrentWindow().hide();
  };

  return (
    <div className="flex h-screen select-none flex-col overflow-hidden rounded-xl bg-background text-foreground shadow-2xl ring-1 ring-foreground/[0.06]">
      <NowPlaying
        entry={entry}
        artworkUrl={artworkUrl}
        ps={ps}
        collapsed={false}
        onExpand={handleExpand}
      />

      <div className="mx-4 h-px bg-foreground/[0.05]" />

      <FeedSection
        entries={entries}
        count={count}
        synced={synced}
        syncing={syncing}
        onSync={handleSync}
        onOpen={handleOpen}
      />
    </div>
  );
}
