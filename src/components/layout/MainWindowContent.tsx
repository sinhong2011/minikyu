import { AnimatePresence, motion } from 'motion/react';
import { EntryEmptyState } from '@/components/miniflux/EntryEmptyState';
import { EntryReading } from '@/components/miniflux/EntryReading';
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '@/components/ui/resizable';
import { cn } from '@/lib/utils';
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

  return (
    <div className={cn('flex h-full flex-col bg-background', className)}>
      {children ? (
        <ResizablePanelGroup orientation="horizontal" className="h-full">
          <ResizablePanel defaultSize={'30%'} minSize={'25%'} maxSize={'35%'}>
            <div className="h-full overflow-hidden">{children}</div>
          </ResizablePanel>
          <ResizableHandle withHandle />
          <ResizablePanel>
            <div className="flex h-full flex-col border-l">
              <AnimatePresence initial={false} mode="wait">
                {selectedEntryId ? (
                  <motion.div
                    key="reading"
                    className="flex h-full flex-col"
                    initial={{ opacity: 0, x: 18, scale: 0.996 }}
                    animate={{ opacity: 1, x: 0, scale: 1 }}
                    exit={{ opacity: 0, x: -14, scale: 0.996 }}
                    transition={{
                      duration: 0.24,
                      ease: [0.22, 1, 0.36, 1],
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
                    />
                  </motion.div>
                ) : (
                  <motion.div
                    key="empty"
                    className="flex flex-1 flex-col items-center justify-center bg-muted/10"
                    initial={{ opacity: 0, x: -10, scale: 0.998 }}
                    animate={{ opacity: 1, x: 0, scale: 1 }}
                    exit={{ opacity: 0, x: 8, scale: 0.998 }}
                    transition={{
                      duration: 0.2,
                      ease: [0.22, 1, 0.36, 1],
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
