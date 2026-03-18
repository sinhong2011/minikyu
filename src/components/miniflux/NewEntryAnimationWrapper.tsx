import { motion } from 'motion/react';
import { useEffect, useRef, useState } from 'react';

interface NewEntryAnimationWrapperProps {
  isNew: boolean;
  staggerIndex: number;
  children: React.ReactNode;
}

export function NewEntryAnimationWrapper({
  isNew,
  staggerIndex,
  children,
}: NewEntryAnimationWrapperProps) {
  const contentRef = useRef<HTMLDivElement>(null);
  const [measuredHeight, setMeasuredHeight] = useState<number | 'auto'>('auto');
  const [animating, setAnimating] = useState(isNew);

  useEffect(() => {
    if (isNew && contentRef.current) {
      setMeasuredHeight(contentRef.current.scrollHeight);
    }
  }, [isNew]);

  if (!isNew && !animating) {
    return <div className="px-3">{children}</div>;
  }

  const delay = staggerIndex * 0.05;

  return (
    <motion.div
      className="px-3"
      initial={isNew ? { height: 0, opacity: 0, filter: 'blur(0.8px)' } : false}
      animate={{ height: measuredHeight, opacity: 1, filter: 'blur(0px)' }}
      transition={{
        height: {
          type: 'spring',
          stiffness: 400,
          damping: 30,
          delay,
        },
        opacity: {
          duration: 0.32,
          ease: [0.2, 0.95, 0.35, 1],
          delay: delay + 0.05,
        },
        filter: {
          duration: 0.38,
          ease: [0.22, 1, 0.36, 1],
          delay: delay + 0.03,
        },
      }}
      style={animating ? { overflow: 'hidden' } : undefined}
      onAnimationComplete={() => {
        setAnimating(false);
        setMeasuredHeight('auto');
      }}
    >
      <div ref={contentRef}>{children}</div>
    </motion.div>
  );
}
