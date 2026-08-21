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
 * Bottom tab bar for phone layouts (<768px), mirroring the sidebar's Views so
 * primary navigation lives in the thumb zone. Categories and feeds stay in the
 * drawer, reached through the More tab; Settings sits at the top of the drawer.
 *
 * Hidden on desktop, where the sidebar covers navigation. It deliberately stays
 * mounted while an entry is open: the reader is a sibling overlay that slides
 * over it, so unmounting here would make the bar blink out a beat before the
 * reader arrives. That only works while the two are siblings — hence
 * `absolute`, positioned against the reader's own container rather than the
 * viewport, which also keeps the ordering immune to any stacking context an
 * ancestor picks up (the frosted-glass backdrop-filter, for one).
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

  return (
    <nav
      aria-label={_(msg`Primary`)}
      className="absolute inset-x-0 bottom-0 z-30 border-t border-border bg-background pb-[env(safe-area-inset-bottom)]"
    >
      <div className="flex h-14 items-stretch">
        {VIEW_TABS.map((tab) => {
          const isActive = activeFilter === tab.filter;
          return (
            <Link
              key={tab.filter ?? 'all'}
              to="/"
              search={tab.filter ? { filter: tab.filter } : {}}
              className={cn(
                'flex min-w-0 flex-1 flex-col items-center justify-center gap-1 text-[0.68rem] font-medium transition-colors active:opacity-60',
                isActive ? 'text-primary' : 'text-muted-foreground'
              )}
            >
              <HugeiconsIcon icon={tab.icon} className="size-5" />
              <span className="truncate">{_(tab.label)}</span>
            </Link>
          );
        })}
        <button
          type="button"
          onClick={() => setMobileSidebarOpen(true)}
          className="flex min-w-0 flex-1 flex-col items-center justify-center gap-1 text-[0.68rem] font-medium text-muted-foreground transition-colors active:opacity-60"
        >
          <HugeiconsIcon icon={MoreHorizontalIcon} className="size-5" />
          <span className="truncate">{_(msg`More`)}</span>
        </button>
      </div>
    </nav>
  );
}
