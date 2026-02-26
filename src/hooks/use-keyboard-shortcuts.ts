import { useEffect } from 'react';
import type { CommandContext } from '@/lib/commands/types';
import { usePlayerStore } from '@/store/player-store';
import { useUIStore } from '@/store/ui-store';

/**
 * Handles global keyboard shortcuts for the application.
 *
 * General:
 * - Cmd/Ctrl+, : Open preferences
 * - Cmd/Ctrl+1 : Toggle left sidebar
 * - Cmd/Ctrl+D : Toggle downloads panel
 *
 * Podcast playback (when a podcast is loaded):
 * - Space       : Play / Pause (only when no input focused)
 * - Left arrow  : Skip back 15 s
 * - Right arrow : Skip forward 30 s
 * - [ / ]       : Decrease / Increase playback speed (0.25 steps)
 * - M           : Toggle mute
 * - Shift+S     : Toggle "stop after current" episode
 */
export function useKeyboardShortcuts(commandContext: CommandContext) {
  useEffect(() => {
    const isTyping = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      return (
        tag === 'INPUT' ||
        tag === 'TEXTAREA' ||
        (e.target as HTMLElement)?.isContentEditable === true
      );
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      // ── Modifier shortcuts (Cmd/Ctrl+key) ──
      if (e.metaKey || e.ctrlKey) {
        switch (e.key) {
          case ',': {
            e.preventDefault();
            commandContext.openPreferences();
            return;
          }
          case '1': {
            e.preventDefault();
            const { leftSidebarVisible, setLeftSidebarVisible } = useUIStore.getState();
            setLeftSidebarVisible(!leftSidebarVisible);
            return;
          }
          case 'd': {
            e.preventDefault();
            const { downloadsOpen, setDownloadsOpen } = useUIStore.getState();
            setDownloadsOpen(!downloadsOpen);
            return;
          }
        }
      }

      // ── Podcast shortcuts (no modifier, skip if typing) ──
      if (isTyping(e)) return;

      const player = usePlayerStore.getState();
      const hasPodcast = player.currentEntry !== null;
      if (!hasPodcast) return;

      switch (e.key) {
        case ' ': {
          e.preventDefault();
          if (player.isPlaying) player.pause();
          else player.resume();
          break;
        }
        case 'ArrowLeft': {
          e.preventDefault();
          player.seek(Math.max(0, player.currentTime - 15));
          break;
        }
        case 'ArrowRight': {
          e.preventDefault();
          player.seek(Math.min(player.duration, player.currentTime + 30));
          break;
        }
        case '[': {
          e.preventDefault();
          const nextSpeed = Math.max(0.5, Math.round((player.playbackSpeed - 0.25) * 100) / 100);
          player.setSpeed(nextSpeed);
          break;
        }
        case ']': {
          e.preventDefault();
          const nextSpeed = Math.min(3, Math.round((player.playbackSpeed + 0.25) * 100) / 100);
          player.setSpeed(nextSpeed);
          break;
        }
        case 'm':
        case 'M': {
          if (e.shiftKey) return; // Shift+M reserved
          e.preventDefault();
          player.toggleMute();
          break;
        }
        case 'S': {
          // Shift+S only
          if (!e.shiftKey) return;
          e.preventDefault();
          player.toggleStopAfterCurrent();
          break;
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [commandContext]);
}
