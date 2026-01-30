import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { PanelLeft, PanelLeftClose } from 'lucide-react';
import { CommandSearchButton } from '@/components/titlebar/CommandSearchButton';
import { MacOSWindowControls } from '@/components/titlebar/MacOSWindowControls';
import { WindowsWindowControls } from '@/components/titlebar/WindowsWindowControls';
import { Button } from '@/components/ui/button';
import type { AppPlatform } from '@/hooks/use-platform';
import { cn } from '@/lib/utils';
import { useUIStore } from '@/store/ui-store';

interface WindowTitleBarProps {
  className?: string;
  platform: Extract<AppPlatform, 'windows' | 'macos'>;
  onOpenCommandPalette: () => void;
}

export function WindowTitleBar({ className, platform, onOpenCommandPalette }: WindowTitleBarProps) {
  const { _ } = useLingui();
  const leftSidebarVisible = useUIStore((state) => state.leftSidebarVisible);
  const toggleLeftSidebar = useUIStore((state) => state.toggleLeftSidebar);

  const isMacOS = platform === 'macos';

  return (
    <div
      data-tauri-drag-region
      className={cn(
        'flex h-10 w-full shrink-0 items-center gap-2 bg-background px-2 border-b',
        className
      )}
    >
      {/* Left section */}
      <div data-tauri-drag-region className="flex items-center gap-2">
        {isMacOS && <MacOSWindowControls />}
        <Button
          onClick={toggleLeftSidebar}
          variant="ghost"
          size="icon"
          className="h-8 w-8 shrink-0 text-foreground/70 hover:text-foreground"
          title={_(leftSidebarVisible ? msg`Hide Left Sidebar` : msg`Show Left Sidebar`)}
        >
          {leftSidebarVisible ? (
            <PanelLeftClose className="h-4 w-4" />
          ) : (
            <PanelLeft className="h-4 w-4" />
          )}
        </Button>
      </div>

      {/* Center: Command search */}
      <div data-tauri-drag-region className="flex flex-1 items-center justify-center">
        <CommandSearchButton onClick={onOpenCommandPalette} />
      </div>

      {/* Right section */}
      <div data-tauri-drag-region className="flex items-center gap-2 pr-2">
        {!isMacOS && <WindowsWindowControls />}
      </div>
    </div>
  );
}
