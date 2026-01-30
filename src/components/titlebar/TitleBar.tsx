import { LinuxTitleBar } from '@/components/titlebar/LinuxTitleBar';
import { WindowTitleBar } from '@/components/titlebar/WindowTitleBar';
import type { AppPlatform } from '@/hooks/use-platform';
import { usePlatform } from '@/hooks/use-platform';
import { cn } from '@/lib/utils';
import { useUIStore } from '@/store/ui-store';

interface TitleBarProps {
  className?: string;
  forcePlatform?: AppPlatform;
}

export function TitleBar({ className, forcePlatform }: TitleBarProps) {
  const detectedPlatform = usePlatform();
  const platform = import.meta.env.DEV && forcePlatform ? forcePlatform : detectedPlatform;
  const setCommandPaletteOpen = useUIStore((state) => state.setCommandPaletteOpen);

  const handleOpenCommandPalette = () => setCommandPaletteOpen(true);

  // Linux uses native window decorations, so no custom window controls needed
  if (platform === 'linux') {
    return <LinuxTitleBar className={className} onOpenCommandPalette={handleOpenCommandPalette} />;
  }

  // Windows and macOS share the same layout with platform-specific controls
  return (
    <WindowTitleBar
      className={cn(className)}
      platform={platform}
      onOpenCommandPalette={handleOpenCommandPalette}
    />
  );
}
