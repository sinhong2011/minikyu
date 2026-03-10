import type * as React from 'react';
import { useRef } from 'react';

import { cn } from '@/lib/utils';

interface NumberInputProps {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
  disabled?: boolean;
  className?: string;
}

function NumberInput({
  value,
  onChange,
  min,
  max,
  step = 1,
  unit,
  disabled = false,
  className,
}: NumberInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const clamp = (v: number) => {
    let clamped = v;
    if (min !== undefined) clamped = Math.max(min, clamped);
    if (max !== undefined) clamped = Math.min(max, clamped);
    return clamped;
  };

  const increment = () => {
    if (disabled) return;
    const precision = step < 1 ? (String(step).split('.')[1]?.length ?? 0) : 0;
    onChange(clamp(Number((value + step).toFixed(precision))));
  };

  const decrement = () => {
    if (disabled) return;
    const precision = step < 1 ? (String(step).split('.')[1]?.length ?? 0) : 0;
    onChange(clamp(Number((value - step).toFixed(precision))));
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    if (raw === '') return;
    const parsed = step < 1 ? Number.parseFloat(raw) : Number.parseInt(raw, 10);
    if (!Number.isNaN(parsed)) {
      onChange(clamp(parsed));
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      increment();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      decrement();
    }
  };

  return (
    <div
      className={cn(
        'border-input dark:bg-input/30 inline-flex h-9 shrink-0 items-stretch gap-0.5 rounded-md border bg-transparent pr-0.5 shadow-xs transition-[color,box-shadow]',
        disabled && 'pointer-events-none opacity-50',
        className
      )}
    >
      <input
        ref={inputRef}
        type="text"
        inputMode="decimal"
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        disabled={disabled}
        className="w-12 self-center bg-transparent text-center text-sm tabular-nums outline-none"
      />
      {unit && (
        <span className="w-5 self-center text-center text-sm text-muted-foreground/70 select-none">
          {unit}
        </span>
      )}
      <div className="flex h-full flex-col">
        <button
          type="button"
          tabIndex={-1}
          onClick={increment}
          disabled={disabled || (max !== undefined && value >= max)}
          aria-label="Increment"
          className="flex flex-1 w-5 items-center justify-center rounded-sm text-muted-foreground/60 transition-colors hover:bg-white/10 hover:text-foreground disabled:pointer-events-none disabled:opacity-30"
        >
          <svg width="8" height="5" viewBox="0 0 8 5" fill="none" className="shrink-0">
            <path
              d="M1 4L4 1L7 4"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
        <button
          type="button"
          tabIndex={-1}
          onClick={decrement}
          disabled={disabled || (min !== undefined && value <= min)}
          aria-label="Decrement"
          className="flex flex-1 w-5 items-center justify-center rounded-sm text-muted-foreground/60 transition-colors hover:bg-white/10 hover:text-foreground disabled:pointer-events-none disabled:opacity-30"
        >
          <svg width="8" height="5" viewBox="0 0 8 5" fill="none" className="shrink-0">
            <path
              d="M1 1L4 4L7 1"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      </div>
    </div>
  );
}

export { NumberInput };
