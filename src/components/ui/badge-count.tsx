import { useLingui } from '@lingui/react';
import { motion } from 'motion/react';
import { useMemo } from 'react';
import { CountingNumber } from '@/components/animate-ui/primitives/texts/counting-number';
import { cn } from '@/lib/utils';

interface AnimatedBadgeProps {
  count: number;
  className?: string;
  animateOnMount?: boolean;
}

/** Split compact format into numeric value and suffix using formatToParts */
function getCompactParts(
  formatter: Intl.NumberFormat,
  count: number
): { compactValue: number; suffix: string; decimalPlaces: number } {
  const parts = formatter.formatToParts(count);
  const suffix = parts.find((p) => p.type === 'compact')?.value ?? '';
  if (!suffix) {
    return { compactValue: count, suffix: '', decimalPlaces: 0 };
  }

  // Reconstruct the numeric portion from parts
  const numStr = parts
    .filter((p) => p.type === 'integer' || p.type === 'decimal' || p.type === 'fraction')
    .map((p) => p.value)
    .join('');
  const compactValue = Number.parseFloat(numStr) || count;
  const fractionPart = parts.find((p) => p.type === 'fraction');
  const decimalPlaces = fractionPart ? fractionPart.value.length : 0;

  return { compactValue, suffix, decimalPlaces };
}

export function AnimatedBadge({
  count,
  className = '',
  animateOnMount = true,
}: AnimatedBadgeProps) {
  const { i18n } = useLingui();
  const compactFormatter = useMemo(
    () => new Intl.NumberFormat(i18n.locale, { notation: 'compact', maximumFractionDigits: 1 }),
    [i18n.locale]
  );
  const plainFormatter = useMemo(
    () => new Intl.NumberFormat(i18n.locale, { maximumFractionDigits: 1 }),
    [i18n.locale]
  );

  if (count <= 0) {
    return null;
  }

  const { compactValue, suffix, decimalPlaces } = getCompactParts(compactFormatter, count);
  const formattedCount = compactFormatter.format(count);
  const minWidth = formattedCount.length * 0.6;

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
      <CountingNumber
        number={compactValue}
        decimalPlaces={decimalPlaces}
        initiallyStable={!animateOnMount}
        formatter={(value) => plainFormatter.format(value)}
      />
      {suffix}
    </motion.span>
  );
}
