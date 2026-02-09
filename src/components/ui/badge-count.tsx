import { motion } from 'motion/react';
import { CountingNumber } from '@/components/animate-ui/primitives/texts/counting-number';

interface AnimatedBadgeProps {
  count: number;
  className?: string;
}

export function AnimatedBadge({ count, className = '' }: AnimatedBadgeProps) {
  if (count <= 0) {
    return null;
  }

  const digitCount = Math.max(Math.floor(Math.log10(Math.abs(count))).toString().length, 1);
  const minWidth = digitCount * 0.75;

  return (
    <motion.span
      className={className}
      initial={{ opacity: 0, scale: 0.8, y: 5 }}
      animate={{ scale: 1, opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.8, y: 0 }}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        minWidth: `${minWidth}em`,
        height: '20px',
      }}
    >
      <CountingNumber number={count} />
    </motion.span>
  );
}
