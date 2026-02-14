import {
  ArrowDown01Icon,
  ArrowRightIcon,
  ArrowUp01Icon,
  ViewIcon,
  ViewOffIcon,
} from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react';
import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { AnimatePresence, motion, useMotionValue, useTransform } from 'motion/react';
import { type CSSProperties, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { useReaderSettings } from '@/hooks/use-reader-settings';
import { logger } from '@/lib/logger';
import { getReaderFontStack } from '@/lib/reader-fonts';
import {
  getReaderThemePalette,
  normalizeReaderTheme,
  readerThemeOptions,
} from '@/lib/reader-theme';
import { cn } from '@/lib/utils';
import { useEntry, useToggleEntryRead, useToggleEntryStar } from '@/services/miniflux/entries';
import { EntryReadingHeader } from './EntryReadingHeader';
import { buildEntryContentWithToc } from './entry-toc';
import { SafeHtml } from './SafeHtml';

const MIN_FONT_SIZE = 14;
const MAX_FONT_SIZE = 24;
const MIN_LINE_WIDTH = 45;
const MAX_LINE_WIDTH = 80;
const MIN_LINE_HEIGHT = 1.4;
const MAX_LINE_HEIGHT = 2.2;
const LINE_HEIGHT_STEP = 0.05;

interface EntryReadingProps {
  entryId: string;
  onNavigatePrev?: () => void;
  onNavigateNext?: () => void;
  onClose?: () => void;
  onScroll?: (scrollData: {
    scrollTop: number;
    scrollHeight: number;
    clientHeight: number;
    isAtBottom: boolean;
  }) => void;
  hasPrev?: boolean;
  hasNext?: boolean;
  nextEntryTitle?: string;
  transitionDirection?: 'forward' | 'backward';
  hideNavigation?: boolean;
}

export function EntryReading({
  entryId,
  onNavigatePrev,
  onNavigateNext,
  onClose,
  onScroll,
  hasPrev = false,
  hasNext = false,
  nextEntryTitle,
  transitionDirection = 'forward',
  hideNavigation = false,
}: EntryReadingProps) {
  const { _ } = useLingui();
  const {
    chineseConversionMode,
    customConversionRules,
    bionicReading,
    fontSize,
    lineWidth,
    lineHeight,
    fontFamily,
    readerTheme,
    codeTheme,
    statusBarVisible,
    setFontSize,
    setLineWidth,
    setLineHeight,
    setReaderTheme,
    setStatusBarVisible,
  } = useReaderSettings();
  const { data: entry, isLoading, error } = useEntry(entryId);
  const toggleStar = useToggleEntryStar();
  const toggleEntryRead = useToggleEntryRead();
  const toggleEntryReadRef = useRef(toggleEntryRead);
  toggleEntryReadRef.current = toggleEntryRead;
  const onScrollRef = useRef(onScroll);
  onScrollRef.current = onScroll;
  const entryRef = useRef(entry);
  entryRef.current = entry;
  const scrollRef = useRef<HTMLDivElement>(null);
  const hasAutoMarkedAsRead = useRef(false);
  const scrollViewportRef = useRef<HTMLElement | null>(null);
  const scrollAnimationFrameRef = useRef<number | null>(null);
  const scrollY = useMotionValue(0);
  const [activeHeadingId, setActiveHeadingId] = useState<string | null>(null);
  const [hoveredHeadingId, setHoveredHeadingId] = useState<string | null>(null);
  const [readingProgress, setReadingProgress] = useState(0);
  const [isAtBottom, setIsAtBottom] = useState(false);

  const easeOutCubic = (t: number) => 1 - (1 - t) ** 3;

  const titleOpacity = useTransform(scrollY, [0, 100], [1, 0], { ease: easeOutCubic });
  const titleScale = useTransform(scrollY, [0, 100], [1, 0.95], { ease: easeOutCubic });
  const titleY = useTransform(scrollY, [0, 100], [0, -10], { ease: easeOutCubic });
  const titleMaxHeight = useTransform(scrollY, [0, 100], [200, 0], { ease: easeOutCubic });
  const smallTitleOpacity = useTransform(scrollY, [60, 120], [0, 1], { ease: easeOutCubic });
  const smallTitleHeight = useTransform(scrollY, [60, 120], [0, 32], { ease: easeOutCubic });
  const headerPadding = useTransform(scrollY, [0, 100], [14, 8], { ease: easeOutCubic });
  const readingContent = useMemo(
    () => buildEntryContentWithToc(entry?.content ?? ''),
    [entry?.content]
  );
  const showToc = readingContent.tocItems.length >= 2;
  const activeTocIndex = useMemo(
    () => readingContent.tocItems.findIndex((item) => item.id === activeHeadingId),
    [activeHeadingId, readingContent.tocItems]
  );
  const hoveredTocItem = useMemo(
    () => readingContent.tocItems.find((item) => item.id === hoveredHeadingId) ?? null,
    [hoveredHeadingId, readingContent.tocItems]
  );
  const tocLengthRange = useMemo(() => {
    const sectionLengths = readingContent.tocItems.map((item) => item.sectionLength);
    if (!sectionLengths.length) {
      return { min: 0, max: 0 };
    }

    return {
      min: Math.min(...sectionLengths),
      max: Math.max(...sectionLengths),
    };
  }, [readingContent.tocItems]);
  const previousSectionLabel = _(msg`Previous section`);
  const nextSectionLabel = _(msg`Next section`);
  const tocGroupLabel = _(msg`Article table of contents`);
  const canJumpPrev = activeTocIndex > 0;
  const canJumpNext = activeTocIndex >= 0 && activeTocIndex < readingContent.tocItems.length - 1;
  const prefersReducedMotion =
    typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const articleSlideDistance = 18;
  const articleLiftOffset = 8;
  const articleEnterOpacity = 0;
  const articleExitOpacity = 0;
  const directionalEnterY =
    transitionDirection === 'backward' ? -articleSlideDistance : articleSlideDistance;
  const directionalExitY = -articleLiftOffset;
  const articleEnterTransition = prefersReducedMotion
    ? { duration: 0 }
    : {
        y: { duration: 0.42, ease: [0.22, 1, 0.36, 1] as const },
        filter: { duration: 0.38, ease: [0.22, 1, 0.36, 1] as const },
        opacity: { duration: 0.32, ease: [0.2, 0.95, 0.35, 1] as const },
      };
  const articleExitTransition = prefersReducedMotion
    ? { duration: 0 }
    : {
        y: { duration: 0.3, ease: [0.35, 0, 0.9, 1] as const },
        filter: { duration: 0.28, ease: [0.35, 0, 0.9, 1] as const },
        opacity: { duration: 0.24, ease: [0.45, 0, 1, 1] as const },
      };
  const readerThemePalette = useMemo(() => getReaderThemePalette(readerTheme), [readerTheme]);
  const useInvertedProse = readerTheme === 'slate' || readerTheme === 'oled';
  const estimatedTotalMinutes = useMemo(() => {
    if (!entry) {
      return 1;
    }

    if (entry.reading_time && entry.reading_time > 0) {
      return entry.reading_time;
    }

    const plainText = entry.content?.replace(/<[^>]*>/g, ' ') ?? '';
    const wordCount = plainText
      .trim()
      .split(/\s+/)
      .filter((word) => word.length > 0).length;

    return Math.max(1, Math.ceil(wordCount / 220));
  }, [entry]);
  const minutesLeft = useMemo(() => {
    const remaining = estimatedTotalMinutes * (1 - readingProgress / 100);
    return Math.max(0, Math.ceil(remaining));
  }, [estimatedTotalMinutes, readingProgress]);
  const progressPercent = Math.max(0, Math.min(100, Math.round(readingProgress)));
  const progressLabel = _(msg`${progressPercent}% read`);
  const minutesLeftLabel = _(msg`${minutesLeft} min left`);
  const hideReadingStatusLabel = _(msg`Hide reading status`);
  const showReadingStatusLabel = _(msg`Show reading status`);
  const scrollToTopLabel = _(msg`Scroll to top`);
  const floatingToolbarButtonClass =
    'h-9 w-9 rounded-xl border border-transparent text-muted-foreground hover:bg-accent/70 hover:text-muted-foreground focus-visible:text-muted-foreground active:text-muted-foreground aria-expanded:text-muted-foreground';
  const readerSurfaceStyle = useMemo(
    () => ({
      willChange: 'transform, opacity, filter',
      backgroundColor: readerThemePalette.surface,
      color: readerThemePalette.text,
    }),
    [readerThemePalette.surface, readerThemePalette.text]
  );
  const readerProseStyle = useMemo(
    () =>
      ({
        maxWidth: `${lineWidth}ch`,
        fontSize: `${fontSize}px`,
        lineHeight,
        fontFamily: getReaderFontStack(fontFamily),
        '--reader-link': readerThemePalette.link,
        '--tw-prose-body': readerThemePalette.text,
        '--tw-prose-headings': readerThemePalette.text,
        '--tw-prose-lead': readerThemePalette.muted,
        '--tw-prose-links': readerThemePalette.link,
        '--tw-prose-bold': readerThemePalette.text,
        '--tw-prose-counters': readerThemePalette.muted,
        '--tw-prose-bullets': readerThemePalette.muted,
        '--tw-prose-hr': readerThemePalette.border,
        '--tw-prose-quotes': readerThemePalette.text,
        '--tw-prose-quote-borders': readerThemePalette.border,
        '--tw-prose-captions': readerThemePalette.muted,
        '--tw-prose-code': readerThemePalette.text,
        '--tw-prose-pre-code': readerThemePalette.text,
        '--tw-prose-pre-bg': 'color-mix(in oklch, var(--reader-link) 10%, transparent)',
        '--tw-prose-th-borders': readerThemePalette.border,
        '--tw-prose-td-borders': readerThemePalette.border,
      }) as CSSProperties,
    [
      fontFamily,
      fontSize,
      lineHeight,
      lineWidth,
      readerThemePalette.border,
      readerThemePalette.link,
      readerThemePalette.muted,
      readerThemePalette.text,
    ]
  );

  const cancelScrollAnimation = useCallback(() => {
    if (scrollAnimationFrameRef.current !== null) {
      cancelAnimationFrame(scrollAnimationFrameRef.current);
      scrollAnimationFrameRef.current = null;
    }
  }, []);

  const animateViewportScrollTo = useCallback(
    (viewport: HTMLElement, targetTop: number) => {
      const maxTop = Math.max(0, viewport.scrollHeight - viewport.clientHeight);
      const clampedTargetTop = Math.max(0, Math.min(targetTop, maxTop));

      if (prefersReducedMotion) {
        cancelScrollAnimation();
        viewport.scrollTop = clampedTargetTop;
        return;
      }

      const startTop = viewport.scrollTop;
      const delta = clampedTargetTop - startTop;
      if (Math.abs(delta) < 1) {
        viewport.scrollTop = clampedTargetTop;
        return;
      }

      const duration = Math.max(260, Math.min(760, Math.abs(delta) * 0.65));
      const startTime = performance.now();
      const easeInOutCubic = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);

      cancelScrollAnimation();

      const step = (now: number) => {
        const elapsed = now - startTime;
        const progress = Math.min(1, elapsed / duration);
        const easedProgress = easeInOutCubic(progress);
        viewport.scrollTop = startTop + delta * easedProgress;

        if (progress < 1) {
          scrollAnimationFrameRef.current = requestAnimationFrame(step);
          return;
        }

        scrollAnimationFrameRef.current = null;
      };

      scrollAnimationFrameRef.current = requestAnimationFrame(step);
    },
    [cancelScrollAnimation, prefersReducedMotion]
  );

  const getTocBarWidth = useCallback(
    (sectionLength: number) => {
      if (tocLengthRange.max === tocLengthRange.min) {
        return 24;
      }

      const ratio =
        (sectionLength - tocLengthRange.min) / (tocLengthRange.max - tocLengthRange.min);
      return Math.round(10 + ratio * 30);
    },
    [tocLengthRange]
  );

  const handleTocNavigation = useCallback(
    (headingId: string) => {
      const viewport = scrollViewportRef.current;
      if (!viewport) {
        return;
      }

      const targetHeading = Array.from(
        viewport.querySelectorAll<HTMLElement>('[data-reading-heading="true"]')
      ).find((headingElement) => headingElement.id === headingId);
      if (!targetHeading) {
        return;
      }

      const viewportRect = viewport.getBoundingClientRect();
      const targetRect = targetHeading.getBoundingClientRect();
      const nextScrollTop = targetRect.top - viewportRect.top + viewport.scrollTop - 96;

      animateViewportScrollTo(viewport, nextScrollTop);
      setActiveHeadingId(headingId);
    },
    [animateViewportScrollTo]
  );
  const handleJumpBySection = useCallback(
    (direction: -1 | 1) => {
      if (!readingContent.tocItems.length) {
        return;
      }

      const baseIndex = activeTocIndex >= 0 ? activeTocIndex : 0;
      const nextIndex = Math.max(
        0,
        Math.min(readingContent.tocItems.length - 1, baseIndex + direction)
      );
      const nextItem = readingContent.tocItems[nextIndex];

      if (nextItem) {
        handleTocNavigation(nextItem.id);
      }
    },
    [activeTocIndex, handleTocNavigation, readingContent.tocItems]
  );
  const handleScrollToTop = useCallback(() => {
    const viewport = scrollViewportRef.current;
    if (!viewport) {
      return;
    }
    animateViewportScrollTo(viewport, 0);
  }, [animateViewportScrollTo]);

  useEffect(() => {
    if (entry) {
      logger.info('Entry loaded for reading', { id: entry.id, title: entry.title });
    }
    hasAutoMarkedAsRead.current = false;
  }, [entry]);

  useEffect(() => {
    const viewport = scrollRef.current?.querySelector<HTMLElement>(
      '[data-slot="scroll-area-viewport"]'
    );
    if (!viewport) return;

    scrollViewportRef.current = viewport;
    cancelScrollAnimation();
    viewport.scrollTop = 0;
    scrollY.set(0);
    setReadingProgress(0);
    setActiveHeadingId(readingContent.tocItems[0]?.id ?? null);

    requestAnimationFrame(() => {
      viewport.focus({ preventScroll: true });
    });

    const handleScroll = () => {
      scrollY.set(viewport.scrollTop);
      const maxScrollable = viewport.scrollHeight - viewport.clientHeight;
      const progress =
        maxScrollable <= 0 ? 100 : Math.round((viewport.scrollTop / maxScrollable) * 100);
      const normalizedProgress = Math.max(0, Math.min(100, progress));
      setReadingProgress((prev) => (prev === normalizedProgress ? prev : normalizedProgress));

      const distanceFromBottom = viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight;
      const atBottom = distanceFromBottom < 200;
      setIsAtBottom(atBottom);

      if (onScrollRef.current) {
        onScrollRef.current({
          scrollTop: viewport.scrollTop,
          scrollHeight: viewport.scrollHeight,
          clientHeight: viewport.clientHeight,
          isAtBottom: atBottom,
        });
      }

      const currentEntry = entryRef.current;
      if (
        currentEntry &&
        currentEntry.status !== 'read' &&
        !hasAutoMarkedAsRead.current &&
        normalizedProgress >= 20
      ) {
        hasAutoMarkedAsRead.current = true;
        toggleEntryReadRef.current.mutate(currentEntry.id);
      }

      if (!showToc) {
        return;
      }

      const headingElements = Array.from(
        viewport.querySelectorAll<HTMLElement>('[data-reading-heading="true"]')
      );
      if (!headingElements.length) {
        return;
      }

      const activationTop = viewport.getBoundingClientRect().top + 120;
      let currentHeadingId = headingElements[0]?.id ?? null;

      for (const headingElement of headingElements) {
        if (headingElement.getBoundingClientRect().top <= activationTop) {
          currentHeadingId = headingElement.id;
          continue;
        }
        break;
      }

      setActiveHeadingId((prev) => (prev === currentHeadingId ? prev : currentHeadingId));
    };

    handleScroll();
    viewport.addEventListener('scroll', handleScroll, { passive: true });
    return () => viewport.removeEventListener('scroll', handleScroll);
  }, [cancelScrollAnimation, readingContent.tocItems, scrollY, showToc]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isInputTarget =
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        e.target instanceof HTMLSelectElement ||
        (e.target instanceof HTMLElement && e.target.isContentEditable);

      if (isInputTarget || e.defaultPrevented) {
        return;
      }
      if (e.metaKey || e.ctrlKey) {
        return;
      }

      const viewport = scrollRef.current?.querySelector<HTMLElement>(
        '[data-slot="scroll-area-viewport"]'
      );

      if (e.key === ' ') {
        if (!viewport) return;
        e.preventDefault();
        const scrollAmount = viewport.clientHeight * 0.8;
        const nextScrollTop = viewport.scrollTop + (e.shiftKey ? -scrollAmount : scrollAmount);
        animateViewportScrollTo(viewport, nextScrollTop);
      } else if (e.altKey && e.key === 'ArrowUp') {
        e.preventDefault();
        setLineHeight(
          Math.min(MAX_LINE_HEIGHT, Number((lineHeight + LINE_HEIGHT_STEP).toFixed(2)))
        );
      } else if (e.altKey && e.key === 'ArrowDown') {
        e.preventDefault();
        setLineHeight(
          Math.max(MIN_LINE_HEIGHT, Number((lineHeight - LINE_HEIGHT_STEP).toFixed(2)))
        );
      } else if (e.key === '=' || e.key === '+') {
        e.preventDefault();
        setFontSize(Math.min(MAX_FONT_SIZE, fontSize + 1));
      } else if (e.key === '-') {
        e.preventDefault();
        setFontSize(Math.max(MIN_FONT_SIZE, fontSize - 1));
      } else if (e.key === '[') {
        e.preventDefault();
        setLineWidth(Math.max(MIN_LINE_WIDTH, lineWidth - 2));
      } else if (e.key === ']') {
        e.preventDefault();
        setLineWidth(Math.min(MAX_LINE_WIDTH, lineWidth + 2));
      } else if (e.shiftKey && e.key.toLowerCase() === 't') {
        e.preventDefault();
        const currentTheme = normalizeReaderTheme(readerTheme);
        const currentIndex = readerThemeOptions.indexOf(currentTheme);
        const nextIndex = (currentIndex + 1) % readerThemeOptions.length;
        const nextTheme = readerThemeOptions[nextIndex];
        if (nextTheme) {
          setReaderTheme(nextTheme);
        }
      } else if (e.key === 'h') {
        if (hasPrev && onNavigatePrev) {
          e.preventDefault();
          onNavigatePrev();
        }
      } else if (e.key === 'j') {
        if (hasNext && onNavigateNext) {
          e.preventDefault();
          onNavigateNext();
        }
      } else if (e.key.toLowerCase() === 'm') {
        const currentEntry = entryRef.current;
        if (currentEntry && !toggleEntryReadRef.current.isPending) {
          e.preventDefault();
          toggleEntryReadRef.current.mutate(currentEntry.id);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    animateViewportScrollTo,
    fontSize,
    hasNext,
    hasPrev,
    lineHeight,
    lineWidth,
    onNavigateNext,
    onNavigatePrev,
    readerTheme,
    setFontSize,
    setLineHeight,
    setLineWidth,
    setReaderTheme,
  ]);

  useEffect(() => {
    if (!showToc) {
      setHoveredHeadingId(null);
    }
  }, [showToc]);

  useEffect(() => {
    return () => {
      cancelScrollAnimation();
    };
  }, [cancelScrollAnimation]);

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
        onClose={onClose}
        hasPrev={hasPrev}
        hasNext={hasNext}
        hideNavigation={hideNavigation}
        onToggleStar={() => toggleStar.mutate(entry.id)}
        onToggleRead={() => toggleEntryRead.mutate(entry.id)}
        isRead={entry.status === 'read'}
        isTogglingRead={toggleEntryRead.isPending}
        headerPadding={headerPadding}
        smallTitleOpacity={smallTitleOpacity}
        smallTitleHeight={smallTitleHeight}
        titleOpacity={titleOpacity}
        titleScale={titleScale}
        titleY={titleY}
        titleMaxHeight={titleMaxHeight}
      />

      <div className="relative flex-1 min-h-0">
        <ScrollArea className="h-full min-h-0" ref={scrollRef}>
          <AnimatePresence mode="wait">
            <motion.div
              key={entry.id}
              initial={{
                opacity: articleEnterOpacity,
                y: directionalEnterY,
                filter: 'blur(0.8px)',
              }}
              animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
              exit={{
                opacity: articleExitOpacity,
                y: directionalExitY,
                filter: 'blur(0.8px)',
                transition: articleExitTransition,
              }}
              transition={articleEnterTransition}
              className="px-4 py-8 transition-colors duration-300 sm:px-6 sm:py-10 lg:px-10 xl:pr-24"
              style={readerSurfaceStyle}
            >
              {entry.content ? (
                <SafeHtml
                  html={readingContent.html}
                  bionicEnglish={bionicReading}
                  chineseConversionMode={chineseConversionMode}
                  customConversionRules={customConversionRules}
                  codeTheme={codeTheme}
                  className={cn(
                    'mx-auto max-w-none break-words prose prose-slate transition-all duration-300 dark:prose-invert',
                    useInvertedProse && 'prose-invert',
                    '[&_h1]:mb-5 [&_h1]:text-3xl [&_h1]:leading-tight [&_h1]:font-semibold',
                    '[&_h2]:mt-10 [&_h2]:mb-4 [&_h2]:text-2xl [&_h2]:leading-snug [&_h2]:font-semibold',
                    '[&_h3]:mt-8 [&_h3]:mb-3 [&_h3]:text-xl [&_h3]:leading-snug [&_h3]:font-semibold',
                    '[&_p]:my-5 [&_p]:tracking-[0.01em]',
                    '[&_ul]:my-5 [&_ol]:my-5 [&_li]:my-1.5',
                    '[&_a]:break-all [&_a]:underline [&_a]:decoration-[color:var(--reader-link)] [&_a]:underline-offset-4',
                    '[&_blockquote]:my-8 [&_blockquote]:rounded-r-xl [&_blockquote]:border-l-4 [&_blockquote]:border-primary/40 [&_blockquote]:bg-primary/5 [&_blockquote]:px-4 [&_blockquote]:py-2 [&_blockquote]:text-foreground/90',
                    '[&_hr]:my-8 [&_hr]:border-border/60',
                    '[&_table]:text-sm [&_table]:leading-relaxed',
                    '[&_img]:my-8',
                    '[&_p:first-child]:mt-0 [&>*:last-child]:mb-0'
                  )}
                  style={readerProseStyle}
                />
              ) : (
                <p className="text-muted-foreground italic text-center py-20">
                  {_(msg`No content available`)}
                </p>
              )}
            </motion.div>
          </AnimatePresence>
        </ScrollArea>

        <AnimatePresence>
          {showToc && (
            <motion.aside
              initial={{ opacity: 0, x: 24 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 16 }}
              transition={{ duration: 0.25, ease: 'easeOut' }}
              className="pointer-events-none absolute top-1/2 right-5 z-20 hidden -translate-y-1/2 xl:flex"
            >
              <fieldset
                className="group/toc pointer-events-auto relative m-0 flex min-w-0 items-center gap-4 border-0 p-0"
                onMouseLeave={() => setHoveredHeadingId(null)}
              >
                <legend className="sr-only">{tocGroupLabel}</legend>
                <AnimatePresence>
                  {hoveredTocItem && (
                    <motion.div
                      initial={{ opacity: 0, x: 16, scale: 0.94, filter: 'blur(6px)' }}
                      animate={{ opacity: 1, x: 0, scale: 1, filter: 'blur(0px)' }}
                      exit={{ opacity: 0, x: 14, scale: 0.96, filter: 'blur(4px)' }}
                      transition={{ type: 'spring', stiffness: 320, damping: 30, mass: 0.7 }}
                      className="pointer-events-none w-80 rounded-4xl border border-border/50 bg-background/85 px-5 py-4 shadow-lg backdrop-blur-xl"
                    >
                      <p className="line-clamp-1 text-lg text-muted-foreground">
                        {hoveredTocItem.text}
                      </p>
                      {hoveredTocItem.preview && (
                        <p className="mt-1.5 line-clamp-3 text-sm leading-relaxed text-foreground/85">
                          {hoveredTocItem.preview}
                        </p>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>

                <div className="flex flex-col items-end gap-3">
                  <motion.button
                    type="button"
                    onClick={() => handleJumpBySection(-1)}
                    disabled={!canJumpPrev}
                    aria-label={previousSectionLabel}
                    whileHover={canJumpPrev ? { scale: 1.08, y: -1 } : undefined}
                    whileTap={canJumpPrev ? { scale: 0.92 } : undefined}
                    className={cn(
                      'grid h-7 w-7 place-items-center rounded-full border border-transparent bg-background/30 text-muted-foreground transition-[opacity,transform,color,background-color,border-color] duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60',
                      'opacity-0 translate-x-1 group-hover/toc:translate-x-0 group-hover/toc:opacity-100 focus-visible:translate-x-0 focus-visible:opacity-100',
                      canJumpPrev &&
                        'hover:border-border/50 hover:bg-background/70 hover:text-foreground',
                      !canJumpPrev && 'pointer-events-none opacity-0'
                    )}
                  >
                    <motion.span whileHover={canJumpPrev ? { y: -1 } : undefined}>
                      <HugeiconsIcon icon={ArrowUp01Icon} className="size-4" />
                    </motion.span>
                  </motion.button>

                  <ul className="space-y-3">
                    {readingContent.tocItems.map((item, index) => {
                      const isActive = item.id === activeHeadingId;
                      const barWidth = getTocBarWidth(item.sectionLength);

                      return (
                        <motion.li
                          key={item.id}
                          initial={{ opacity: 0, x: 6 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ duration: 0.16, delay: Math.min(index * 0.03, 0.16) }}
                          className="flex justify-end"
                        >
                          <motion.button
                            type="button"
                            onClick={() => handleTocNavigation(item.id)}
                            onMouseEnter={() => setHoveredHeadingId(item.id)}
                            onFocus={() => setHoveredHeadingId(item.id)}
                            onBlur={() => setHoveredHeadingId(null)}
                            aria-current={isActive ? 'true' : undefined}
                            aria-label={item.text}
                            whileHover={{ x: -2, scaleX: 1.06 }}
                            whileTap={{ scaleX: 0.96 }}
                            className={cn(
                              'group relative flex h-3 items-center justify-end rounded-full transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60',
                              isActive ? 'opacity-100' : 'opacity-70 hover:opacity-100'
                            )}
                            style={{ width: `${barWidth}px` }}
                          >
                            <motion.span
                              className={cn(
                                'block h-[2px] w-full rounded-full transition-all',
                                isActive
                                  ? 'bg-foreground shadow-[0_0_12px_hsl(var(--foreground)/0.35)]'
                                  : 'bg-muted-foreground/70 group-hover/toc:bg-muted-foreground'
                              )}
                              animate={isActive ? { scaleX: 1.08 } : { scaleX: 1 }}
                              transition={{ type: 'spring', stiffness: 420, damping: 28 }}
                            />
                          </motion.button>
                        </motion.li>
                      );
                    })}
                  </ul>

                  <motion.button
                    type="button"
                    onClick={() => handleJumpBySection(1)}
                    disabled={!canJumpNext}
                    aria-label={nextSectionLabel}
                    whileHover={canJumpNext ? { scale: 1.08, y: 1 } : undefined}
                    whileTap={canJumpNext ? { scale: 0.92 } : undefined}
                    className={cn(
                      'grid h-7 w-7 place-items-center rounded-full border border-transparent bg-background/30 text-muted-foreground transition-[opacity,transform,color,background-color,border-color] duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60',
                      'opacity-0 translate-x-1 group-hover/toc:translate-x-0 group-hover/toc:opacity-100 focus-visible:translate-x-0 focus-visible:opacity-100',
                      canJumpNext &&
                        'hover:border-border/50 hover:bg-background/70 hover:text-foreground',
                      !canJumpNext && 'pointer-events-none opacity-0'
                    )}
                  >
                    <motion.span whileHover={canJumpNext ? { y: 1 } : undefined}>
                      <HugeiconsIcon icon={ArrowDown01Icon} className="size-4" />
                    </motion.span>
                  </motion.button>
                </div>
              </fieldset>
            </motion.aside>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {readingProgress > 8 && (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 12 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
              className="absolute right-4 bottom-14 z-20"
            >
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className={floatingToolbarButtonClass}
                aria-label={scrollToTopLabel}
                onClick={handleScrollToTop}
              >
                <HugeiconsIcon icon={ArrowUp01Icon} className="h-4 w-4" strokeWidth={2} />
              </Button>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {isAtBottom && hasNext && nextEntryTitle && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 5 }}
              transition={{ duration: 0.2 }}
              className="absolute bottom-2 left-1/2 -translate-x-1/2"
            >
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="gap-1.5 text-sm opacity-50 hover:opacity-80"
                onClick={() => {
                  if (onNavigateNext) {
                    onNavigateNext();
                  }
                }}
              >
                <span className="max-w-48 truncate">{nextEntryTitle}</span>
                <HugeiconsIcon icon={ArrowRightIcon} className="h-3 w-3" />
              </Button>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence mode="wait">
          {statusBarVisible ? (
            <motion.footer
              key="reading-status"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 12 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
              className="pointer-events-none absolute bottom-2 left-2 z-20"
            >
              <div className="pointer-events-auto flex items-center gap-1.5 rounded-md border border-border/60 bg-background/92 px-2 py-1 text-[10px] leading-none text-muted-foreground shadow-sm">
                <span className="font-medium tracking-wide">{progressLabel}</span>
                <span aria-hidden className="opacity-50">
                  •
                </span>
                <span>{minutesLeftLabel}</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-5 w-5 rounded-sm border border-transparent text-muted-foreground hover:bg-accent/70 hover:text-muted-foreground focus-visible:text-muted-foreground active:text-muted-foreground aria-expanded:text-muted-foreground"
                  aria-label={hideReadingStatusLabel}
                  onClick={() => setStatusBarVisible(false)}
                >
                  <HugeiconsIcon icon={ViewOffIcon} className="h-3.5 w-3.5" strokeWidth={2} />
                </Button>
              </div>
            </motion.footer>
          ) : (
            <motion.div
              key="reading-status-toggle"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 12 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
              className="absolute bottom-2 left-2 z-20"
            >
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className={floatingToolbarButtonClass}
                aria-label={showReadingStatusLabel}
                onClick={() => setStatusBarVisible(true)}
              >
                <HugeiconsIcon icon={ViewIcon} className="h-4 w-4" strokeWidth={2} />
              </Button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
