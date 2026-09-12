import {
  Calendar01Icon,
  MoreHorizontalIcon,
  RssIcon,
  StarIcon,
  Timer01Icon,
} from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react';
import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { Link, useSearch } from '@tanstack/react-router';
import { useIsMobile } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';
import { useIsConnected } from '@/services/miniflux/auth';
import { useZenMode } from '@/hooks/use-zen-mode';
import { useUIStore } from '@/store/ui-store';

const VIEW_TABS = [
  { filter: undefined, label: msg`All`, icon: RssIcon },
  { filter: 'today', label: msg`Today`, icon: Calendar01Icon },
  { filter: 'starred', label: msg`Starred`, icon: StarIcon },
  { filter: 'history', label: msg`History`, icon: Timer01Icon },
] as const;

/**
 * Bottom tab bar for phone layouts (<768px). iOS 27 menubar: a slim
 * floating glass capsule. Selected state is tint only — no dark blob.
 */
export function MobileTabBar() {
  const { _ } = useLingui();
  const isMobile = useIsMobile();
  const { data: isConnected } = useIsConnected();
  const { enabled: zenModeEnabled } = useZenMode();
  const setMobileSidebarOpen = useUIStore((state) => state.setMobileSidebarOpen);
  const search = useSearch({ strict: false }) as { filter?: string };

  if (!isMobile || !isConnected || zenModeEnabled) {
    return null;
  }

  const activeFilter = search.filter;

  const tabClass =
    'flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 touch-manipulation select-none [-webkit-tap-highlight-color:transparent] active:scale-[0.96] motion-reduce:active:scale-100';

  return (
    <nav
      aria-label={_(msg`Primary`)}
      data-testid="mobile-tab-bar"
      className="pointer-events-none absolute inset-x-0 bottom-0 z-30 pl-[max(1.25rem,env(safe-area-inset-left,0px))] pr-[max(1.25rem,env(safe-area-inset-right,0px))] pb-[max(0.6rem,env(safe-area-inset-bottom,0px),var(--shell-overlay-bottom,0px))]"
    >
      <div className="app-ios-menubar pointer-events-auto flex h-12 items-stretch rounded-[1.35rem] px-1.5">
        {VIEW_TABS.map((tab) => {
          const isActive = activeFilter === tab.filter;
          return (
            <Link
              key={tab.filter ?? 'all'}
              to="/"
              search={tab.filter ? { filter: tab.filter } : {}}
              replace
              aria-current={isActive ? 'page' : undefined}
              className={cn(
                tabClass,
                isActive ? 'text-primary' : 'text-muted-foreground/80'
              )}
            >
              <HugeiconsIcon icon={tab.icon} className="size-[1.35rem]" strokeWidth={isActive ? 2.1 : 1.7} />
              <span
                className={cn(
                  'max-w-full truncate text-[0.62rem] tracking-[0.01em]',
                  isActive ? 'font-semibold' : 'font-medium'
                )}
              >
                {_(tab.label)}
              </span>
            </Link>
          );
        })}
        <button
          type="button"
          onClick={() => setMobileSidebarOpen(true)}
          className={cn(tabClass, 'text-muted-foreground/80')}
        >
          <HugeiconsIcon icon={MoreHorizontalIcon} className="size-[1.35rem]" strokeWidth={1.7} />
          <span className="max-w-full truncate text-[0.62rem] font-medium tracking-[0.01em]">
            {_(msg`More`)}
          </span>
        </button>
      </div>
    </nav>
  );
}
