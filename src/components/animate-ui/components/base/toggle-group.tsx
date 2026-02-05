import type { VariantProps } from 'class-variance-authority';
import { toggleVariants } from '@/components/animate-ui/components/base/toggle';
import {
  ToggleGroupHighlight as ToggleGroupHighlightPrimitive,
  ToggleGroup as ToggleGroupPrimitive,
  type ToggleGroupProps as ToggleGroupPrimitiveProps,
  ToggleHighlight as ToggleHighlightPrimitive,
  Toggle as TogglePrimitive,
  type ToggleProps as TogglePrimitiveProps,
  useToggleGroup as useToggleGroupPrimitive,
} from '@/components/animate-ui/primitives/base/toggle-group';
import { getStrictContext } from '@/lib/get-strict-context';
import { cn } from '@/lib/utils';

const [ToggleGroupProvider, useToggleGroup] =
  getStrictContext<VariantProps<typeof toggleVariants>>('ToggleGroupContext');

type ToggleGroupProps = ToggleGroupPrimitiveProps & VariantProps<typeof toggleVariants>;

function ToggleGroup({ className, variant, size, children, multiple, ...props }: ToggleGroupProps) {
  return (
    <ToggleGroupPrimitive
      data-variant={variant}
      data-size={size}
      className={cn(
        'group/toggle-group flex gap-0.5 w-fit items-center rounded-lg data-[variant=outline]:shadow-xs data-[variant=outline]:border data-[variant=outline]:p-0.5',
        className
      )}
      {...(multiple ? { multiple } : {})}
      {...props}
    >
      <ToggleGroupProvider value={{ variant, size }}>
        {!multiple ? (
          <ToggleGroupHighlightPrimitive className="bg-accent rounded-md">
            {children}
          </ToggleGroupHighlightPrimitive>
        ) : (
          children
        )}
      </ToggleGroupProvider>
    </ToggleGroupPrimitive>
  );
}

type ToggleProps = TogglePrimitiveProps & VariantProps<typeof toggleVariants>;

function Toggle({ className, children, variant, size, ...props }: ToggleProps) {
  const { variant: contextVariant, size: contextSize } = useToggleGroup();
  const { multiple } = useToggleGroupPrimitive();

  return (
    <ToggleHighlightPrimitive
      value={props.value?.toString()}
      className={cn(multiple && 'bg-accent rounded-md')}
    >
      <TogglePrimitive
        data-variant={contextVariant || variant}
        data-size={contextSize || size}
        className={cn(
          toggleVariants({
            variant: contextVariant || variant,
            size: contextSize || size,
          }),
          'min-w-0 border-0 flex-1 shrink-0 shadow-none rounded-md focus:z-10 focus-visible:z-10',
          className
        )}
        {...props}
      >
        {children}
      </TogglePrimitive>
    </ToggleHighlightPrimitive>
  );
}

export { ToggleGroup, Toggle, type ToggleGroupProps, type ToggleProps };
