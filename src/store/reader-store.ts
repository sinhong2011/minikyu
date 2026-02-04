import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { logger } from './logger-middleware';

interface ReaderState {
  readingProgress: number; // 0 to 100
  currentScrollPosition: number;

  setReadingProgress: (progress: number) => void;
  setScrollPosition: (position: number) => void;
  resetReaderState: () => void;
}

export const useReaderStore = create<ReaderState>()(
  logger(
    devtools(
      (set) => ({
        readingProgress: 0,
        currentScrollPosition: 0,

        setReadingProgress: (progress: number) =>
          set({ readingProgress: progress }, undefined, 'setReadingProgress'),

        setScrollPosition: (position: number) =>
          set({ currentScrollPosition: position }, undefined, 'setScrollPosition'),

        resetReaderState: () =>
          set({ readingProgress: 0, currentScrollPosition: 0 }, undefined, 'resetReaderState'),
      }),
      {
        name: 'reader-store',
      }
    ),
    'reader-store'
  )
);
