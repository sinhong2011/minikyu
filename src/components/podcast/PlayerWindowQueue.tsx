import {
  Delete02Icon,
  HeadphonesIcon,
  PlayIcon,
  ShuffleIcon,
  WavingHand01Icon,
} from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react';
import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { emit } from '@tauri-apps/api/event';
import { PLAYER_CMD, type PlayerCmdPayload, type UpNextEntry } from '@/lib/player-events';

interface PlayerWindowQueueProps {
  queue: UpNextEntry[];
  currentEntryId: string | null;
}

function sendCmd(action: PlayerCmdPayload['action'], value?: PlayerCmdPayload['value']) {
  emit(PLAYER_CMD, { action, value } satisfies PlayerCmdPayload).catch(() => {});
}

export function PlayerWindowQueue({ queue, currentEntryId }: PlayerWindowQueueProps) {
  const { _ } = useLingui();

  return (
    <div className="flex min-h-0 flex-1 flex-col border-t border-border/30">
      {/* Header */}
      <div className="flex shrink-0 items-center justify-between px-4 pt-3 pb-1">
        <p className="text-[13px] font-semibold">{_(msg`Playlist`)}</p>
        <div className="flex items-center gap-1">
          {queue.length > 0 && (
            <>
              <span className="text-[11px] text-muted-foreground">
                {queue.length === 1 ? _(msg`1 episode`) : _(msg`${queue.length} episodes`)}
              </span>
              <button
                type="button"
                className="inline-flex size-6 items-center justify-center rounded-md text-muted-foreground/60 transition-colors hover:bg-foreground/5 hover:text-foreground"
                onClick={() => sendCmd('shuffle-queue')}
                title={_(msg`Shuffle`)}
              >
                <HugeiconsIcon icon={ShuffleIcon} className="size-3" />
              </button>
              <button
                type="button"
                className="inline-flex size-6 items-center justify-center rounded-md text-muted-foreground/60 transition-colors hover:bg-foreground/5 hover:text-foreground"
                onClick={() => sendCmd('clear-queue')}
                title={_(msg`Clear playlist`)}
              >
                <HugeiconsIcon icon={WavingHand01Icon} className="size-3" />
              </button>
            </>
          )}
        </div>
      </div>

      {/* List */}
      <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-3">
        {queue.length === 0 ? null : (
          <div className="flex flex-col gap-0.5">
            {queue.map((item) => (
              <div
                key={item.id}
                className={`group flex w-full items-center gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-foreground/5 ${
                  item.id === currentEntryId ? 'bg-primary/8' : ''
                }`}
              >
                <button
                  type="button"
                  className="flex min-w-0 flex-1 items-center gap-3 text-start"
                  onClick={() => sendCmd('play-entry', item.id)}
                >
                  {item.artworkUrl ? (
                    <img
                      src={item.artworkUrl}
                      alt=""
                      className="size-10 shrink-0 rounded-lg object-cover"
                    />
                  ) : (
                    <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted/40">
                      <HugeiconsIcon
                        icon={HeadphonesIcon}
                        className="size-4 text-muted-foreground"
                      />
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[12px] font-medium leading-tight">{item.title}</p>
                    {item.feedTitle && (
                      <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
                        {item.feedTitle}
                      </p>
                    )}
                  </div>
                </button>
                <div className="flex shrink-0 items-center gap-0.5">
                  <button
                    type="button"
                    className="inline-flex size-7 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-foreground/10 hover:text-foreground"
                    onClick={() => sendCmd('play-entry', item.id)}
                    title={_(msg`Play`)}
                  >
                    <HugeiconsIcon icon={PlayIcon} className="size-3.5" />
                  </button>
                  <button
                    type="button"
                    className="inline-flex size-7 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                    onClick={() => sendCmd('remove-from-queue', item.id)}
                    title={_(msg`Remove`)}
                  >
                    <HugeiconsIcon icon={Delete02Icon} className="size-3" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
