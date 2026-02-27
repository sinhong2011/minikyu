import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { useEffect, useRef, useState } from 'react';
import { formatShortcutDisplay, keyEventToShortcutString } from '@/lib/shortcut-registry';
import { cn } from '@/lib/utils';

interface KeyCaptureProps {
  value: string;
  defaultValue: string;
  onChange: (shortcut: string | null) => void;
  className?: string;
}

/**
 * Inline key capture widget for configuring keyboard shortcuts.
 * Clicking starts capture mode; pressing any key combo saves the new shortcut.
 * Escape cancels. Supports single keys ("m") and combos ("mod+d").
 */
export function KeyCapture({ value, defaultValue, onChange, className }: KeyCaptureProps) {
  const { _ } = useLingui();
  const [isCapturing, setIsCapturing] = useState(false);
  const [pendingShortcut, setPendingShortcut] = useState<string | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const isDefault = value === defaultValue;

  useEffect(() => {
    if (!isCapturing) return;

    const el = buttonRef.current;

    const handleKeyDown = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();

      if (e.key === 'Escape') {
        setPendingShortcut(null);
        setIsCapturing(false);
        return;
      }

      const shortcut = keyEventToShortcutString(e);
      if (shortcut) {
        setPendingShortcut(shortcut);
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();

      if (pendingShortcut) {
        const valueToSave = pendingShortcut === defaultValue ? null : pendingShortcut;
        onChange(valueToSave);
        setPendingShortcut(null);
        setIsCapturing(false);
      }
    };

    const handleBlur = () => {
      setPendingShortcut(null);
      setIsCapturing(false);
    };

    window.addEventListener('keydown', handleKeyDown, true);
    window.addEventListener('keyup', handleKeyUp, true);
    el?.addEventListener('blur', handleBlur);

    return () => {
      window.removeEventListener('keydown', handleKeyDown, true);
      window.removeEventListener('keyup', handleKeyUp, true);
      el?.removeEventListener('blur', handleBlur);
    };
  }, [isCapturing, pendingShortcut, defaultValue, onChange]);

  const handleClick = () => {
    setIsCapturing(true);
    buttonRef.current?.focus();
  };

  const handleReset = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange(null);
  };

  return (
    <div className="flex items-center gap-2">
      <button
        ref={buttonRef}
        type="button"
        tabIndex={0}
        onClick={handleClick}
        className={cn(
          'border-input h-7 min-w-[80px] rounded-md border bg-transparent px-2 py-0.5 text-xs shadow-xs transition-[color,box-shadow] outline-none select-none',
          'focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]',
          'flex items-center justify-center font-mono',
          isCapturing && 'border-ring ring-ring/50 ring-[3px] bg-muted/50',
          className
        )}
      >
        {isCapturing ? (
          <span className="text-muted-foreground animate-pulse">
            {pendingShortcut ? formatShortcutDisplay(pendingShortcut) : _(msg`Press key...`)}
          </span>
        ) : (
          <span className={isDefault ? 'text-muted-foreground' : ''}>
            {formatShortcutDisplay(value)}
          </span>
        )}
      </button>

      {!isDefault && (
        <button
          type="button"
          onClick={handleReset}
          className="text-muted-foreground hover:text-foreground text-xs underline"
        >
          {_(msg`Reset`)}
        </button>
      )}
    </div>
  );
}
