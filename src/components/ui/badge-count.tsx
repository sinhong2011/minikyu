import { useLingui } from '@lingui/react';
import { useMemo } from 'react';
import { cn } from '@/lib/utils';

interface AnimatedBadgeProps {
  count: number;
  className?: string;
  /** Kept for call-site compatibility; the badge no longer animates. */
  animateOnMount?: boolean;
}

/**
 * Unread-count badge. Renders the compact-notation number as static text —
 * the digit-rolling and mount animations were removed deliberately: counts
 * change constantly while syncing, and the churn drew the eye to chrome
 * instead of content.
 */
export function AnimatedBadge({ count, className = '' }: AnimatedBadgeProps) {
  const { i18n } = useLingui();
  const compactFormatter = useMemo(
    () => new Intl.NumberFormat(i18n.locale, { notation: 'compact', maximumFractionDigits: 1 }),
    [i18n.locale]
  );

  if (count <= 0) {
    return null;
  }

  const formattedCount = compactFormatter.format(count);

  return (
    <span
      className={cn(
        'inline-flex items-center font-sans tabular-nums lining-nums text-muted-foreground leading-none',
        className
      )}
    >
      {formattedCount}
    </span>
  );
}
