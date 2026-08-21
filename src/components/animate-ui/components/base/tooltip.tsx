import {
  TooltipArrow as TooltipArrowPrimitive,
  TooltipPopup as TooltipPopupPrimitive,
  type TooltipPopupProps as TooltipPopupPrimitiveProps,
  TooltipPortal as TooltipPortalPrimitive,
  TooltipPositioner as TooltipPositionerPrimitive,
  type TooltipPositionerProps as TooltipPositionerPrimitiveProps,
  Tooltip as TooltipPrimitive,
  type TooltipProps as TooltipPrimitiveProps,
  TooltipProvider as TooltipProviderPrimitive,
  type TooltipProviderProps as TooltipProviderPrimitiveProps,
  TooltipTrigger as TooltipTriggerPrimitive,
  type TooltipTriggerProps as TooltipTriggerPrimitiveProps,
} from '@/components/animate-ui/primitives/base/tooltip';
import { cn } from '@/lib/utils';

type TooltipProviderProps = TooltipProviderPrimitiveProps;

function TooltipProvider({ delay = 0, ...props }: TooltipProviderProps) {
  return <TooltipProviderPrimitive delay={delay} {...props} />;
}

type TooltipProps = TooltipPrimitiveProps & {
  delay?: TooltipProviderPrimitiveProps['delay'];
};

function Tooltip({ delay = 0, ...props }: TooltipProps) {
  return (
    <TooltipProvider delay={delay}>
      <TooltipPrimitive {...props} />
    </TooltipProvider>
  );
}

type TooltipTriggerProps = TooltipTriggerPrimitiveProps;

function TooltipTrigger({ ...props }: TooltipTriggerProps) {
  return <TooltipTriggerPrimitive {...props} />;
}

type TooltipPanelProps = TooltipPositionerPrimitiveProps & TooltipPopupPrimitiveProps;

function TooltipPanel({ className, sideOffset = 4, children, style, ...props }: TooltipPanelProps) {
  return (
    <TooltipPortalPrimitive>
      <TooltipPositionerPrimitive sideOffset={sideOffset} className="z-[60]" {...props}>
        <TooltipPopupPrimitive
          className={cn(
            // Matches the popover/menu glass system rather than shouting in
            // `--primary`; the /90 + /75 opacity pair is the same one menu.tsx uses.
            'bg-popover/90 backdrop-blur-xl supports-[backdrop-filter]:bg-popover/75 supports-[backdrop-filter]:backdrop-saturate-150',
            'text-popover-foreground ring-1 ring-foreground/10 shadow-md',
            'w-fit origin-(--transform-origin) rounded-md px-3 py-1.5 text-xs text-balance',
            className
          )}
          style={style}
        >
          {children}
          {/* No ring here — a rotated square would show it on all four sides. The
              -4px offset tucks the arrow under the popup, hiding the seam. */}
          <TooltipArrowPrimitive className="bg-popover/90 fill-popover supports-[backdrop-filter]:bg-popover/75 backdrop-blur-xl z-50 size-2.5 data-[side='bottom']:-top-[4px] data-[side='right']:-left-[4px] data-[side='left']:-right-[4px] data-[side='inline-start']:-right-[4px] data-[side='inline-end']:-left-[4px] rotate-45 rounded-[2px]" />
        </TooltipPopupPrimitive>
      </TooltipPositionerPrimitive>
    </TooltipPortalPrimitive>
  );
}

export {
  Tooltip,
  TooltipTrigger,
  TooltipPanel,
  type TooltipProps,
  type TooltipTriggerProps,
  type TooltipPanelProps,
};
