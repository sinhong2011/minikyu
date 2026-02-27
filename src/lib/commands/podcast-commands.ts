import { msg } from '@lingui/core/macro';
import { commands } from '@/lib/tauri-bindings';
import { usePlayerStore } from '@/store/player-store';
import type { AppCommand } from './types';

export const podcastCommands: AppCommand[] = [
  {
    id: 'podcast-play-pause',
    label: msg`Play / Pause`,
    description: msg`Toggle podcast playback`,
    group: 'podcast',
    shortcut: 'Space',
    keywords: ['play', 'pause', 'podcast', 'audio'],
    isAvailable: (context) => context.hasPodcast(),
    execute: () => {
      const player = usePlayerStore.getState();
      if (player.isPlaying) player.pause();
      else player.resume();
    },
  },
  {
    id: 'podcast-skip-forward',
    label: msg`Skip Forward 30s`,
    description: msg`Skip forward 30 seconds`,
    group: 'podcast',
    shortcut: '→',
    keywords: ['skip', 'forward', 'seek'],
    isAvailable: (context) => context.hasPodcast(),
    execute: () => {
      const player = usePlayerStore.getState();
      player.seek(Math.min(player.duration, player.currentTime + 30));
    },
  },
  {
    id: 'podcast-skip-back',
    label: msg`Skip Back 15s`,
    description: msg`Skip back 15 seconds`,
    group: 'podcast',
    shortcut: '←',
    keywords: ['skip', 'back', 'rewind', 'seek'],
    isAvailable: (context) => context.hasPodcast(),
    execute: () => {
      const player = usePlayerStore.getState();
      player.seek(Math.max(0, player.currentTime - 15));
    },
  },
  {
    id: 'podcast-speed-increase',
    label: msg`Increase Playback Speed`,
    description: msg`Increase speed by 0.25x`,
    group: 'podcast',
    shortcut: ']',
    keywords: ['speed', 'faster', 'rate'],
    isAvailable: (context) => context.hasPodcast(),
    execute: () => {
      const player = usePlayerStore.getState();
      const nextSpeed = Math.min(3, Math.round((player.playbackSpeed + 0.25) * 100) / 100);
      player.setSpeed(nextSpeed);
    },
  },
  {
    id: 'podcast-speed-decrease',
    label: msg`Decrease Playback Speed`,
    description: msg`Decrease speed by 0.25x`,
    group: 'podcast',
    shortcut: '[',
    keywords: ['speed', 'slower', 'rate'],
    isAvailable: (context) => context.hasPodcast(),
    execute: () => {
      const player = usePlayerStore.getState();
      const nextSpeed = Math.max(0.5, Math.round((player.playbackSpeed - 0.25) * 100) / 100);
      player.setSpeed(nextSpeed);
    },
  },
  {
    id: 'podcast-toggle-mute',
    label: msg`Mute / Unmute`,
    description: msg`Toggle audio mute`,
    group: 'podcast',
    shortcut: 'M',
    keywords: ['mute', 'unmute', 'volume', 'sound'],
    isAvailable: (context) => context.hasPodcast(),
    execute: () => {
      usePlayerStore.getState().toggleMute();
    },
  },
  {
    id: 'podcast-stop-after-current',
    label: msg`Stop After Current`,
    description: msg`Stop playback after the current episode finishes`,
    group: 'podcast',
    shortcut: '⇧S',
    keywords: ['stop', 'after', 'current', 'queue'],
    isAvailable: (context) => context.hasPodcast(),
    execute: () => {
      usePlayerStore.getState().toggleStopAfterCurrent();
    },
  },
  {
    id: 'podcast-clear-queue',
    label: msg`Clear Queue`,
    description: msg`Remove all episodes from the playback queue`,
    group: 'podcast',
    keywords: ['clear', 'queue', 'playlist', 'empty'],
    isAvailable: (context) => context.hasPodcast(),
    execute: () => {
      usePlayerStore.getState().clearQueue();
    },
  },
  {
    id: 'podcast-shuffle-queue',
    label: msg`Shuffle Queue`,
    description: msg`Randomize the playback queue order`,
    group: 'podcast',
    keywords: ['shuffle', 'random', 'queue', 'playlist'],
    isAvailable: (context) => context.hasPodcast(),
    execute: () => {
      usePlayerStore.getState().shuffleQueue();
    },
  },
  {
    id: 'podcast-volume-up',
    label: msg`Volume Up`,
    description: msg`Increase volume by 10%`,
    group: 'podcast',
    keywords: ['volume', 'louder', 'sound'],
    isAvailable: (context) => context.hasPodcast(),
    execute: () => {
      const player = usePlayerStore.getState();
      player.setVolume(Math.min(1, Math.round((player.volume + 0.1) * 100) / 100));
    },
  },
  {
    id: 'podcast-volume-down',
    label: msg`Volume Down`,
    description: msg`Decrease volume by 10%`,
    group: 'podcast',
    keywords: ['volume', 'quieter', 'sound'],
    isAvailable: (context) => context.hasPodcast(),
    execute: () => {
      const player = usePlayerStore.getState();
      player.setVolume(Math.max(0, Math.round((player.volume - 0.1) * 100) / 100));
    },
  },
  {
    id: 'podcast-dismiss',
    label: msg`Dismiss Player`,
    description: msg`Stop playback and close the player`,
    group: 'podcast',
    keywords: ['stop', 'close', 'dismiss', 'player'],
    isAvailable: (context) => context.hasPodcast(),
    execute: () => {
      usePlayerStore.getState().dismiss();
    },
  },
  {
    id: 'podcast-show-player',
    label: msg`Open Player Window`,
    description: msg`Show the podcast player window`,
    group: 'podcast',
    keywords: ['player', 'window', 'open', 'show'],
    isAvailable: (context) => context.hasPodcast(),
    execute: async () => {
      await commands.togglePlayerWindow();
    },
  },
  {
    id: 'podcast-show-mini-player',
    label: msg`Toggle Mini Player`,
    description: msg`Show or hide the tray mini player`,
    group: 'podcast',
    keywords: ['mini', 'player', 'tray', 'popover'],
    isAvailable: (context) => context.hasPodcast(),
    execute: async () => {
      await commands.toggleTrayPopover();
    },
  },
  {
    id: 'podcast-speed-reset',
    label: msg`Reset Playback Speed`,
    description: msg`Reset speed to 1.0x`,
    group: 'podcast',
    keywords: ['speed', 'reset', 'normal', 'rate'],
    isAvailable: (context) => context.hasPodcast(),
    execute: () => {
      usePlayerStore.getState().setSpeed(1.0);
    },
  },
];
