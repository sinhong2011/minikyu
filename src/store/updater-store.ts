import type { Update } from '@tauri-apps/plugin-updater';
import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { logger } from './logger-middleware';

type UpdaterState =
  | { status: 'idle' }
  | { status: 'checking' }
  | { status: 'up-to-date' }
  | { status: 'available'; version: string; date: string; body: string }
  | { status: 'downloading'; version: string; progress: number }
  | { status: 'ready'; version: string }
  | { status: 'installing' }
  | { status: 'error'; message: string };

interface UpdaterActions {
  setChecking: () => void;
  setUpToDate: () => void;
  setAvailable: (version: string, date: string, body: string) => void;
  setDownloading: (version: string, progress: number) => void;
  setReady: (version: string) => void;
  setInstalling: () => void;
  setError: (message: string) => void;
  reset: () => void;
  _update: Update | null;
  _setUpdate: (update: Update | null) => void;
}

type UpdaterStore = UpdaterState & UpdaterActions;

export const useUpdaterStore = create<UpdaterStore>()(
  logger(
    devtools(
      (set) => ({
        status: 'idle' as const,
        _update: null,

        setChecking: () => set({ status: 'checking' }, undefined, 'setChecking'),
        setUpToDate: () => set({ status: 'up-to-date' }, undefined, 'setUpToDate'),
        setAvailable: (version: string, date: string, body: string) =>
          set({ status: 'available', version, date, body }, undefined, 'setAvailable'),
        setDownloading: (version: string, progress: number) =>
          set({ status: 'downloading', version, progress }, undefined, 'setDownloading'),
        setReady: (version: string) => set({ status: 'ready', version }, undefined, 'setReady'),
        setInstalling: () => set({ status: 'installing' }, undefined, 'setInstalling'),
        setError: (message: string) => set({ status: 'error', message }, undefined, 'setError'),
        reset: () => set({ status: 'idle', _update: null }, undefined, 'reset'),
        _setUpdate: (update: Update | null) => set({ _update: update }, undefined, '_setUpdate'),
      }),
      { name: 'updater-store' }
    ),
    'updater-store'
  )
);
