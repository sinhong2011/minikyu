import { HeadphonesIcon } from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react';
import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { Button } from '@/components/ui/button';
import { commands } from '@/lib/tauri-bindings';
import { cn } from '@/lib/utils';
import { usePlayerStore } from '@/store/player-store';

interface TitleBarPodcastAnchorProps {
  className?: string;
}

function EqBars() {
  return (
    <span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 flex items-end gap-px">
      <span className="w-[2px] rounded-full bg-primary animate-[eq-bar_0.8s_ease-in-out_infinite] [animation-delay:-0.3s]" />
      <span className="w-[2px] rounded-full bg-primary animate-[eq-bar_0.6s_ease-in-out_infinite] [animation-delay:-0.1s]" />
      <span className="w-[2px] rounded-full bg-primary animate-[eq-bar_0.7s_ease-in-out_infinite] [animation-delay:-0.5s]" />
      <style>{`
        @keyframes eq-bar {
          0%, 100% { height: 2px; }
          50% { height: 7px; }
        }
      `}</style>
    </span>
  );
}

export function TitleBarPodcastAnchor({ className }: TitleBarPodcastAnchorProps) {
  const { _ } = useLingui();
  const isPlaying = usePlayerStore((state) => state.isPlaying);

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className={cn(
        'relative h-8 w-8 shrink-0 text-foreground/70 hover:text-foreground',
        className
      )}
      onClick={() => commands.togglePlayerWindow()}
      title={_(msg`Open player`)}
      data-testid="titlebar-podcast-icon"
    >
      <HugeiconsIcon icon={HeadphonesIcon} className="h-4 w-4" />
      {isPlaying && <EqBars />}
    </Button>
  );
}
