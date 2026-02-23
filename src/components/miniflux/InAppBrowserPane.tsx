import { Cancel01Icon, Globe02Icon, RefreshIcon } from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react';
import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { openUrl } from '@tauri-apps/plugin-opener';
import { motion } from 'motion/react';
import { type RefObject, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipPanel, TooltipTrigger } from '@/components/ui/tooltip';
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

  return (
    <div className={cn('flex h-full flex-col', className)}>
      {/* Toolbar — React content rendered above the native webview area */}
      <motion.div
        className="flex h-12 shrink-0 items-center gap-1 border-b bg-background px-3"
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1], delay: 0.08 }}
      >
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
    </div>
  );
}
