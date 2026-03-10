'use client';

import { Slider as SliderPrimitive } from '@base-ui/react/slider';
import { motion, useMotionValue, useSpring, useTransform } from 'motion/react';
import * as React from 'react';

import { cn } from '@/lib/utils';

function Slider({
  className,
  defaultValue,
  value,
  min = 0,
  max = 100,
  ...props
}: SliderPrimitive.Root.Props) {
  const _values = React.useMemo(() => {
    if (Array.isArray(value)) {
      return value;
    }
    if (typeof value === 'number') {
      return [value];
    }
    if (Array.isArray(defaultValue)) {
      return defaultValue;
    }
    if (typeof defaultValue === 'number') {
      return [defaultValue];
    }
    return [min];
  }, [value, defaultValue, min]);

  return (
    <SliderPrimitive.Root
      className={cn('data-horizontal:w-full data-vertical:h-full', className)}
      data-slot="slider"
      defaultValue={defaultValue}
      value={value}
      min={min}
      max={max}
      thumbAlignment="edge"
      {...props}
    >
      <SliderPrimitive.Control className="data-vertical:min-h-40 group/slider relative flex w-full touch-none items-center select-none data-disabled:opacity-50 data-vertical:h-full data-vertical:w-auto data-vertical:flex-col">
        <SliderPrimitive.Track
          data-slot="slider-track"
          className="bg-white/10 relative grow overflow-hidden rounded-full select-none data-horizontal:h-1.5 data-horizontal:w-full data-vertical:h-full data-vertical:w-1.5 transition-[height] duration-200 group-hover/slider:data-horizontal:h-2"
        >
          <SliderPrimitive.Indicator
            data-slot="slider-range"
            className="bg-primary select-none data-horizontal:h-full data-vertical:w-full"
          />
        </SliderPrimitive.Track>
        {Array.from({ length: _values.length }, (_, index) => (
          <AnimatedThumb
            // biome-ignore lint/suspicious/noArrayIndexKey: thumbs map to value positions
            key={`thumb-${index}`}
            value={_values[index]}
            min={min}
            max={max}
          />
        ))}
      </SliderPrimitive.Control>
    </SliderPrimitive.Root>
  );
}

function AnimatedThumb({ value, min, max }: { value: number; min: number; max: number }) {
  const progress = useMotionValue((value - min) / (max - min));
  const springProgress = useSpring(progress, { stiffness: 300, damping: 30 });
  const glowOpacity = useTransform(springProgress, [0, 1], [0.15, 0.5]);
  const glowScale = useTransform(springProgress, [0, 1], [1, 1.3]);

  React.useEffect(() => {
    progress.set((value - min) / (max - min));
  }, [value, min, max, progress]);

  return (
    <SliderPrimitive.Thumb
      data-slot="slider-thumb"
      className="relative block size-3.5 shrink-0 cursor-grab select-none rounded-full border border-white/30 bg-white shadow-sm transition-shadow after:absolute after:-inset-3 hover:shadow-[0_0_8px_rgba(255,255,255,0.3)] focus-visible:shadow-[0_0_8px_rgba(255,255,255,0.3)] focus-visible:outline-hidden active:cursor-grabbing active:scale-110 disabled:pointer-events-none disabled:opacity-50 group-hover/slider:size-4"
      render={
        <motion.span
          style={{
            boxShadow: useTransform(glowOpacity, (o) => `0 0 12px rgba(255,255,255,${o})`),
          }}
        />
      }
    >
      <motion.span
        className="pointer-events-none absolute inset-0 rounded-full bg-primary/40"
        style={{
          opacity: glowOpacity,
          scale: glowScale,
        }}
      />
    </SliderPrimitive.Thumb>
  );
}

export { Slider };
