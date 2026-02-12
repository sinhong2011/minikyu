import { motion } from 'motion/react';
import { CountingNumber } from '@/components/animate-ui/primitives/texts/counting-number';
import { cn } from '@/lib/utils';

interface AnimatedBadgeProps {
  count: number;
  className?: string;
  animateOnMount?: boolean;
}

export function AnimatedBadge({
  count,
  className = '',
  animateOnMount = true,
}: AnimatedBadgeProps) {
  if (count <= 0) {
    return null;
  }

  const digitCount = Math.max(Math.floor(Math.log10(Math.abs(count))).toString().length, 1);
  const minWidth = digitCount * 0.75;

  return (
    <motion.span
      className={cn(
        'font-sans tabular-nums lining-nums text-muted-foreground leading-none',
        className
      )}
      initial={animateOnMount ? { opacity: 0, scale: 0.8, y: 5 } : false}
      animate={{ scale: 1, opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.8, y: 0 }}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        minWidth: `${minWidth}em`,
      }}
    >
      <CountingNumber number={count} initiallyStable={!animateOnMount} />
    </motion.span>
  );
}
