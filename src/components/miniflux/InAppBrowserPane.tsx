import {
  ArrowLeft01Icon,
  ArrowRight01Icon,
  Cancel01Icon,
  Globe02Icon,
  RefreshIcon,
} from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react';
import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { openUrl } from '@tauri-apps/plugin-opener';
import { AnimatePresence, animate, motion, useMotionValue, useTransform } from 'motion/react';
import { type RefObject, useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipPanel, TooltipTrigger } from '@/components/ui/tooltip';
import { useGestureSettings } from '@/hooks/use-gesture-settings';
import { commands } from '@/lib/tauri-bindings';
import { cn } from '@/lib/utils';

interface InAppBrowserPaneProps {
  url: string;
  onClose: () => void;
  browserContentRef: RefObject<HTMLElement | null>;
  className?: string;
}

export function InAppBrowserPane({
  url,
  onClose,
  browserContentRef,
  className,
}: InAppBrowserPaneProps) {
  const { _ } = useLingui();
  const { swipeRightAction, swipeThreshold } = useGestureSettings();
  const swipeProgress = useMotionValue(0);
  const swipeHintX = useTransform(swipeProgress, [0, 1], [-48, 0]);
  const swipeHintOpacity = useTransform(swipeProgress, [0, 0.3, 1], [0, 0.7, 1]);
  const swipeIconScale = useTransform(swipeProgress, [0, 0.8, 1], [0.6, 1, 1.2]);
  const swipeLabelOpacity = useTransform(swipeProgress, [0, 0.5, 1], [0, 0.5, 1]);
  const swipeContentX = useTransform(swipeProgress, [0, 1], [0, 60]);
  const swipeContentScale = useTransform(swipeProgress, [0, 1], [1, 0.98]);
  const swipeContentBorderRadius = useTransform(swipeProgress, (p: number) =>
    p > 0.05 ? `${Math.round(p * 16)}px` : '0px'
  );
  const [swipeHintVisible, setSwipeHintVisible] = useState(false);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const swipeCloseBrowser = swipeRightAction === 'close_browser';
  const swipeEnabledRef = useRef(swipeCloseBrowser);
  swipeEnabledRef.current = swipeCloseBrowser;
  const swipeThresholdRef = useRef(swipeThreshold);
  swipeThresholdRef.current = swipeThreshold;
  const paneRef = useRef<HTMLDivElement>(null);
  const toolbarRef = useRef<HTMLDivElement>(null);

  // Keep the native webview in sync whenever this element resizes.
  // ResizeObserver covers: initial mount, sidebar animation, window resize.
  useEffect(() => {
    const el = browserContentRef.current;
    if (!el) return;

    const observer = new ResizeObserver(() => {
      const rect = el.getBoundingClientRect();
      commands.resizeBrowserWebview(rect.left, rect.top, rect.width, rect.height).catch(() => {});
    });

    observer.observe(el);
    return () => observer.disconnect();
  }, [browserContentRef]);

  // Swipe right → close browser (trackpad horizontal scroll)
  useEffect(() => {
    const pane = paneRef.current;
    if (!pane) return;

    let swipeCumulativeX = 0;
    let swipeResetTimer: ReturnType<typeof setTimeout> | null = null;
    let swipeTriggered = false;

    const onWheel = (e: WheelEvent) => {
      if (!swipeEnabledRef.current) return;
      if (Math.abs(e.deltaX) < Math.abs(e.deltaY)) return;

      // Right swipe = negative deltaX
      if (e.deltaX >= 0) {
        swipeCumulativeX = 0;
        animate(swipeProgress, 0, { type: 'spring', stiffness: 300, damping: 25 }).then(() =>
          setSwipeHintVisible(false)
        );
        return;
      }

      swipeCumulativeX += Math.abs(e.deltaX);
      const threshold = swipeThresholdRef.current;
      const progress = Math.min(1, swipeCumulativeX / threshold);
      swipeProgress.set(progress);
      if (progress > 0) setSwipeHintVisible(true);

      if (swipeCumulativeX >= threshold && !swipeTriggered) {
        swipeTriggered = true;
        onCloseRef.current();
      }

      if (swipeResetTimer) clearTimeout(swipeResetTimer);
      swipeResetTimer = setTimeout(() => {
        swipeCumulativeX = 0;
        swipeTriggered = false;
        animate(swipeProgress, 0, { type: 'spring', stiffness: 300, damping: 25 }).then(() =>
          setSwipeHintVisible(false)
        );
      }, 300);
    };

    pane.addEventListener('wheel', onWheel, { passive: true });

    return () => {
      pane.removeEventListener('wheel', onWheel);
      if (swipeResetTimer) clearTimeout(swipeResetTimer);
    };
  }, [swipeProgress]);

  return (
    <div ref={paneRef} className={cn('relative flex h-full flex-col overflow-hidden', className)}>
      <motion.div
        className="flex h-full flex-col"
        style={{
          x: swipeContentX,
          scale: swipeContentScale,
          borderRadius: swipeContentBorderRadius,
          overflow: 'hidden',
        }}
      >
        {/* Toolbar — React content rendered above the native webview area */}
        <motion.div
          ref={toolbarRef}
          className="flex h-12 shrink-0 items-center gap-1 border-b bg-background px-3"
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1], delay: 0.08 }}
        >
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-7 rounded-lg"
                  onClick={() => commands.browserGoBack().catch(() => {})}
                  aria-label={_(msg`Go back`)}
                >
                  <HugeiconsIcon icon={ArrowLeft01Icon} className="size-4" />
                </Button>
              }
            />
            <TooltipPanel>{_(msg`Go back`)}</TooltipPanel>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-7 rounded-lg"
                  onClick={() => commands.browserGoForward().catch(() => {})}
                  aria-label={_(msg`Go forward`)}
                >
                  <HugeiconsIcon icon={ArrowRight01Icon} className="size-4" />
                </Button>
              }
            />
            <TooltipPanel>{_(msg`Go forward`)}</TooltipPanel>
          </Tooltip>

          <span className="flex-1 truncate text-xs text-muted-foreground select-all" title={url}>
            {url}
          </span>

          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-7 rounded-lg"
                  onClick={() => commands.reloadBrowserWebview().catch(() => {})}
                  aria-label={_(msg`Refresh`)}
                >
                  <HugeiconsIcon icon={RefreshIcon} className="size-4" />
                </Button>
              }
            />
            <TooltipPanel>{_(msg`Refresh`)}</TooltipPanel>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-7 rounded-lg"
                  onClick={() => openUrl(url).catch(() => {})}
                  aria-label={_(msg`Open in browser`)}
                >
                  <HugeiconsIcon icon={Globe02Icon} className="size-4" />
                </Button>
              }
            />
            <TooltipPanel>{_(msg`Open in browser`)}</TooltipPanel>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-7 rounded-lg"
                  onClick={onClose}
                  aria-label={_(msg`Close browser`)}
                >
                  <HugeiconsIcon icon={Cancel01Icon} className="size-4" />
                </Button>
              }
            />
            <TooltipPanel>{_(msg`Close browser`)}</TooltipPanel>
          </Tooltip>
        </motion.div>

        {/* Anchor section — native WKWebView is positioned exactly here */}
        <section
          ref={browserContentRef}
          aria-label={_(msg`Browser content`)}
          className="min-h-0 flex-1"
        />
      </motion.div>

      {/* Swipe-right close hint */}
      <AnimatePresence>
        {swipeHintVisible && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="pointer-events-none absolute inset-y-0 left-0 z-30 flex items-center"
          >
            <motion.div
              className="flex h-full w-12 flex-col items-center justify-center gap-1 rounded-r-2xl bg-background/80 backdrop-blur-md"
              style={{ x: swipeHintX, opacity: swipeHintOpacity }}
            >
              <motion.div style={{ scale: swipeIconScale }}>
                <HugeiconsIcon
                  icon={Cancel01Icon}
                  className="h-5 w-5 text-muted-foreground"
                  strokeWidth={2}
                />
              </motion.div>
              <motion.span
                className="text-[10px] font-medium text-muted-foreground"
                style={{ opacity: swipeLabelOpacity }}
              >
                {_(msg`Close`)}
              </motion.span>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
