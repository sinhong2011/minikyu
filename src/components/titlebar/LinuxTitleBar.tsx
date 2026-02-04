import { PanelLeftCloseIcon, PanelLeftIcon } from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react';
import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { CommandSearchButton } from '@/components/titlebar/CommandSearchButton';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useUIStore } from '@/store/ui-store';

interface LinuxTitleBarProps {
  className?: string;
  onOpenCommandPalette: () => void;
}

export function LinuxTitleBar({ className, onOpenCommandPalette }: LinuxTitleBarProps) {
  const { _ } = useLingui();
  const leftSidebarVisible = useUIStore((state) => state.leftSidebarVisible);
  const toggleLeftSidebar = useUIStore((state) => state.toggleLeftSidebar);

  return (
    <div
      data-tauri-drag-region
      className={cn(
        'flex h-10 w-full shrink-0 items-center gap-2 bg-background px-2 border-b',
        className
      )}
    >
      {/* Left: Sidebar toggle */}
      <Button
        onClick={toggleLeftSidebar}
        variant="ghost"
        size="icon"
        className="h-8 w-8 shrink-0 text-foreground/70 hover:text-foreground"
        title={_(leftSidebarVisible ? msg`Hide Left Sidebar` : msg`Show Left Sidebar`)}
      >
        {leftSidebarVisible ? (
          <HugeiconsIcon icon={PanelLeftCloseIcon} className="h-4 w-4" />
        ) : (
          <HugeiconsIcon icon={PanelLeftIcon} className="h-4 w-4" />
        )}
      </Button>

      {/* Center: Command search */}
      <div className="flex flex-1 items-center justify-center">
        <CommandSearchButton onClick={onOpenCommandPalette} />
      </div>

      {/* Right: Spacer for balance (Linux uses native decorations) */}
      <div className="flex items-center">
        <div className="h-8 w-8" />
      </div>
    </div>
  );
}
