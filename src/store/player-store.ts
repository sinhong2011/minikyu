import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import type { Enclosure, Entry } from '@/lib/tauri-bindings';
import { logger } from './logger-middleware';

export interface QueueItem {
  entry: Entry;
  enclosure: Enclosure;
}

interface PlayerState {
  currentEntry: Entry | null;
  currentEnclosure: Enclosure | null;
  queue: QueueItem[];
  isPlaying: boolean;
  isBuffering: boolean;
  currentTime: number;
  duration: number;
  buffered: number;
  playbackSpeed: number;
  volume: number;
  isMuted: boolean;
  stopAfterCurrent: boolean;

  play: (entry: Entry, enclosure: Enclosure) => void;
  pause: () => void;
  resume: () => void;
  seek: (time: number) => void;
  setSpeed: (speed: number) => void;
  setVolume: (volume: number) => void;
  toggleMute: () => void;
  toggleStopAfterCurrent: () => void;
  addToQueue: (entry: Entry, enclosure: Enclosure) => void;
  removeFromQueue: (entryId: string) => void;
  clearQueue: () => void;
  shuffleQueue: () => void;
  dismiss: () => void;

  _updateTime: (time: number) => void;
  _updateDuration: (duration: number) => void;
  _updateBuffered: (time: number) => void;
  _setPlaying: (playing: boolean) => void;
  _setBuffering: (buffering: boolean) => void;
}

export const usePlayerStore = create<PlayerState>()(
  logger(
    devtools(
      persist(
        (set) => ({
          currentEntry: null,
          currentEnclosure: null,
          queue: [],
          isPlaying: false,
          isBuffering: false,
          currentTime: 0,
          duration: 0,
          buffered: 0,
          playbackSpeed: 1.0,
          volume: 1.0,
          isMuted: false,
          stopAfterCurrent: false,

          play: (entry: Entry, enclosure: Enclosure) =>
            set(
              {
                currentEntry: entry,
                currentEnclosure: enclosure,
                isPlaying: true,
                isBuffering: true,
                currentTime: 0,
                duration: 0,
                buffered: 0,
              },
              undefined,
              'play'
            ),

          pause: () => set({ isPlaying: false, isBuffering: false }, undefined, 'pause'),

          resume: () => set({ isPlaying: true }, undefined, 'resume'),

          seek: (time: number) => set({ currentTime: time }, undefined, 'seek'),

          setSpeed: (speed: number) => set({ playbackSpeed: speed }, undefined, 'setSpeed'),

          setVolume: (volume: number) => set({ volume }, undefined, 'setVolume'),

          toggleMute: () => set((state) => ({ isMuted: !state.isMuted }), undefined, 'toggleMute'),

          toggleStopAfterCurrent: () =>
            set(
              (state) => ({ stopAfterCurrent: !state.stopAfterCurrent }),
              undefined,
              'toggleStopAfterCurrent'
            ),

          addToQueue: (entry: Entry, enclosure: Enclosure) =>
            set(
              (state) => {
                const exists = state.queue.some((q) => q.entry.id === entry.id);
                if (exists) return state;
                return { queue: [...state.queue, { entry, enclosure }] };
              },
              undefined,
              'addToQueue'
            ),

          removeFromQueue: (entryId: string) =>
            set(
              (state) => ({
                queue: state.queue.filter((q) => q.entry.id !== entryId),
              }),
              undefined,
              'removeFromQueue'
            ),

          clearQueue: () => set({ queue: [] }, undefined, 'clearQueue'),

          shuffleQueue: () =>
            set(
              (state) => {
                const shuffled = [...state.queue];
                for (let i = shuffled.length - 1; i > 0; i--) {
                  const j = Math.floor(Math.random() * (i + 1));
                  const tmp = shuffled[i];
                  shuffled[i] = shuffled[j] as (typeof shuffled)[number];
                  shuffled[j] = tmp as (typeof shuffled)[number];
                }
                return { queue: shuffled };
              },
              undefined,
              'shuffleQueue'
            ),

          dismiss: () =>
            set(
              {
                currentEntry: null,
                currentEnclosure: null,
                queue: [],
                isPlaying: false,
                isBuffering: false,
                currentTime: 0,
                duration: 0,
                buffered: 0,
              },
              undefined,
              'dismiss'
            ),

          _updateTime: (time: number) => set({ currentTime: time }, undefined, '_updateTime'),

          _updateDuration: (duration: number) => set({ duration }, undefined, '_updateDuration'),

          _updateBuffered: (time: number) => set({ buffered: time }, undefined, '_updateBuffered'),

          _setPlaying: (playing: boolean) => set({ isPlaying: playing }, undefined, '_setPlaying'),

          _setBuffering: (buffering: boolean) =>
            set({ isBuffering: buffering }, undefined, '_setBuffering'),
        }),
        {
          name: 'player-store',
          partialize: (state) => ({
            queue: state.queue,
            currentEntry: state.currentEntry,
            currentEnclosure: state.currentEnclosure,
            volume: state.volume,
            playbackSpeed: state.playbackSpeed,
            isMuted: state.isMuted,
          }),
        }
      ),
      { name: 'player-store' }
    ),
    'player-store'
  )
);
