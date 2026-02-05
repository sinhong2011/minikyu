import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { AnimatePresence, motion, useMotionValue, useTransform } from 'motion/react';
import { useEffect, useRef } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { useReaderSettings } from '@/hooks/use-reader-settings';
import { logger } from '@/lib/logger';
import { cn } from '@/lib/utils';
import { useEntry } from '@/services/miniflux';
import { useToggleEntryStar } from '@/services/miniflux/entries';
import { EntryReadingHeader } from './EntryReadingHeader';
import { SafeHtml } from './SafeHtml';

interface EntryReadingProps {
  entryId: string;
  onNavigatePrev?: () => void;
  onNavigateNext?: () => void;
  hasPrev?: boolean;
  hasNext?: boolean;
}

export function EntryReading({
  entryId,
  onNavigatePrev,
  onNavigateNext,
  hasPrev = false,
  hasNext = false,
}: EntryReadingProps) {
  const { _ } = useLingui();
  const { data: entry, isLoading, error } = useEntry(entryId);
  const toggleStar = useToggleEntryStar();
  const { fontSize, lineWidth, fontFamily } = useReaderSettings();
  const scrollRef = useRef<HTMLDivElement>(null);
  const scrollY = useMotionValue(0);

  const easeOutCubic = (t: number) => 1 - (1 - t) ** 3;

  const titleOpacity = useTransform(scrollY, [0, 100], [1, 0], { ease: easeOutCubic });
  const titleScale = useTransform(scrollY, [0, 100], [1, 0.95], { ease: easeOutCubic });
  const titleY = useTransform(scrollY, [0, 100], [0, -10], { ease: easeOutCubic });
  const titleMaxHeight = useTransform(scrollY, [0, 100], [200, 0], { ease: easeOutCubic });
  const smallTitleOpacity = useTransform(scrollY, [60, 120], [0, 1], { ease: easeOutCubic });
  const smallTitleHeight = useTransform(scrollY, [60, 120], [0, 32], { ease: easeOutCubic });
  const headerPadding = useTransform(scrollY, [0, 100], [14, 8], { ease: easeOutCubic });

  useEffect(() => {
    if (entry) {
      logger.info('Entry loaded for reading', { id: entry.id, title: entry.title });
    }
  }, [entry]);

  useEffect(() => {
    const viewport = scrollRef.current?.querySelector('[data-slot="scroll-area-viewport"]');
    if (!viewport) return;

    viewport.scrollTop = 0;
    scrollY.set(0);

    const handleScroll = () => {
      scrollY.set(viewport.scrollTop);
    };

    viewport.addEventListener('scroll', handleScroll, { passive: true });
    return () => viewport.removeEventListener('scroll', handleScroll);
  }, [scrollY]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        e.defaultPrevented
      ) {
        return;
      }

      const viewport = scrollRef.current?.querySelector('[data-slot="scroll-area-viewport"]');

      if (e.key === ' ') {
        if (!viewport) return;
        e.preventDefault();
        const scrollAmount = viewport.clientHeight * 0.8;
        viewport.scrollBy({
          top: e.shiftKey ? -scrollAmount : scrollAmount,
          behavior: 'smooth',
        });
      } else if (e.key === 'h' || e.key === 'ArrowLeft') {
        if (hasPrev && onNavigatePrev) {
          e.preventDefault();
          onNavigatePrev();
        }
      } else if (e.key === 'l' || e.key === 'ArrowRight') {
        if (hasNext && onNavigateNext) {
          e.preventDefault();
          onNavigateNext();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onNavigatePrev, onNavigateNext, hasPrev, hasNext]);

  if (isLoading) {
    return (
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
    );
  }

  if (error || !entry) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-muted-foreground">{error ? String(error) : _(msg`Entry not found`)}</p>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <EntryReadingHeader
        entry={entry}
        onNavigatePrev={onNavigatePrev}
        onNavigateNext={onNavigateNext}
        hasPrev={hasPrev}
        hasNext={hasNext}
        onToggleStar={() => toggleStar.mutate(entry.id)}
        headerPadding={headerPadding}
        smallTitleOpacity={smallTitleOpacity}
        smallTitleHeight={smallTitleHeight}
        titleOpacity={titleOpacity}
        titleScale={titleScale}
        titleY={titleY}
        titleMaxHeight={titleMaxHeight}
      />

      <ScrollArea className="flex-1 min-h-0" ref={scrollRef}>
        <AnimatePresence mode="wait">
          <motion.div
            key={entry.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="px-8 py-10 bg-background/30"
          >
            {entry.content ? (
              <SafeHtml
                html={entry.content}
                className={cn(
                  'prose prose-slate max-w-none dark:prose-invert mx-auto transition-all duration-300',
                  fontFamily === 'serif'
                    ? 'font-serif'
                    : fontFamily === 'monospace'
                      ? 'font-mono'
                      : 'font-sans'
                )}
                style={{
                  maxWidth: `${lineWidth}ch`,
                  fontSize: `${fontSize}px`,
                  lineHeight: '1.6',
                }}
              />
            ) : (
              <p className="text-muted-foreground italic text-center py-20">
                {_(msg`No content available`)}
              </p>
            )}
          </motion.div>
        </AnimatePresence>
      </ScrollArea>
    </div>
  );
}
