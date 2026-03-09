import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useState } from 'react';

interface TranslationProgressRingProps {
  completed: number;
  total: number;
}

const RING_SIZE = 20;
const STROKE_WIDTH = 2;
const RADIUS = (RING_SIZE - STROKE_WIDTH) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

export function TranslationProgressRing({ completed, total }: TranslationProgressRingProps) {
  const [showComplete, setShowComplete] = useState(false);

  const isComplete = total > 0 && completed >= total;
  const progress = total > 0 ? completed / total : 0;
  const strokeDashoffset = CIRCUMFERENCE * (1 - progress);

  useEffect(() => {
    if (isComplete) {
      setShowComplete(true);
      const timer = window.setTimeout(() => {
        setShowComplete(false);
      }, 1500);
      return () => window.clearTimeout(timer);
    }
    setShowComplete(false);
  }, [isComplete]);

  const visible = total > 0 && (!isComplete || showComplete);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.8 }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
          aria-label={`Translation progress: ${completed} of ${total}`}
          role="progressbar"
          aria-valuenow={completed}
          aria-valuemax={total}
        >
          <div className="pointer-events-auto flex items-center gap-1.5 rounded-full bg-popover/75 px-2 py-1 ring-1 ring-foreground/10 shadow-lg backdrop-blur-2xl backdrop-saturate-150">
            <svg
              width={RING_SIZE}
              height={RING_SIZE}
              viewBox={`0 0 ${RING_SIZE} ${RING_SIZE}`}
              className="-rotate-90"
            >
              <circle
                cx={RING_SIZE / 2}
                cy={RING_SIZE / 2}
                r={RADIUS}
                fill="none"
                stroke="currentColor"
                strokeWidth={STROKE_WIDTH}
                className="text-muted-foreground/15"
              />
              <motion.circle
                cx={RING_SIZE / 2}
                cy={RING_SIZE / 2}
                r={RADIUS}
                fill="none"
                stroke="currentColor"
                strokeWidth={STROKE_WIDTH}
                strokeLinecap="round"
                strokeDasharray={CIRCUMFERENCE}
                animate={{ strokeDashoffset }}
                transition={{ duration: 0.35, ease: 'easeOut' }}
                className={isComplete ? 'text-emerald-500' : 'text-primary'}
              />
            </svg>
            {isComplete ? (
              <motion.span
                initial={{ scale: 0.5, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ duration: 0.2, delay: 0.1 }}
                data-testid="progress-ring-complete"
                className="pr-0.5 text-[9px] font-semibold text-emerald-500"
              >
                ✓
              </motion.span>
            ) : (
              <span className="flex items-baseline gap-0.5 pr-0.5 text-[9px] leading-none text-muted-foreground">
                <motion.span
                  key={completed}
                  initial={{ y: -4, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ duration: 0.15 }}
                  className="font-semibold tabular-nums text-foreground/80"
                >
                  {completed}
                </motion.span>
                <span className="opacity-40">/</span>
                <span className="tabular-nums">{total}</span>
              </span>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
