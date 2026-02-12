import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { useId } from 'react';
import { cn } from '@/lib/utils';

interface AppLogoProps {
  className?: string;
  markClassName?: string;
  wordmarkClassName?: string;
  showWordmark?: boolean;
}

export function AppLogo({
  className,
  markClassName,
  wordmarkClassName,
  showWordmark = true,
}: AppLogoProps) {
  const { _ } = useLingui();
  const id = useId().replace(/:/g, '');
  const bgGradientId = `${id}-bg`;
  const panelGradientId = `${id}-panel`;
  const bookGradientId = `${id}-book`;

  return (
    <div className={cn('flex items-center gap-2.5', className)}>
      <svg
        viewBox="0 0 48 48"
        className={cn('size-8 shrink-0', markClassName)}
        role="img"
        aria-label={_(msg`Minikyu`)}
      >
        <defs>
          <linearGradient
            id={bgGradientId}
            x1="8"
            y1="6"
            x2="42"
            y2="42"
            gradientUnits="userSpaceOnUse"
          >
            <stop stopColor="#FF7A59" />
            <stop offset="1" stopColor="#FF3B6E" />
          </linearGradient>
          <linearGradient
            id={panelGradientId}
            x1="14"
            y1="12"
            x2="34"
            y2="36"
            gradientUnits="userSpaceOnUse"
          >
            <stop stopColor="#1A1124" />
            <stop offset="1" stopColor="#0B0A12" />
          </linearGradient>
          <linearGradient
            id={bookGradientId}
            x1="19"
            y1="28"
            x2="29"
            y2="37"
            gradientUnits="userSpaceOnUse"
          >
            <stop stopColor="#53A8FF" />
            <stop offset="1" stopColor="#2B6BFF" />
          </linearGradient>
        </defs>

        <rect x="2.5" y="2.5" width="43" height="43" rx="13" fill={`url(#${bgGradientId})`} />
        <rect
          x="2.5"
          y="2.5"
          width="43"
          height="43"
          rx="13"
          fill="none"
          stroke="hsl(var(--background) / 0.24)"
          strokeWidth="1"
        />

        <rect x="11" y="9.5" width="26" height="29" rx="8" fill={`url(#${panelGradientId})`} />
        <rect
          x="11"
          y="9.5"
          width="26"
          height="29"
          rx="8"
          fill="none"
          stroke="hsl(var(--background) / 0.2)"
        />

        <circle cx="24" cy="23" r="7.3" fill="#FFF7F2" />
        <circle cx="21" cy="22.1" r="1" fill="#1A1124" />
        <circle cx="27" cy="22.1" r="1" fill="#1A1124" />
        <path
          d="M21.7 25.2c.9 1 3.8 1 4.7 0"
          stroke="#2A1A30"
          strokeWidth="1.2"
          strokeLinecap="round"
        />

        <rect x="18" y="27.3" width="12" height="7.8" rx="2.4" fill={`url(#${bookGradientId})`} />
        <path d="M24 27.3v7.8" stroke="#DBEDFF" strokeOpacity="0.75" strokeWidth="0.7" />
        <path
          d="M20 29.8h2.8M20 31.6h3.6M25.5 29.8h2.8M25.5 31.6h2.1"
          stroke="#ECF6FF"
          strokeWidth="0.9"
          strokeLinecap="round"
        />
      </svg>

      {showWordmark ? (
        <div className={cn('flex min-w-0 flex-col', wordmarkClassName)}>
          <span className="truncate text-sm font-semibold leading-none tracking-tight text-sidebar-foreground">
            {_(msg`Minikyu`)}
          </span>
          <span className="truncate pt-1 text-[11px] leading-none text-sidebar-foreground/65">
            {_(msg`RSS Reader`)}
          </span>
        </div>
      ) : null}
    </div>
  );
}
