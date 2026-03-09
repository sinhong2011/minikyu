import { cn } from '@/lib/utils';

function Skeleton({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="skeleton"
      className={cn('bg-black/[0.06] dark:bg-white/[0.06] rounded-md animate-pulse', className)}
      {...props}
    />
  );
}

export { Skeleton };
