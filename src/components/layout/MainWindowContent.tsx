import { AnimatePresence, motion } from 'motion/react';
import { useCallback, useRef } from 'react';
import { EntryEmptyState } from '@/components/miniflux/EntryEmptyState';
import { EntryReading } from '@/components/miniflux/EntryReading';
import { InAppBrowserPane } from '@/components/miniflux/InAppBrowserPane';
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '@/components/ui/resizable';
import { useInAppBrowser } from '@/hooks/use-in-app-browser';
import { cn } from '@/lib/utils';
import { usePreferences, useSavePreferences } from '@/services/preferences';
import { useUIStore } from '@/store/ui-store';

interface MainWindowContentProps {
  children?: React.ReactNode;
  className?: string;
  onNavigatePrev?: () => void;
  onNavigateNext?: () => void;
  onClose?: () => void;
  hasPrev?: boolean;
  hasNext?: boolean;
  nextEntryTitle?: string;
  entryTransitionDirection?: 'forward' | 'backward';
}

export function MainWindowContent({
  children,
  className,
  onNavigatePrev,
  onNavigateNext,
  onClose,
  hasPrev = false,
  hasNext = false,
  nextEntryTitle,
  entryTransitionDirection = 'forward',
}: MainWindowContentProps) {
  const lastQuickPaneEntry = useUIStore((state) => state.lastQuickPaneEntry);
  const selectedEntryId = useUIStore((state) => state.selectedEntryId);
  const { openBrowser, closeBrowser, browserContentRef, inAppBrowserUrl } = useInAppBrowser();
  const { data: preferences } = usePreferences();
  const savePreferences = useSavePreferences();
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savedWidth = preferences?.layout_entry_list_width ?? undefined;

  const handlePanelResize = useCallback(
    (panelSize: { inPixels: number; asPercentage: number }) => {
      if (!preferences) return;
      const width = Math.round(panelSize.inPixels);
      if (width === (preferences.layout_entry_list_width ?? 435)) return;
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(() => {
        savePreferences.mutate({
          ...preferences,
          // biome-ignore lint/style/useNamingConvention: preferences field name
          layout_entry_list_width: width,
        });
      }, 500);
    },
    [preferences, savePreferences]
  );

  return (
    <div data-frosted className={cn('flex h-full min-w-0 flex-col bg-background', className)}>
      {children ? (
        <ResizablePanelGroup orientation="horizontal" className="h-full">
          <ResizablePanel
            id="entry-list"
            defaultSize={savedWidth ?? 435}
            minSize={380}
            maxSize={480}
            onResize={handlePanelResize}
          >
            <div className="h-full overflow-hidden">{children}</div>
          </ResizablePanel>
          <ResizableHandle />
          <ResizablePanel id="entry-reading">
            <div className="relative flex h-full min-w-0 flex-col overflow-hidden">
              <AnimatePresence mode="sync">
                {inAppBrowserUrl ? (
                  <motion.div
                    key="browser"
                    className="absolute inset-0 flex flex-col p-2"
                    initial={{ opacity: 0, filter: 'blur(0.8px)' }}
                    animate={{ opacity: 1, filter: 'blur(0px)' }}
                    exit={{
                      opacity: 0,
                      filter: 'blur(0.8px)',
                      transition: {
                        filter: { duration: 0.28, ease: [0.35, 0, 0.9, 1] },
                        opacity: { duration: 0.24, ease: [0.45, 0, 1, 1] },
                      },
                    }}
                    transition={{
                      filter: { duration: 0.38, ease: [0.22, 1, 0.36, 1] },
                      opacity: { duration: 0.32, ease: [0.2, 0.95, 0.35, 1] },
                    }}
                  >
                    <div className="flex h-full flex-col overflow-hidden rounded-xl border border-border/30">
                      <InAppBrowserPane
                        url={inAppBrowserUrl}
                        onClose={closeBrowser}
                        browserContentRef={browserContentRef}
                      />
                    </div>
                  </motion.div>
                ) : selectedEntryId ? (
                  <motion.div
                    key="reading"
                    className="flex h-full min-w-0 flex-col"
                    initial={{ opacity: 0, x: 18, filter: 'blur(0.8px)' }}
                    animate={{ opacity: 1, x: 0, filter: 'blur(0px)' }}
                    exit={{
                      opacity: 0,
                      x: -8,
                      filter: 'blur(0.8px)',
                      transition: {
                        x: { duration: 0.3, ease: [0.35, 0, 0.9, 1] },
                        filter: { duration: 0.28, ease: [0.35, 0, 0.9, 1] },
                        opacity: { duration: 0.24, ease: [0.45, 0, 1, 1] },
                      },
                    }}
                    transition={{
                      x: { duration: 0.42, ease: [0.22, 1, 0.36, 1] },
                      filter: { duration: 0.38, ease: [0.22, 1, 0.36, 1] },
                      opacity: { duration: 0.32, ease: [0.2, 0.95, 0.35, 1] },
                    }}
                  >
                    <EntryReading
                      entryId={selectedEntryId}
                      onNavigatePrev={onNavigatePrev}
                      onNavigateNext={onNavigateNext}
                      onClose={onClose}
                      hasPrev={hasPrev}
                      hasNext={hasNext}
                      nextEntryTitle={nextEntryTitle}
                      transitionDirection={entryTransitionDirection}
                      onOpenInAppBrowser={openBrowser}
                    />
                  </motion.div>
                ) : (
                  <motion.div
                    key="empty"
                    className="flex flex-1 flex-col items-center justify-center bg-muted/10"
                    initial={{ opacity: 0, filter: 'blur(0.8px)' }}
                    animate={{ opacity: 1, filter: 'blur(0px)' }}
                    exit={{
                      opacity: 0,
                      filter: 'blur(0.8px)',
                      transition: {
                        opacity: { duration: 0.24, ease: [0.45, 0, 1, 1] },
                        filter: { duration: 0.22, ease: [0.35, 0, 0.9, 1] },
                      },
                    }}
                    transition={{
                      opacity: { duration: 0.32, ease: [0.2, 0.95, 0.35, 1] },
                      filter: { duration: 0.3, ease: [0.22, 1, 0.36, 1] },
                    }}
                  >
                    <EntryEmptyState />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </ResizablePanel>
        </ResizablePanelGroup>
      ) : (
        <div className="flex flex-1 flex-col items-center justify-center">
          <h1 className="text-4xl font-bold text-foreground">
            {lastQuickPaneEntry ? `Last entry: ${lastQuickPaneEntry}` : 'Hello World'}
          </h1>
        </div>
      )}
    </div>
  );
}
