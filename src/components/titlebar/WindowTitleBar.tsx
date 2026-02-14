import {
  Alert01Icon,
  ArrowReloadHorizontalIcon,
  CenterFocusIcon,
  CheckmarkCircle01Icon,
  DatabaseSync01Icon,
  PanelLeftCloseIcon,
  PanelLeftIcon,
  Settings01Icon,
  ViewOffIcon,
} from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react';
import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { SyncProgressPopover } from '@/components/sync/SyncProgressPopover';
import { CommandSearchButton } from '@/components/titlebar/CommandSearchButton';
import { MacOSWindowControls } from '@/components/titlebar/MacOSWindowControls';
import { WindowsWindowControls } from '@/components/titlebar/WindowsWindowControls';
import { Button } from '@/components/ui/button';
import { useCommandContext } from '@/hooks/use-command-context';
import type { AppPlatform } from '@/hooks/use-platform';
import { executeCommand } from '@/lib/commands';
import { cn } from '@/lib/utils';
import { useIsConnected } from '@/services/miniflux/auth';
import { useSyncStore } from '@/store/sync-store';
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
  const zenModeEnabled = useUIStore((state) => state.zenModeEnabled);
  const toggleZenMode = useUIStore((state) => state.toggleZenMode);
  const { data: isConnected } = useIsConnected();
  const syncing = useSyncStore((state) => state.syncing);
  const syncError = useSyncStore((state) => state.error);
  const syncStage = useSyncStore((state) => state.currentStage);
  const commandContext = useCommandContext();

  const handleOpenSettings = async () => {
    const result = await executeCommand('open-preferences', commandContext);
    if (!result.success && result.error) {
      commandContext.showToast(result.error, 'error');
    }
  };

  const isMacOS = platform === 'macos';
  const syncStatus = syncing
    ? 'syncing'
    : syncError || syncStage === 'failed'
      ? 'failed'
      : syncStage === 'completed'
        ? 'completed'
        : 'idle';
  const syncIcon =
    syncStatus === 'syncing'
      ? ArrowReloadHorizontalIcon
      : syncStatus === 'failed'
        ? Alert01Icon
        : syncStatus === 'completed'
          ? CheckmarkCircle01Icon
          : DatabaseSync01Icon;
  const syncTitle =
    syncStatus === 'syncing'
      ? _(msg`Syncing...`)
      : syncStatus === 'failed'
        ? _(msg`Sync failed`)
        : syncStatus === 'completed'
          ? _(msg`Sync completed`)
          : _(msg`Sync Progress`);

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

        {isConnected && (
          <Button
            onClick={toggleZenMode}
            variant="ghost"
            size="icon"
            className={cn(
              'h-8 w-8 shrink-0 hover:text-foreground',
              zenModeEnabled ? 'text-primary' : 'text-foreground/70'
            )}
            title={_(zenModeEnabled ? msg`Exit Zen Mode` : msg`Enter Zen Mode`)}
          >
            <HugeiconsIcon
              icon={zenModeEnabled ? ViewOffIcon : CenterFocusIcon}
              className="h-4 w-4"
            />
          </Button>
        )}
      </div>

      {/* Center: Command search + quick actions */}
      <div data-tauri-drag-region className="flex flex-1 items-center justify-center gap-2">
        <div className="min-w-0 w-full max-w-xl">
          <CommandSearchButton onClick={onOpenCommandPalette} />
        </div>
        {isConnected && (
          <SyncProgressPopover>
            <Button
              variant="ghost"
              size="icon"
              className={cn(
                'h-8 w-8 shrink-0 hover:text-foreground',
                syncStatus === 'failed' ? 'text-destructive' : 'text-foreground/70'
              )}
              title={syncTitle}
            >
              <span
                className={cn(
                  'relative inline-flex items-center justify-center isolate',
                  syncStatus === 'syncing' && 'sync-indicator-ring'
                )}
              >
                <HugeiconsIcon
                  icon={syncIcon}
                  className={cn(
                    'h-4 w-4 transition-[transform,color,opacity] duration-200',
                    syncStatus === 'syncing' && 'sync-indicator-syncing text-primary',
                    syncStatus === 'completed' &&
                      'sync-indicator-completed text-emerald-600 dark:text-emerald-400',
                    syncStatus === 'failed' && 'sync-indicator-failed text-destructive'
                  )}
                />
              </span>
            </Button>
          </SyncProgressPopover>
        )}
        <Button
          onClick={toggleDownloads}
          variant="ghost"
          size="icon"
          className="pt-0.5 h-8 w-8 shrink-0 text-foreground/70 hover:text-foreground"
          title={_(msg`Downloads`)}
        >
          ↓
        </Button>
      </div>

      {/* Right section */}
      <div data-tauri-drag-region className="flex items-center pr-2">
        {!isMacOS && <WindowsWindowControls />}
      </div>
    </div>
  );
}
