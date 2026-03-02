import { i18n } from '@lingui/core';
import { msg } from '@lingui/core/macro';
import { listen } from '@tauri-apps/api/event';
import { useEffect } from 'react';
import { toast } from 'sonner';
import { PLAYER_CMD, type PlayerCmdPayload } from '@/lib/player-events';
import { buildPodcastDownloadFileName } from '@/lib/podcast-utils';
import { commands } from '@/lib/tauri-bindings';
import { usePlayerStore } from '@/store/player-store';
import { useUIStore } from '@/store/ui-store';

const _ = i18n._.bind(i18n);

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
            void commands.downloadFile(currentEnclosure.url, fileName, 'audio').then((result) => {
              if (result.status === 'error') {
                toast.error(_(msg`Download Failed`), { description: result.error });
              }
            });
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
            store.play(item.entry, item.enclosure);
          }
          break;
        }
        case 'next-track': {
          // Find the entry after the current one in the queue
          const currentId = store.currentEntry?.id;
          const currentIdx = currentId
            ? store.queue.findIndex((q) => q.entry.id === currentId)
            : -1;
          const nextIdx = currentIdx >= 0 ? currentIdx + 1 : 0;
          const next = store.queue[nextIdx];
          if (next) {
            store.play(next.entry, next.enclosure);
          }
          break;
        }
        case 'prev-track': {
          // Find the entry before the current one in the queue, or restart
          const curId = store.currentEntry?.id;
          const curIdx = curId ? store.queue.findIndex((q) => q.entry.id === curId) : -1;
          const prevItem = curIdx > 0 ? store.queue[curIdx - 1] : undefined;
          if (prevItem) {
            store.play(prevItem.entry, prevItem.enclosure);
          } else if (store.currentEntry) {
            store.seek(0);
          }
          break;
        }
        case 'shuffle-queue':
          store.shuffleQueue();
          break;
        case 'clear-queue':
          store.clearQueue();
          break;
        case 'remove-from-queue':
          if (typeof value === 'string') store.removeFromQueue(value);
          break;
      }
    });

    return () => {
      unlisten.then((fn) => fn());
    };
  }, []);
}
