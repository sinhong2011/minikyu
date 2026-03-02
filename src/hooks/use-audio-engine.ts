import { convertFileSrc } from '@tauri-apps/api/core';
import { emit, listen } from '@tauri-apps/api/event';
import { debounce, throttle } from 'es-toolkit';
import { useEffect, useRef } from 'react';
import { logger } from '@/lib/logger';
import { extractThumbnail } from '@/lib/media-utils';
import {
  PLAYER_DISMISSED,
  PLAYER_REQUEST_SYNC,
  PLAYER_STATE_UPDATE,
  PLAYER_TRACK_CHANGE,
  type PlayerStatePayload,
  type PlayerTrackPayload,
} from '@/lib/player-events';
import { commands } from '@/lib/tauri-bindings';
import { usePlayerStore } from '@/store/player-store';

interface AudioEngineRuntime {
  audio: HTMLAudioElement;
  mountCount: number;
  teardown: (() => void) | null;
}

const runtimeGlobal = globalThis as typeof globalThis & {
  minikyuAudioEngineRuntime?: AudioEngineRuntime;
};

// Global singleton keeps playback engine stable across dev HMR reloads.
if (!runtimeGlobal.minikyuAudioEngineRuntime) {
  runtimeGlobal.minikyuAudioEngineRuntime = {
    audio: new Audio(),
    mountCount: 0,
    teardown: null,
  };
}

const runtime = runtimeGlobal.minikyuAudioEngineRuntime;
const INITIAL_BUFFER_SECONDS = 8;
const MIN_BUFFER_SECONDS = 5;
const MAX_BUFFER_SECONDS = 20;
const BUFFER_RATIO_OF_TOTAL = 0.03;
/** Don't show buffering UI when this much audio is cached ahead. */
const COMFORTABLE_BUFFER_SECONDS = 30;

function clearAudioSource(audio: HTMLAudioElement) {
  audio.pause();
  audio.removeAttribute('src');
}

function normalizeMediaTime(value: number): number {
  if (!Number.isFinite(value) || value < 0) {
    return 0;
  }

  return value;
}

function getBufferedAhead(audio: HTMLAudioElement, currentTime: number): number {
  if (audio.buffered.length < 1) {
    return 0;
  }

  try {
    const bufferedEnd = normalizeMediaTime(audio.buffered.end(audio.buffered.length - 1));
    return Math.max(0, bufferedEnd - normalizeMediaTime(currentTime));
  } catch {
    return 0;
  }
}

function getRequiredInitialBuffer(duration: number): number {
  if (!Number.isFinite(duration) || duration <= 0) {
    return INITIAL_BUFFER_SECONDS;
  }

  return Math.min(
    MAX_BUFFER_SECONDS,
    Math.max(MIN_BUFFER_SECONDS, duration * BUFFER_RATIO_OF_TOTAL)
  );
}

function hasEnoughInitialBuffer(audio: HTMLAudioElement, currentTime: number): boolean {
  const bufferedAhead = getBufferedAhead(audio, currentTime);
  const requiredBuffer = getRequiredInitialBuffer(audio.duration);

  return bufferedAhead >= requiredBuffer;
}

export function useAudioEngine() {
  const saveProgressRef = useRef(
    debounce((entryId: string, currentTime: number, totalTime: number) => {
      commands.savePodcastProgress(entryId, Math.floor(currentTime), Math.floor(totalTime));
    }, 10_000)
  );

  useEffect(() => {
    // Skip audio engine only during browser automation runs.
    // In normal dev, the test bridge may still be present for store inspection.
    if (window.__TEST__ && navigator.webdriver) return;

    runtime.mountCount += 1;
    if (runtime.mountCount > 1) {
      return () => {
        runtime.mountCount = Math.max(0, runtime.mountCount - 1);
        if (runtime.mountCount === 0 && runtime.teardown) {
          runtime.teardown();
          runtime.teardown = null;
          clearAudioSource(runtime.audio);
        }
      };
    }

    const audio = runtime.audio;
    const store = usePlayerStore;

    // Cross-window event broadcasting for the player window
    const broadcastState = throttle(() => {
      const s = usePlayerStore.getState();
      const payload: PlayerStatePayload = {
        currentTime: s.currentTime,
        duration: s.duration,
        buffered: s.buffered,
        isPlaying: s.isPlaying,
        isBuffering: s.isBuffering,
        playbackSpeed: s.playbackSpeed,
        volume: s.volume,
        isMuted: s.isMuted,
      };
      emit(PLAYER_STATE_UPDATE, payload).catch(() => {});
    }, 250);

    const broadcastTrackChange = async () => {
      const s = usePlayerStore.getState();
      if (!s.currentEntry || !s.currentEnclosure) return;

      // Resolve artwork: entry thumbnail → feed icon → null
      let artworkUrl = extractThumbnail(s.currentEntry);
      if (!artworkUrl && s.currentEntry.feed_id) {
        const result = await commands.getFeedIconData(s.currentEntry.feed_id).catch(() => null);
        if (result?.status === 'ok' && result.data) {
          artworkUrl = result.data;
        }
      }

      const payload: PlayerTrackPayload = {
        entry: s.currentEntry,
        enclosure: s.currentEnclosure,
        artworkUrl,
        queue: s.queue.map((q) => ({
          id: q.entry.id,
          title: q.entry.title,
          feedTitle: q.entry.feed?.title ?? null,
          duration: q.enclosure.length ? Number(q.enclosure.length) : 0,
          artworkUrl: null,
        })),
      };
      emit(PLAYER_TRACK_CHANGE, payload).catch(() => {});
    };

    const broadcastDismiss = () => {
      emit(PLAYER_DISMISSED, {}).catch(() => {});
    };

    let activeLoadToken = 0;
    let isLoadingTrack = false;
    let isPlaybackStalled = false;
    let pendingAutoPlay = false;

    const setBuffering = (buffering: boolean) => {
      usePlayerStore.getState()._setBuffering(buffering);
    };

    const tryStartPlayback = (trigger: string) => {
      const state = usePlayerStore.getState();
      if (!state.currentEntry || !state.currentEnclosure || !state.isPlaying) {
        pendingAutoPlay = false;
        setBuffering(false);
        return;
      }

      if (!audio.src) {
        pendingAutoPlay = true;
        setBuffering(true);
        return;
      }

      if (!hasEnoughInitialBuffer(audio, audio.currentTime)) {
        pendingAutoPlay = true;
        setBuffering(true);
        logger.debug('Audio engine: waiting for initial buffer', {
          trigger,
          bufferedAhead: getBufferedAhead(audio, audio.currentTime),
          requiredBuffer: getRequiredInitialBuffer(audio.duration),
        });
        return;
      }

      pendingAutoPlay = false;
      setBuffering(false);

      if (audio.paused) {
        audio.play().catch((err) => {
          logger.error('Audio engine: play() rejected while starting playback', {
            error: String(err),
            trigger,
          });
          setBuffering(false);
        });
      }
    };

    // Subscribe to store changes and sync to audio element
    const unsubscribe = store.subscribe((state, prev) => {
      // Play new track
      if (
        !isLoadingTrack &&
        state.currentEntry &&
        state.currentEnclosure &&
        (state.currentEnclosure !== prev.currentEnclosure ||
          state.currentEntry !== prev.currentEntry ||
          !prev.currentEntry ||
          (state.isPlaying && !audio.src))
      ) {
        const entry = state.currentEntry;
        const enclosure = state.currentEnclosure;
        const entryId = entry.id;
        const loadToken = ++activeLoadToken;
        isLoadingTrack = true;
        isPlaybackStalled = true;
        pendingAutoPlay = false;
        setBuffering(true);

        logger.info('Audio engine: loading track', {
          url: enclosure.url,
          entryId,
        });
        audio.pause();
        audio.preload = 'auto';
        audio.currentTime = 0;
        // Set remote URL immediately so buffering starts right away
        audio.src = enclosure.url;
        audio.playbackRate = state.playbackSpeed;
        audio.volume = state.volume;
        audio.muted = state.isMuted;

        // Resume from saved position, then start playback
        commands
          .getPodcastProgress(entryId)
          .then((result) => {
            const currentEntryId = usePlayerStore.getState().currentEntry?.id;
            if (loadToken !== activeLoadToken || currentEntryId !== entryId) {
              return;
            }

            if (result.status === 'ok' && result.data) {
              const persistedTime = normalizeMediaTime(result.data.current_time);
              audio.currentTime = persistedTime;
              usePlayerStore.getState()._updateTime(persistedTime);
            }

            isLoadingTrack = false;
            if (usePlayerStore.getState().isPlaying) {
              tryStartPlayback('initial-load');
            } else {
              setBuffering(false);
            }
          })
          .catch((err) => {
            logger.error('Audio engine: failed to load track', { error: String(err) });
            isLoadingTrack = false;
            setBuffering(false);
          });

        // Async: swap to local file if already downloaded (avoids streaming)
        commands
          .getDownloadedFilePath(enclosure.url)
          .then((localResult) => {
            if (loadToken !== activeLoadToken) return;
            if (localResult.status === 'ok' && localResult.data) {
              const localSrc = convertFileSrc(localResult.data);
              if (audio.src !== localSrc) {
                logger.info('Audio engine: swapping to local file', { path: localResult.data });
                const currentPos = audio.currentTime;
                audio.src = localSrc;
                audio.currentTime = currentPos;
              }
            }
          })
          .catch(() => {
            // Ignore — already streaming from remote URL
          });

        // Update MediaSession
        if ('mediaSession' in navigator) {
          navigator.mediaSession.metadata = new MediaMetadata({
            title: entry.title,
            artist: entry.feed.title,
          });
        }

        broadcastTrackChange();

        // Auto-show player only when actively playing (not on persist rehydration)
        if (state.isPlaying) {
          commands
            .loadPreferences()
            .then((result) => {
              if (result.status === 'ok' && result.data.player_display_mode === 'TrayPopover') {
                commands.showTrayPopover().catch(() => {});
              } else {
                commands.showPlayerWindow().catch(() => {});
              }
            })
            .catch(() => {
              commands.showPlayerWindow().catch(() => {});
            });
        }
      }

      // Play/pause
      if (state.isPlaying !== prev.isPlaying) {
        if (isLoadingTrack) {
          return;
        }

        if (state.isPlaying && audio.src) {
          tryStartPlayback('store-resume');
        } else if (!state.isPlaying && !audio.paused) {
          pendingAutoPlay = false;
          setBuffering(false);
          audio.pause();
        } else if (!state.isPlaying) {
          pendingAutoPlay = false;
          setBuffering(false);
        }
      }

      // Seek
      if (
        state.currentTime !== prev.currentTime &&
        Math.abs(audio.currentTime - state.currentTime) > 1.5
      ) {
        audio.currentTime = state.currentTime;
      }

      // Speed
      if (state.playbackSpeed !== prev.playbackSpeed) {
        audio.playbackRate = state.playbackSpeed;
      }

      // Volume
      if (state.volume !== prev.volume) {
        audio.volume = state.volume;
      }
      if (state.isMuted !== prev.isMuted) {
        audio.muted = state.isMuted;
      }

      // Queue changed — re-broadcast track info
      if (state.queue !== prev.queue && state.currentEntry) {
        broadcastTrackChange();
      }

      // Dismiss — stop and clear
      if (!state.currentEntry && prev.currentEntry) {
        activeLoadToken += 1;
        isLoadingTrack = false;
        isPlaybackStalled = false;
        pendingAutoPlay = false;
        setBuffering(false);
        clearAudioSource(audio);
        broadcastDismiss();
        // Flush progress on dismiss
        if (prev.currentEntry) {
          commands.savePodcastProgress(
            prev.currentEntry.id,
            Math.floor(normalizeMediaTime(prev.currentTime)),
            Math.floor(normalizeMediaTime(prev.duration))
          );
        }
      }
    });

    const startupState = usePlayerStore.getState();
    if (
      startupState.currentEntry &&
      startupState.currentEnclosure &&
      startupState.isPlaying &&
      !audio.src
    ) {
      logger.info('Audio engine: recovering track after runtime restart', {
        entryId: startupState.currentEntry.id,
      });
      startupState.resume();
    }

    // Audio element events → store
    const HaveFutureData = 3;
    const onTimeUpdate = () => {
      if (isLoadingTrack || audio.paused) {
        return;
      }

      // Auto-recover from stalled/waiting flags that the browser never
      // cleared via a 'playing' event. This is common during streaming:
      // 'stalled' fires because fetch paused, but the existing buffer is
      // large enough that playback silently continues. readyState >= 3
      // (HAVE_FUTURE_DATA) confirms the element has enough data to play.
      if (isPlaybackStalled && audio.readyState >= HaveFutureData) {
        isPlaybackStalled = false;
      }

      if (isPlaybackStalled) {
        return;
      }

      // If audio is progressing, buffering is definitively over
      if (usePlayerStore.getState().isBuffering) {
        setBuffering(false);
      }

      const currentTime = normalizeMediaTime(audio.currentTime);
      const duration = normalizeMediaTime(audio.duration || 0);
      const state = usePlayerStore.getState();
      state._updateTime(currentTime);

      // Debounced save
      if (state.currentEntry) {
        saveProgressRef.current(state.currentEntry.id, currentTime, duration);
      }

      broadcastState();
    };

    const onDurationChange = () => {
      usePlayerStore.getState()._updateDuration(normalizeMediaTime(audio.duration));
      broadcastState();
      if (pendingAutoPlay && !isLoadingTrack && usePlayerStore.getState().isPlaying) {
        tryStartPlayback('durationchange');
      }
    };

    const onProgress = () => {
      if (audio.buffered.length > 0) {
        usePlayerStore
          .getState()
          ._updateBuffered(normalizeMediaTime(audio.buffered.end(audio.buffered.length - 1)));
      }

      if (pendingAutoPlay && !isLoadingTrack && usePlayerStore.getState().isPlaying) {
        tryStartPlayback('progress');
      }
    };

    const onLoadStart = () => {
      isPlaybackStalled = true;
      setBuffering(true);
    };
    const onWaiting = () => {
      isPlaybackStalled = true;
      if (
        usePlayerStore.getState().isPlaying &&
        getBufferedAhead(audio, audio.currentTime) < COMFORTABLE_BUFFER_SECONDS
      ) {
        setBuffering(true);
      }
    };
    const onStalled = () => {
      // Only mark stalled when buffer is actually low — 'stalled' fires
      // routinely during streaming even when playback is unaffected.
      const bufferAhead = getBufferedAhead(audio, audio.currentTime);
      if (bufferAhead < COMFORTABLE_BUFFER_SECONDS) {
        isPlaybackStalled = true;
        if (usePlayerStore.getState().isPlaying) {
          setBuffering(true);
        }
      }
    };
    const onSeeking = () => {
      isPlaybackStalled = true;
      if (
        usePlayerStore.getState().isPlaying &&
        getBufferedAhead(audio, audio.currentTime) < COMFORTABLE_BUFFER_SECONDS
      ) {
        setBuffering(true);
      }
    };
    const onPlaying = () => {
      isPlaybackStalled = false;
      pendingAutoPlay = false;
      setBuffering(false);
      usePlayerStore.getState()._setPlaying(true);
      broadcastState();
    };
    const onCanPlay = () => {
      if (pendingAutoPlay && !isLoadingTrack && usePlayerStore.getState().isPlaying) {
        tryStartPlayback('canplay');
      }
    };
    const onCanPlayThrough = () => {
      if (pendingAutoPlay && !isLoadingTrack && usePlayerStore.getState().isPlaying) {
        tryStartPlayback('canplaythrough');
      }
    };
    const onPlay = () => {
      usePlayerStore.getState()._setPlaying(true);
    };
    const onPause = () => {
      if (!pendingAutoPlay) {
        setBuffering(false);
      }
      usePlayerStore.getState()._setPlaying(false);
      broadcastState();
    };

    const onEnded = () => {
      const state = usePlayerStore.getState();
      // Persist completion progress first so mark-as-completed always has a row to update.
      if (state.currentEntry) {
        const entryId = state.currentEntry.id;
        const completedDuration = Math.floor(normalizeMediaTime(audio.duration || state.duration));
        const completedTime = Math.floor(
          normalizeMediaTime(
            completedDuration > 0
              ? completedDuration
              : Math.max(audio.currentTime, state.currentTime)
          )
        );

        void commands
          .savePodcastProgress(entryId, completedTime, completedDuration)
          .catch((error) => {
            logger.warn('Audio engine: failed to persist completed progress', {
              error: String(error),
              entryId,
            });
          })
          .finally(() => {
            void commands.markEpisodeCompleted(entryId);
          });
      }
      activeLoadToken += 1;
      isLoadingTrack = false;
      isPlaybackStalled = false;
      pendingAutoPlay = false;
      setBuffering(false);

      // Auto-advance to next track in queue
      if (!state.stopAfterCurrent && state.queue.length > 0) {
        const currentId = state.currentEntry?.id;
        const currentIdx = currentId ? state.queue.findIndex((q) => q.entry.id === currentId) : -1;
        const nextIdx = currentIdx >= 0 ? currentIdx + 1 : 0;
        const next = state.queue[nextIdx];
        if (next) {
          state.play(next.entry, next.enclosure);
          return;
        }
      }
      // No next track — stop playback but keep queue
      state._setPlaying(false);
    };

    const onError = () => {
      pendingAutoPlay = false;
      setBuffering(false);
      const err = audio.error;
      logger.error('Audio playback error', {
        code: err?.code,
        message: err?.message,
        src: audio.src,
      });
    };

    audio.addEventListener('loadstart', onLoadStart);
    audio.addEventListener('canplay', onCanPlay);
    audio.addEventListener('canplaythrough', onCanPlayThrough);
    audio.addEventListener('waiting', onWaiting);
    audio.addEventListener('stalled', onStalled);
    audio.addEventListener('seeking', onSeeking);
    audio.addEventListener('playing', onPlaying);
    audio.addEventListener('timeupdate', onTimeUpdate);
    audio.addEventListener('durationchange', onDurationChange);
    audio.addEventListener('progress', onProgress);
    audio.addEventListener('play', onPlay);
    audio.addEventListener('pause', onPause);
    audio.addEventListener('ended', onEnded);
    audio.addEventListener('error', onError);

    // MediaSession action handlers
    if ('mediaSession' in navigator) {
      navigator.mediaSession.setActionHandler('play', () => usePlayerStore.getState().resume());
      navigator.mediaSession.setActionHandler('pause', () => usePlayerStore.getState().pause());
      navigator.mediaSession.setActionHandler('seekbackward', () => {
        const t = usePlayerStore.getState().currentTime;
        usePlayerStore.getState().seek(Math.max(0, t - 15));
      });
      navigator.mediaSession.setActionHandler('seekforward', () => {
        const { currentTime: t, duration: d } = usePlayerStore.getState();
        usePlayerStore.getState().seek(Math.min(d, t + 30));
      });
    }

    // Respond to sync requests from other windows (e.g., floating player on mount)
    const unlistenSyncRequest = listen(PLAYER_REQUEST_SYNC, () => {
      logger.debug('Audio engine: sync request received, broadcasting state');
      broadcastState();
      broadcastTrackChange();
    });

    runtime.teardown = () => {
      unsubscribe();
      unlistenSyncRequest.then((fn) => fn());
      broadcastState.cancel();
      audio.removeEventListener('loadstart', onLoadStart);
      audio.removeEventListener('canplay', onCanPlay);
      audio.removeEventListener('canplaythrough', onCanPlayThrough);
      audio.removeEventListener('waiting', onWaiting);
      audio.removeEventListener('stalled', onStalled);
      audio.removeEventListener('seeking', onSeeking);
      audio.removeEventListener('playing', onPlaying);
      audio.removeEventListener('timeupdate', onTimeUpdate);
      audio.removeEventListener('durationchange', onDurationChange);
      audio.removeEventListener('progress', onProgress);
      audio.removeEventListener('play', onPlay);
      audio.removeEventListener('pause', onPause);
      audio.removeEventListener('ended', onEnded);
      audio.removeEventListener('error', onError);
    };

    return () => {
      runtime.mountCount = Math.max(0, runtime.mountCount - 1);
      if (runtime.mountCount === 0 && runtime.teardown) {
        runtime.teardown();
        runtime.teardown = null;
        clearAudioSource(runtime.audio);
        isLoadingTrack = false;
        isPlaybackStalled = false;
        pendingAutoPlay = false;
        setBuffering(false);
      }
    };
  }, []);
}

if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    runtime.teardown?.();
    runtime.teardown = null;
    runtime.mountCount = 0;
    clearAudioSource(runtime.audio);
  });
}
