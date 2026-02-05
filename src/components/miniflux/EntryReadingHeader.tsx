import {
  ArrowLeft02Icon,
  ArrowRight02Icon,
  HeartAddIcon,
  HeartCheckIcon,
} from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react';
import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { format, parseISO } from 'date-fns';
import { type MotionValue, motion } from 'motion/react';
import { FeedAvatar } from '@/components/miniflux/FeedAvatar';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Tooltip, TooltipPanel, TooltipTrigger } from '@/components/ui/tooltip';
import type { Entry } from '@/lib/bindings';
import { ReaderSettings } from './ReaderSettings';

interface EntryReadingHeaderProps {
  entry: Entry;
  onNavigatePrev?: () => void;
  onNavigateNext?: () => void;
  hasPrev: boolean;
  hasNext: boolean;
  onToggleStar: () => void;
  headerPadding: MotionValue<number>;
  smallTitleOpacity: MotionValue<number>;
  smallTitleHeight: MotionValue<number>;
  titleOpacity: MotionValue<number>;
  titleScale: MotionValue<number>;
  titleY: MotionValue<number>;
  titleMaxHeight: MotionValue<number>;
}

export function EntryReadingHeader({
  entry,
  onNavigatePrev,
  onNavigateNext,
  hasPrev,
  hasNext,
  onToggleStar,
  headerPadding,
  smallTitleOpacity,
  smallTitleHeight,
  titleOpacity,
  titleScale,
  titleY,
  titleMaxHeight,
}: EntryReadingHeaderProps) {
  const { _ } = useLingui();

  return (
    <motion.header
      className="sticky top-0 z-10 border-b border-border/40 bg-background/60 backdrop-blur-xl supports-[backdrop-filter]:bg-background/40 shrink-0 shadow-sm"
      style={{
        paddingLeft: 24,
        paddingRight: 24,
        paddingTop: headerPadding,
        paddingBottom: headerPadding,
        // biome-ignore lint/style/useNamingConvention: CSS property
        WebkitBackdropFilter: 'blur(24px)',
        backdropFilter: 'blur(24px)',
      }}
    >
      <div className="flex flex-col gap-2">
        <div className="flex gap-1" role="toolbar">
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9"
                  onClick={onNavigatePrev}
                  disabled={!hasPrev}
                  aria-label={_(msg`Previous entry (h or ←)`)}
                />
              }
            >
              <HugeiconsIcon icon={ArrowLeft02Icon} className="h-5 w-5" strokeWidth={2} />
            </TooltipTrigger>
            <TooltipPanel>{_(msg`Previous entry (h or ←)`)}</TooltipPanel>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9"
                  onClick={onNavigateNext}
                  disabled={!hasNext}
                  aria-label={_(msg`Next entry (l or →)`)}
                />
              }
            >
              <HugeiconsIcon icon={ArrowRight02Icon} className="h-5 w-5" strokeWidth={2} />
            </TooltipTrigger>
            <TooltipPanel>{_(msg`Next entry (l or →)`)}</TooltipPanel>
          </Tooltip>

          <Separator orientation="vertical" className="h-5 mx-1 place-self-center rounded-2xl" />

          <ReaderSettings />

          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9"
                  onClick={onToggleStar}
                  aria-label={entry.starred ? _(msg`Unstar`) : _(msg`Star`)}
                />
              }
            >
              {entry.starred ? (
                <HugeiconsIcon icon={HeartCheckIcon} className="h-5 w-5 fill-primary" />
              ) : (
                <HugeiconsIcon icon={HeartAddIcon} className="h-5 w-5" />
              )}
            </TooltipTrigger>
            <TooltipPanel>{entry.starred ? _(msg`Unstar`) : _(msg`Star`)}</TooltipPanel>
          </Tooltip>
        </div>

        <motion.div
          className="overflow-hidden px-3"
          style={{ opacity: smallTitleOpacity, height: smallTitleHeight }}
        >
          <h2 className="text-sm font-semibold truncate">{entry.title}</h2>
        </motion.div>
      </div>

      <motion.div
        style={{
          opacity: titleOpacity,
          scale: titleScale,
          y: titleY,
          maxHeight: titleMaxHeight,
          originX: 0,
          originY: 0,
          overflow: 'hidden',
        }}
        className="flex items-start justify-between space-y-3 px-3"
      >
        <div className="flex flex-col flex-1 space-y-2 pb-2">
          <a
            href={entry.url}
            target="_blank"
            rel="noopener noreferrer"
            className="hover:underline decoration-primary/50 underline-offset-4"
          >
            <h1 className="text-2xl font-bold">{entry.title}</h1>
          </a>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <FeedAvatar title={entry.feed.title} domain={entry.feed.site_url} className="size-4!" />
            <span>{entry.feed.title}</span>
            {entry.author && (
              <>
                <span>•</span>
                <span>{entry.author}</span>
              </>
            )}
            <span>•</span>
            <span>{format(parseISO(entry.published_at), 'PPp')}</span>
            {entry.reading_time && (
              <>
                <span>•</span>
                <span>{entry.reading_time} min read</span>
              </>
            )}
          </div>
        </div>
      </motion.div>
    </motion.header>
  );
}
