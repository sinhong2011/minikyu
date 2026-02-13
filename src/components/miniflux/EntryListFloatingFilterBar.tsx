import { InboxIcon, InboxUnreadIcon, StarIcon } from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react';
import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { motion } from 'motion/react';
import { cn } from '@/lib/utils';

export type EntryListFilterStatus = 'all' | 'unread' | 'starred';

interface EntryListFloatingFilterBarProps {
  currentStatus: EntryListFilterStatus;
  onStatusChange: (status: EntryListFilterStatus) => void;
  visible?: boolean;
  scrolling?: boolean;
}

export function EntryListFloatingFilterBar({
  currentStatus,
  onStatusChange,
  visible = true,
  scrolling = false,
}: EntryListFloatingFilterBarProps) {
  const { _ } = useLingui();
  const tabs: Array<{
    value: EntryListFilterStatus;
    icon: typeof InboxIcon;
    label: string;
    iconClassName?: string;
  }> = [
    {
      value: 'all',
      icon: InboxIcon,
      label: _(msg`All`),
    },
    {
      value: 'unread',
      icon: InboxUnreadIcon,
      label: _(msg`Unread`),
      iconClassName: '-translate-x-[0.5px]',
    },
    {
      value: 'starred',
      icon: StarIcon,
      label: _(msg`Starred`),
    },
  ];
  const activeTabIndex = Math.max(
    0,
    tabs.findIndex((tab) => tab.value === currentStatus)
  );

  return (
    <div className="pointer-events-none absolute inset-x-3 bottom-[max(0.75rem,env(safe-area-inset-bottom))] z-10 flex justify-center">
      <motion.div
        initial={false}
        animate={
          visible
            ? {
                opacity: 1,
                y: scrolling ? 2 : 0,
                scale: scrolling ? 0.97 : 1,
                filter: scrolling ? 'saturate(0.96)' : 'saturate(1)',
              }
            : {
                opacity: 0,
                y: 30,
                scale: 0.9,
                filter: 'blur(4px)',
              }
        }
        transition={{
          opacity: { duration: 0.22, ease: 'easeOut' },
          y: { type: 'spring', stiffness: 420, damping: 30, mass: 0.68 },
          scale: { type: 'spring', stiffness: 400, damping: 30, mass: 0.65 },
          filter: { duration: 0.2, ease: 'easeOut' },
        }}
        className={cn(
          'w-full max-w-[332px] rounded-[1.35rem] border border-white/12 bg-[linear-gradient(90deg,color-mix(in_oklch,var(--color-background)_62%,transparent),color-mix(in_oklch,var(--color-background)_50%,transparent)_52%,color-mix(in_oklch,var(--color-background)_62%,transparent))] p-1 shadow-[0_22px_40px_-28px_color-mix(in_oklch,var(--color-foreground)_72%,transparent),inset_0_1px_0_color-mix(in_oklch,var(--color-background)_60%,transparent)] backdrop-blur-2xl',
          visible ? 'pointer-events-auto' : 'pointer-events-none'
        )}
      >
        <div className="relative grid grid-cols-3 items-center">
          <motion.div
            className="absolute -top-0.5 bottom-0 left-0 z-0 w-1/3 px-0.5"
            animate={{
              x: `${activeTabIndex * 100}%`,
              scale: [1, 1.02, 1],
            }}
            transition={{
              x: { type: 'spring', stiffness: 300, damping: 30, mass: 0.76 },
              scale: { duration: 0.24, ease: 'easeOut' },
            }}
          >
            <div className="h-full w-full rounded-[1rem] bg-white/5 shadow-[inset_0_1px_0_color-mix(in_oklch,var(--color-background)_72%,transparent)]" />
          </motion.div>
          {tabs.map((tab) => {
            const isActive = currentStatus === tab.value;

            return (
              <button
                key={tab.value}
                type="button"
                onClick={() => onStatusChange(tab.value)}
                aria-pressed={isActive}
                className={cn(
                  'relative z-10 isolate flex h-8 min-w-0 items-center justify-center gap-1.5 overflow-hidden rounded-[1rem] px-2.5 text-[0.72rem] tracking-tight transition-[color,transform,opacity,background-color] duration-300 ease-out',
                  isActive
                    ? 'font-medium text-foreground/82'
                    : 'font-medium text-foreground/52 hover:bg-white/5 hover:text-foreground/82 active:text-foreground/88'
                )}
              >
                <motion.span
                  className="flex w-3.5 items-center justify-center"
                  animate={{ scale: 1 }}
                  transition={{ duration: 0.22, ease: 'easeOut' }}
                >
                  <HugeiconsIcon
                    icon={tab.icon}
                    className={cn(
                      'h-3.5 w-3.5 shrink-0 transition-all duration-300',
                      tab.iconClassName,
                      isActive ? 'opacity-85 text-primary' : 'opacity-42 text-foreground'
                    )}
                  />
                </motion.span>
                <span
                  className={cn(
                    'truncate leading-none transition-all duration-300',
                    isActive ? 'translate-y-0 font-medium' : 'translate-y-[0.5px]'
                  )}
                >
                  {tab.label}
                </span>
              </button>
            );
          })}
        </div>
      </motion.div>
    </div>
  );
}
