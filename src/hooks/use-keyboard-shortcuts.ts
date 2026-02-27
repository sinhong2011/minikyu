import { useEffect } from 'react';
import type { CommandContext } from '@/lib/commands/types';
import { matchesShortcut, resolveShortcut } from '@/lib/shortcut-registry';
import { usePreferences } from '@/services/preferences';
import { usePlayerStore } from '@/store/player-store';
import { useUIStore } from '@/store/ui-store';

/**
 * Handles global keyboard shortcuts for the application.
 * Reads user-configured overrides from preferences via the shortcut registry.
 */
export function useKeyboardShortcuts(commandContext: CommandContext) {
  const { data: preferences } = usePreferences();
  const overrides = preferences?.keyboard_shortcuts;

  useEffect(() => {
    const match = (id: string, e: KeyboardEvent) =>
      matchesShortcut(e, resolveShortcut(id, overrides));

    const isTyping = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      return (
        tag === 'INPUT' ||
        tag === 'TEXTAREA' ||
        (e.target as HTMLElement)?.isContentEditable === true
      );
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      // ── General shortcuts (require modifier) ──
      if (match('open-preferences', e)) {
        e.preventDefault();
        commandContext.openPreferences();
        return;
      }
      if (match('toggle-sidebar', e)) {
        e.preventDefault();
        const { leftSidebarVisible, setLeftSidebarVisible } = useUIStore.getState();
        setLeftSidebarVisible(!leftSidebarVisible);
        return;
      }
      if (match('toggle-downloads', e)) {
        e.preventDefault();
        const { downloadsOpen, setDownloadsOpen } = useUIStore.getState();
        setDownloadsOpen(!downloadsOpen);
        return;
      }

      // ── Podcast shortcuts (no modifier, skip if typing) ──
      if (isTyping(e)) return;

      const player = usePlayerStore.getState();
      const hasPodcast = player.currentEntry !== null;
      if (!hasPodcast) return;

      if (match('podcast-play-pause', e)) {
        e.preventDefault();
        if (player.isPlaying) player.pause();
        else player.resume();
      } else if (match('podcast-skip-back', e)) {
        e.preventDefault();
        player.seek(Math.max(0, player.currentTime - 15));
      } else if (match('podcast-skip-forward', e)) {
        e.preventDefault();
        player.seek(Math.min(player.duration, player.currentTime + 30));
      } else if (match('podcast-speed-down', e)) {
        e.preventDefault();
        player.setSpeed(Math.max(0.5, Math.round((player.playbackSpeed - 0.25) * 100) / 100));
      } else if (match('podcast-speed-up', e)) {
        e.preventDefault();
        player.setSpeed(Math.min(3, Math.round((player.playbackSpeed + 0.25) * 100) / 100));
      } else if (match('podcast-mute', e)) {
        e.preventDefault();
        player.toggleMute();
      } else if (match('podcast-stop-after', e)) {
        e.preventDefault();
        player.toggleStopAfterCurrent();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [commandContext, overrides]);
}
