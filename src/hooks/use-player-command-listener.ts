import { listen } from '@tauri-apps/api/event';
import { useEffect } from 'react';
import { PLAYER_CMD, type PlayerCmdPayload } from '@/lib/player-events';
import { buildPodcastDownloadFileName } from '@/lib/podcast-utils';
import { commands } from '@/lib/tauri-bindings';
import { usePlayerStore } from '@/store/player-store';
import { useUIStore } from '@/store/ui-store';

export function usePlayerCommandListener() {
  useEffect(() => {
    const unlisten = listen<PlayerCmdPayload>(PLAYER_CMD, (event) => {
      const { action, value } = event.payload;
      const store = usePlayerStore.getState();

      switch (action) {
        case 'play':
          store.resume();
          break;
        case 'pause':
          store.pause();
          break;
        case 'toggle-play-pause':
          if (store.isPlaying) {
            store.pause();
          } else if (store.currentEntry) {
            store.resume();
          }
          break;
        case 'seek':
          if (typeof value === 'number') store.seek(value);
          break;
        case 'skip-forward':
          store.seek(Math.min(store.duration, store.currentTime + 30));
          break;
        case 'skip-back':
          store.seek(Math.max(0, store.currentTime - 15));
          break;
        case 'set-speed':
          if (typeof value === 'number') store.setSpeed(value);
          break;
        case 'set-volume':
          if (typeof value === 'number') store.setVolume(value);
          break;
        case 'toggle-mute':
          store.toggleMute();
          break;
        case 'download': {
          const { currentEntry, currentEnclosure } = store;
          if (currentEntry && currentEnclosure) {
            const fileName = buildPodcastDownloadFileName(currentEntry.title, currentEnclosure);
            useUIStore.getState().setDownloadsOpen(true);
            commands.downloadFile(currentEnclosure.url, fileName, 'audio');
          }
          break;
        }
        case 'dismiss':
          store.dismiss();
          break;
        case 'play-entry': {
          if (typeof value !== 'string') break;
          const item = store.queue.find((q) => q.entry.id === value);
          if (item) {
            store.removeFromQueue(item.entry.id);
            store.play(item.entry, item.enclosure);
          }
          break;
        }
        case 'next-track': {
          const next = store.queue[0];
          if (next) {
            store.removeFromQueue(next.entry.id);
            store.play(next.entry, next.enclosure);
          }
          break;
        }
        case 'prev-track': {
          // Restart current track (no history tracking yet)
          if (store.currentEntry) {
            store.seek(0);
          }
          break;
        }
      }
    });

    return () => {
      unlisten.then((fn) => fn());
    };
  }, []);
}
