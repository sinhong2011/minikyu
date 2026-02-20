import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useState } from 'react';

interface TranslationProgressRingProps {
  completed: number;
  total: number;
}

const RADIUS = 18;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
const SIZE = 48;
const STROKE_WIDTH = 3;
const CENTER = SIZE / 2;

export function TranslationProgressRing({ completed, total }: TranslationProgressRingProps) {
  const [showComplete, setShowComplete] = useState(false);

  const isComplete = total > 0 && completed >= total;
  const progress = total > 0 ? completed / total : 0;
  const dashOffset = CIRCUMFERENCE * (1 - progress);

  useEffect(() => {
    if (isComplete) {
      setShowComplete(true);
      const timer = window.setTimeout(() => {
        setShowComplete(false);
      }, 1200);
      return () => window.clearTimeout(timer);
    }
    setShowComplete(false);
  }, [isComplete]);

  const visible = total > 0 && (!isComplete || showComplete);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.24, ease: 'easeOut' }}
          className="fixed bottom-4 left-4 z-50"
          aria-label={`Translation progress: ${completed} of ${total}`}
          role="progressbar"
          aria-valuenow={completed}
          aria-valuemax={total}
        >
          <div
            className="flex items-center justify-center rounded-full border border-border/60 bg-background/95 shadow-lg backdrop-blur-sm"
            style={{ width: SIZE, height: SIZE }}
          >
            <svg
              width={SIZE}
              height={SIZE}
              className="absolute inset-0 -rotate-90"
              aria-hidden="true"
            >
              {/* Background track */}
              <circle
                cx={CENTER}
                cy={CENTER}
                r={RADIUS}
                fill="none"
                stroke="currentColor"
                strokeWidth={STROKE_WIDTH}
                className="text-muted/40"
              />
              {/* Progress arc */}
              <circle
                cx={CENTER}
                cy={CENTER}
                r={RADIUS}
                fill="none"
                stroke="currentColor"
                strokeWidth={STROKE_WIDTH}
                strokeDasharray={CIRCUMFERENCE}
                strokeDashoffset={dashOffset}
                strokeLinecap="round"
                className="text-primary transition-[stroke-dashoffset] duration-300 ease-out"
              />
            </svg>

            {/* Center content */}
            <div className="relative z-10 flex items-center justify-center">
              {isComplete ? (
                <span
                  data-testid="progress-ring-complete"
                  className="text-sm font-semibold text-primary"
                >
                  ✓
                </span>
              ) : (
                <motion.span
                  key={completed}
                  initial={{ scale: 1.3 }}
                  animate={{ scale: 1 }}
                  transition={{ duration: 0.12 }}
                  className="text-xs font-semibold tabular-nums text-foreground"
                >
                  {completed}
                </motion.span>
              )}
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
