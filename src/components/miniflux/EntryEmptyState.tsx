import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';

export function EntryEmptyState() {
  const { _ } = useLingui();

  return (
    <div className="relative flex flex-1 flex-col items-center justify-center overflow-hidden px-6 py-10">
      <div className="pointer-events-none absolute inset-0 opacity-90">
        <div className="absolute -top-40 left-1/2 h-72 w-72 -translate-x-1/2 rounded-full bg-[radial-gradient(circle_at_center,color-mix(in_oklch,var(--color-primary)_28%,transparent)_0%,transparent_72%)]" />
        <div className="absolute bottom-8 left-1/2 h-56 w-96 -translate-x-1/2 rounded-full bg-[radial-gradient(circle_at_center,color-mix(in_oklch,var(--color-chart-2)_24%,transparent)_0%,transparent_74%)] blur-md" />
      </div>

      <div className="relative w-full max-w-[420px]">
        <svg
          viewBox="0 0 420 280"
          className="mx-auto w-full max-w-[420px] drop-shadow-[0_26px_44px_color-mix(in_oklch,var(--color-primary)_18%,transparent)]"
          role="img"
          aria-label={_(msg`Reader companion illustration`)}
        >
          <defs>
            <linearGradient id="entry-empty-shell" x1="15%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="var(--color-card)" />
              <stop
                offset="100%"
                stopColor="color-mix(in oklch, var(--color-primary) 14%, var(--color-card))"
              />
            </linearGradient>
            <linearGradient id="entry-empty-book" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="var(--color-chart-2)" />
              <stop offset="100%" stopColor="var(--color-primary)" />
            </linearGradient>
            <linearGradient id="entry-empty-orbit" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="var(--color-chart-3)" />
              <stop offset="100%" stopColor="var(--color-chart-2)" />
            </linearGradient>
          </defs>

          <ellipse
            cx="210"
            cy="238"
            rx="112"
            ry="18"
            className="entry-empty-shadow"
            fill="var(--color-foreground)"
            fillOpacity="0.18"
          />

          <ellipse
            cx="210"
            cy="238"
            rx="74"
            ry="11"
            fill="var(--color-background)"
            fillOpacity="0.65"
          />

          <g className="entry-empty-float-slow">
            <rect
              x="316"
              y="70"
              width="52"
              height="34"
              rx="11"
              fill="var(--color-card)"
              stroke="var(--color-border)"
            />
            <circle cx="334" cy="87" r="6" fill="var(--color-chart-2)" />
            <rect
              x="345"
              y="82"
              width="15"
              height="4"
              rx="2"
              fill="var(--color-muted-foreground)"
            />
            <rect
              x="345"
              y="90"
              width="11"
              height="4"
              rx="2"
              fill="var(--color-muted-foreground)"
            />
          </g>

          <g className="entry-empty-float-fast">
            <rect
              x="48"
              y="114"
              width="56"
              height="38"
              rx="11"
              fill="var(--color-card)"
              stroke="var(--color-border)"
            />
            <path
              d="M63 125h26M63 133h21M63 141h17"
              fill="none"
              stroke="var(--color-muted-foreground)"
              strokeLinecap="round"
              strokeWidth="3"
            />
          </g>

          <g className="entry-empty-float-medium">
            <circle cx="352" cy="152" r="10" fill="var(--color-chart-3)" />
            <circle cx="352" cy="152" r="3" fill="var(--color-background)" />
          </g>

          <rect
            x="78"
            y="48"
            width="264"
            height="172"
            rx="38"
            fill="url(#entry-empty-shell)"
            stroke="var(--color-border)"
            strokeWidth="2"
          />

          <ellipse
            cx="210"
            cy="134"
            rx="98"
            ry="64"
            className="entry-empty-aura"
            fill="var(--color-chart-2)"
            fillOpacity="0.15"
          />

          <g className="entry-empty-orbit entry-empty-orbit-forward">
            <ellipse
              cx="210"
              cy="134"
              rx="126"
              ry="88"
              fill="none"
              stroke="url(#entry-empty-orbit)"
              strokeDasharray="8 14"
              strokeLinecap="round"
              strokeOpacity="0.5"
              strokeWidth="2.5"
            />
            <circle cx="336" cy="134" r="6" fill="var(--color-chart-2)" />
          </g>

          <g className="entry-empty-hero">
            <path
              d="M151 197c0-33 27-58 59-58s59 25 59 58v19H151v-19Z"
              fill="var(--color-secondary)"
            />
            <path
              d="M173 102l18 18-24 7Z"
              fill="var(--color-chart-1)"
              fillOpacity="0.72"
              stroke="var(--color-border)"
            />
            <path
              d="M247 102l-18 18 24 7Z"
              fill="var(--color-chart-1)"
              fillOpacity="0.72"
              stroke="var(--color-border)"
            />

            <circle cx="210" cy="136" r="44" fill="var(--color-background)" />
            <circle cx="210" cy="136" r="44" fill="var(--color-primary)" fillOpacity="0.18" />
            <circle cx="192" cy="132" r="5.3" fill="var(--color-foreground)" fillOpacity="0.88" />
            <circle cx="228" cy="132" r="5.3" fill="var(--color-foreground)" fillOpacity="0.88" />
            <rect
              x="186.6"
              y="128"
              width="10.8"
              height="8.2"
              rx="4"
              className="entry-empty-eye"
              fill="var(--color-foreground)"
              fillOpacity="0.9"
            />
            <rect
              x="222.6"
              y="128"
              width="10.8"
              height="8.2"
              rx="4"
              className="entry-empty-eye"
              fill="var(--color-foreground)"
              fillOpacity="0.9"
            />
            <path
              d="M198 153c6 7 20 7 25 0"
              fill="none"
              stroke="var(--color-foreground)"
              strokeOpacity="0.72"
              strokeLinecap="round"
              strokeWidth="3.2"
            />
            <path
              d="M145 175c11-12 27-13 39-4"
              fill="none"
              stroke="var(--color-border)"
              strokeWidth="10"
            />
            <path
              d="M275 175c-11-12-27-13-39-4"
              fill="none"
              stroke="var(--color-border)"
              strokeWidth="10"
            />

            <g className="entry-empty-book">
              <rect
                x="152"
                y="179"
                width="116"
                height="52"
                rx="14"
                fill="url(#entry-empty-book)"
                stroke="var(--color-primary)"
                strokeOpacity="0.5"
              />
              <path
                d="M210 179v52"
                fill="none"
                stroke="var(--color-primary-foreground)"
                strokeOpacity="0.48"
              />
              <path
                d="M170 196h23M170 206h30M170 216h19M219 196h24M219 206h18M219 216h13"
                fill="none"
                stroke="var(--color-primary-foreground)"
                strokeLinecap="round"
                strokeOpacity="0.85"
                strokeWidth="3"
              />
            </g>
          </g>

          <g className="entry-empty-spark" style={{ animationDelay: '-0.8s' }}>
            <path
              d="M82 74l3.4 8.7L94 86l-8.6 3.3L82 98l-3.4-8.7L70 86l8.6-3.3Z"
              fill="var(--color-chart-2)"
              fillOpacity="0.76"
            />
          </g>
          <g className="entry-empty-spark" style={{ animationDelay: '-2.1s' }}>
            <path
              d="M326 48l2.9 7.2 7.2 2.8-7.2 2.8-2.9 7.2-2.8-7.2-7.3-2.8 7.3-2.8Z"
              fill="var(--color-chart-3)"
              fillOpacity="0.74"
            />
          </g>
          <g className="entry-empty-spark" style={{ animationDelay: '-1.4s' }}>
            <path
              d="M351 205l3 7.4 7.4 2.9-7.4 2.8-3 7.4-2.8-7.4-7.4-2.8 7.4-2.9Z"
              fill="var(--color-chart-2)"
              fillOpacity="0.68"
            />
          </g>

          <g className="entry-empty-signal">
            <rect
              x="132"
              y="64"
              width="156"
              height="8"
              rx="4"
              fill="var(--color-muted)"
              fillOpacity="0.78"
            />
          </g>
        </svg>
      </div>

      <p className="mt-3 text-base font-semibold tracking-tight">
        {_(msg`Select an entry to read`)}
      </p>
      <p className="mt-1 max-w-md text-center text-sm text-muted-foreground">
        {_(msg`Choose a story from the list and your reading companion will guide the focus.`)}
      </p>
      <p className="mt-3 text-xs font-medium tracking-wide text-muted-foreground/80">
        {_(msg`Tip: Use h / j to jump between entries quickly.`)}
      </p>
    </div>
  );
}
