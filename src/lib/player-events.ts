import type { Enclosure, Entry } from '@/lib/tauri-bindings';

// Event names
export const PLAYER_STATE_UPDATE = 'player:state-update';
export const PLAYER_TRACK_CHANGE = 'player:track-change';
export const PLAYER_DISMISSED = 'player:dismissed';
export const PLAYER_CMD = 'player:cmd';

// Payloads
export interface PlayerStatePayload {
  currentTime: number;
  duration: number;
  buffered: number;
  isPlaying: boolean;
  isBuffering: boolean;
  playbackSpeed: number;
  volume: number;
  isMuted: boolean;
}

export interface UpNextEntry {
  id: string;
  title: string;
  feedTitle: string | null;
  duration: number;
  artworkUrl: string | null;
}

export interface PlayerTrackPayload {
  entry: Entry;
  enclosure: Enclosure;
  artworkUrl: string | null;
  queue: UpNextEntry[];
}

export type PlayerCmdAction =
  | 'play'
  | 'pause'
  | 'toggle-play-pause'
  | 'seek'
  | 'skip-forward'
  | 'skip-back'
  | 'next-track'
  | 'prev-track'
  | 'set-speed'
  | 'set-volume'
  | 'toggle-mute'
  | 'play-entry'
  | 'download'
  | 'dismiss';

export interface PlayerCmdPayload {
  action: PlayerCmdAction;
  value?: number | string;
}
