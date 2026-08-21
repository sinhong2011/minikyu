import { ArrowRightIcon } from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react';
import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { AnimatePresence, motion } from 'motion/react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { EntryReading } from '@/components/miniflux/EntryReading';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useLocalImageUrl } from '@/hooks/use-local-image-url';
import { usePlatform } from '@/hooks/use-platform';
import { useRandomEntry } from '@/hooks/use-random-entry';
import { useReaderSettings } from '@/hooks/use-reader-settings';
import {
  closeZenMode,
  forgetZenModeHistory,
  setZenModeEntry,
  useZenMode,
} from '@/hooks/use-zen-mode';
import { getReaderThemePalette } from '@/lib/reader-theme';
import { cn } from '@/lib/utils';
import { useMarkEntryRead } from '@/services/miniflux/entries';
import { usePreferences } from '@/services/preferences';

export function ZenModeView() {
  const { _ } = useLingui();
  // `?zen=` is the whole of Zen Mode's state: whether it is open and which
  // article is on screen. A reload or a shared link lands on the same piece.
  const { enabled: zenModeEnabled, entryId: currentEntryId } = useZenMode();

  const { hasEntries, isLoading, getNextRandomEntry, resetSeenEntries } = useRandomEntry();
  const { readerTheme } = useReaderSettings();
  // Round the overlay only where the window itself is rounded; a browser tab
  // and the Windows/Linux shells are square, and rounding there just lets the
  // page behind show through at the corners.
  const roundedWindow = usePlatform() === 'macos' ? 'rounded-xl' : '';
  const readerThemePalette = getReaderThemePalette(readerTheme);
  const { data: preferences } = usePreferences();

  const bgImagePath = preferences?.background_image_path;
  const bgImageUrl = useLocalImageUrl(bgImagePath);
  const bgImageOpacity = preferences?.background_image_opacity ?? 0.15;
  const bgImageBlur = preferences?.background_image_blur ?? 0;
  const bgImageSize = preferences?.background_image_size ?? 'cover';

  const [isAtBottom, setIsAtBottom] = useState(false);
  const [isLoadingNext, setIsLoadingNext] = useState(false);
  // Every article in the pool has already been shown this session. Without
  // this the draw-an-article effect below would retry forever, and each retry
  // now costs a navigation.
  const [poolExhausted, setPoolExhausted] = useState(false);

  const markEntryRead = useMarkEntryRead();
  const markEntryReadRef = useRef(markEntryRead);
  markEntryReadRef.current = markEntryRead;
  // Ids already sent this session — the mutation is idempotent, but there is no
  // point re-issuing it when the reader also auto-marked on scroll.
  const markedAsReadRef = useRef<Set<string>>(new Set());
  const currentEntryIdRef = useRef<string | null>(null);
  currentEntryIdRef.current = currentEntryId;

  /**
   * Record an article as read. Zen Mode has no list to return to, so finishing
   * an article is the only signal there is — it must not depend on the reader's
   * auto-mark-on-scroll preference, or nothing read here ever reaches History.
   */
  const markAsRead = useCallback((entryId: string | null) => {
    if (!entryId || markedAsReadRef.current.has(entryId)) return;
    markedAsReadRef.current.add(entryId);
    markEntryReadRef.current.mutate(entryId);
  }, []);

  const selectNewEntry = useCallback(() => {
    // Moving on is an explicit "done with this one".
    markAsRead(currentEntryIdRef.current);
    const entry = getNextRandomEntry();

    if (!entry) {
      setPoolExhausted(true);
      return;
    }

    setIsLoadingNext(true);
    setZenModeEntry(entry.id);
    setIsAtBottom(false);
    setTimeout(() => setIsLoadingNext(false), 100);
  }, [getNextRandomEntry, markAsRead]);

  useEffect(() => {
    if (zenModeEnabled && !currentEntryId && hasEntries && !poolExhausted) {
      selectNewEntry();
    }
  }, [zenModeEnabled, currentEntryId, hasEntries, poolExhausted, selectNewEntry]);

  useEffect(() => {
    if (!zenModeEnabled) {
      // Covers closes we did not initiate — a browser Back, an account switch.
      forgetZenModeHistory();
      resetSeenEntries();
      setPoolExhausted(false);
      markedAsReadRef.current = new Set();
    }
  }, [zenModeEnabled, resetSeenEntries]);

  const handleExit = useCallback(() => {
    // Leaving from the end of an article counts as having read it; leaving
    // part-way through does not.
    if (isAtBottom) {
      markAsRead(currentEntryIdRef.current);
    }
    closeZenMode();
  }, [isAtBottom, markAsRead]);

  useEffect(() => {
    if (!zenModeEnabled) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleExit();
        return;
      }

      if ((e.key === ' ' || e.key === 'Enter') && isAtBottom && currentEntryId) {
        e.preventDefault();
        selectNewEntry();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [zenModeEnabled, isAtBottom, currentEntryId, handleExit, selectNewEntry]);

  const handleEntryScroll = useCallback(
    (scrollData: {
      scrollTop: number;
      scrollHeight: number;
      clientHeight: number;
      isAtBottom: boolean;
    }) => {
      setIsAtBottom(scrollData.isAtBottom);
    },
    []
  );

  const handleNextArticle = useCallback(() => {
    if (hasEntries && !poolExhausted) {
      selectNewEntry();
    }
  }, [hasEntries, poolExhausted, selectNewEntry]);

  return (
    <AnimatePresence>
      {zenModeEnabled && (
        <>
          <motion.div
            key="zen-backdrop"
            data-glass
            className={cn('absolute inset-0 z-40 overflow-hidden bg-background', roundedWindow)}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
          >
            {bgImageUrl && bgImageSize !== 'tile' && (
              <img
                src={bgImageUrl}
                alt=""
                className="pointer-events-none absolute inset-0 size-full select-none"
                style={{
                  objectFit: bgImageSize as 'cover' | 'contain' | 'fill',
                  opacity: bgImageOpacity,
                  filter: bgImageBlur > 0 ? `blur(${bgImageBlur}px)` : undefined,
                  ...(bgImageBlur > 0 ? { scale: `${1 + bgImageBlur / 100}` } : {}),
                }}
              />
            )}
            {bgImageUrl && bgImageSize === 'tile' && (
              <div
                className="pointer-events-none absolute inset-0 select-none"
                style={{
                  backgroundImage: `url(${bgImageUrl})`,
                  backgroundRepeat: 'repeat',
                  backgroundSize: 'auto',
                  opacity: bgImageOpacity,
                  filter: bgImageBlur > 0 ? `blur(${bgImageBlur}px)` : undefined,
                }}
              />
            )}
          </motion.div>
          <motion.div
            key="zen-content"
            initial={{
              opacity: 0,
              scale: 0.9,
              y: 20,
              filter: 'blur(20px) brightness(1.2)',
            }}
            animate={{
              opacity: 1,
              scale: 1,
              y: 0,
              filter: 'blur(0px) brightness(1)',
            }}
            exit={{
              opacity: 0,
              scale: 0.85,
              y: -60,
              filter: 'blur(25px) brightness(0.85)',
            }}
            transition={{
              type: 'spring',
              stiffness: 200,
              damping: 25,
              mass: 1,
              filter: { duration: 0.5, ease: 'easeOut' },
            }}
            data-glass
            className={cn(
              'absolute inset-0 z-50 flex flex-col overflow-hidden bg-background shadow-2xl',
              roundedWindow
            )}
            style={{ backgroundColor: bgImagePath ? 'transparent' : readerThemePalette.surface }}
          >
            <motion.div
              className="flex-1 min-h-0 overflow-hidden"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ delay: 0.1, duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
            >
              {isLoading || isLoadingNext ? (
                <div className="flex h-full items-center justify-center">
                  <div className="w-full max-w-3xl space-y-6 p-8">
                    <Skeleton className="h-8 w-3/4" />
                    <Skeleton className="h-4 w-1/4" />
                    <div className="space-y-2 pt-4">
                      <Skeleton className="h-4 w-full" />
                      <Skeleton className="h-4 w-full" />
                      <Skeleton className="h-4 w-full" />
                      <Skeleton className="h-5/6" />
                    </div>
                  </div>
                </div>
              ) : !hasEntries || poolExhausted ? (
                <div className="flex flex-col items-center justify-center h-full gap-4">
                  <p className="text-lg opacity-60" style={{ color: readerThemePalette.text }}>
                    {_(msg`No unread entries available`)}
                  </p>
                  <Button
                    variant="ghost"
                    onClick={handleExit}
                    className="rounded-xl border border-white/10 bg-white/[0.04] px-5 backdrop-blur-sm hover:bg-white/[0.08]"
                    style={{ color: readerThemePalette.text }}
                  >
                    {_(msg`Exit Zen Mode`)}
                  </Button>
                </div>
              ) : currentEntryId ? (
                <div className="h-full">
                  <EntryReading
                    entryId={currentEntryId}
                    hasPrev={false}
                    hasNext={hasEntries}
                    hideNavigation={true}
                    onClose={handleExit}
                    onNavigateNext={selectNewEntry}
                    onScroll={handleEntryScroll}
                  />
                </div>
              ) : null}
            </motion.div>

            <AnimatePresence>
              {isAtBottom && hasEntries && !poolExhausted && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 5 }}
                  transition={{ duration: 0.2 }}
                  className="absolute bottom-2 left-1/2 -translate-x-1/2"
                >
                  <Button
                    onClick={handleNextArticle}
                    size="sm"
                    variant="ghost"
                    className="gap-1.5 rounded-xl border border-white/10 bg-white/[0.04] px-4 text-sm backdrop-blur-sm hover:bg-white/[0.08]"
                    style={{ color: readerThemePalette.text }}
                  >
                    {_(msg`Next`)}
                    <HugeiconsIcon icon={ArrowRightIcon} className="h-3 w-3" />
                  </Button>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
