import { Cancel01Icon } from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react';
import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
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
      <div className="flex h-10 shrink-0 items-center gap-2 border-b bg-background px-3">
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
                onClick={onClose}
                aria-label={_(msg`Close browser`)}
              >
                <HugeiconsIcon icon={Cancel01Icon} className="size-4" />
              </Button>
            }
          />
          <TooltipPanel>{_(msg`Close browser`)}</TooltipPanel>
        </Tooltip>
      </div>

      {/* Anchor section — native WKWebView is positioned exactly here */}
      <section
        ref={browserContentRef}
        aria-label={_(msg`Browser content`)}
        className="min-h-0 flex-1"
      />
    </div>
  );
}
