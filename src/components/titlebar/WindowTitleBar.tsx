import { PanelLeftCloseIcon, PanelLeftIcon, Settings01Icon } from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react';
import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { CommandSearchButton } from '@/components/titlebar/CommandSearchButton';
import { MacOSWindowControls } from '@/components/titlebar/MacOSWindowControls';
import { WindowsWindowControls } from '@/components/titlebar/WindowsWindowControls';
import { Button } from '@/components/ui/button';
import { useCommandContext } from '@/hooks/use-command-context';
import type { AppPlatform } from '@/hooks/use-platform';
import { executeCommand } from '@/lib/commands';
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
  const toggleDownloads = useUIStore((state) => state.toggleDownloads);
  const commandContext = useCommandContext();

  const handleOpenSettings = async () => {
    const result = await executeCommand('open-preferences', commandContext);
    if (!result.success && result.error) {
      commandContext.showToast(result.error, 'error');
    }
  };

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
            <HugeiconsIcon icon={PanelLeftCloseIcon} className="h-4 w-4" />
          ) : (
            <HugeiconsIcon icon={PanelLeftIcon} className="h-4 w-4" />
          )}
        </Button>

        <Button
          onClick={handleOpenSettings}
          variant="ghost"
          size="icon"
          className="h-8 w-8 shrink-0 text-foreground/70 hover:text-foreground"
          title={_(msg`Settings`)}
        >
          <HugeiconsIcon icon={Settings01Icon} className="h-4 w-4" />
        </Button>
      </div>

      {/* Center: Command search */}
      <div data-tauri-drag-region className="flex flex-1 items-center justify-center">
        <CommandSearchButton onClick={onOpenCommandPalette} />
      </div>

      {/* Right section */}
      <div data-tauri-drag-region className="flex items-center gap-2 pr-2">
        <Button
          onClick={toggleDownloads}
          variant="ghost"
          size="icon"
          className="h-8 w-8 shrink-0 text-foreground/70 hover:text-foreground"
          title={_(msg`Downloads`)}
        >
          ↓
        </Button>
        {!isMacOS && <WindowsWindowControls />}
      </div>
    </div>
  );
}
