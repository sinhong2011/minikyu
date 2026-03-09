import { Search01Icon } from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react';
import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { Button } from '@/components/ui/button';

interface CommandSearchButtonProps {
  onClick: () => void;
}

export function CommandSearchButton({ onClick }: CommandSearchButtonProps) {
  const { _ } = useLingui();

  return (
    <Button
      variant="outline"
      onClick={onClick}
      className="h-6.5 w-full max-w-xl justify-start gap-2 rounded-lg bg-black/[0.04] dark:bg-white/[0.06] text-muted-foreground hover:bg-black/[0.08] dark:hover:bg-white/10 hover:text-foreground"
    >
      <HugeiconsIcon icon={Search01Icon} className="size-3" />
      <span className="text-xs">{_(msg`Search or type a command...`)}</span>
      <kbd className="ml-auto pointer-events-none inline-flex h-4 select-none items-center gap-1 rounded border border-border/50 bg-black/[0.04] dark:bg-white/[0.06] px-1.5 font-mono text-[10px] font-medium text-muted-foreground opacity-100">
        <span className="text-xs">⌘</span>K
      </kbd>
    </Button>
  );
}
