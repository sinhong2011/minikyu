import { HeadphonesIcon, PlayIcon } from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react';
import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { emit } from '@tauri-apps/api/event';
import { PLAYER_CMD, type PlayerCmdPayload, type UpNextEntry } from '@/lib/player-events';

interface PlayerWindowQueueProps {
  queue: UpNextEntry[];
  currentEntryId: string | null;
}

function playEntry(entryId: string) {
  emit(PLAYER_CMD, { action: 'play-entry', value: entryId } satisfies PlayerCmdPayload).catch(
    () => {}
  );
}

export function PlayerWindowQueue({ queue, currentEntryId }: PlayerWindowQueueProps) {
  const { _ } = useLingui();

  return (
    <div className="flex min-h-0 flex-1 flex-col border-t border-border/30">
      {/* Header */}
      <div className="flex shrink-0 items-center justify-between px-4 pt-3 pb-1">
        <p className="text-[13px] font-semibold">{_(msg`Playlist`)}</p>
        {queue.length > 0 && (
          <p className="text-[11px] text-muted-foreground">
            {queue.length === 1 ? _(msg`1 episode`) : _(msg`${queue.length} episodes`)}
          </p>
        )}
      </div>

      {/* List */}
      <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-3">
        {queue.length === 0 ? (
          <p className="px-2 py-6 text-center text-[12px] text-muted-foreground/50">
            {_(msg`No more episodes`)}
          </p>
        ) : (
          queue.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`group flex w-full items-center gap-3 rounded-lg px-2 py-2 text-start transition-colors hover:bg-foreground/5 ${
                item.id === currentEntryId ? 'bg-foreground/5' : ''
              }`}
              onClick={() => playEntry(item.id)}
            >
              {item.artworkUrl ? (
                <img
                  src={item.artworkUrl}
                  alt=""
                  className="size-10 shrink-0 rounded-lg object-cover"
                />
              ) : (
                <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted/40">
                  <HugeiconsIcon icon={HeadphonesIcon} className="size-4 text-muted-foreground" />
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
              <div className="flex size-8 shrink-0 items-center justify-center rounded-full text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100">
                <HugeiconsIcon icon={PlayIcon} className="size-3.5" />
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  );
}
