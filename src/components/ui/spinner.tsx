import { Loading03Icon } from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react';
import { i18n } from '@lingui/core';
import { msg } from '@lingui/core/macro';
import { cn } from '@/lib/utils';

function Spinner({ className, ...props }: Omit<React.ComponentProps<'svg'>, 'strokeWidth'>) {
  return (
    <HugeiconsIcon
      icon={Loading03Icon}
      strokeWidth={2}
      role="status"
      aria-label={i18n._(msg`Loading`)}
      className={cn('size-4 animate-spin', className)}
      {...props}
    />
  );
}

export { Spinner };
