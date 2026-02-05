import {
  ProgressIndicator as ProgressIndicatorPrimitive,
  ProgressLabel as ProgressLabelPrimitive,
  type ProgressLabelProps as ProgressLabelPrimitiveProps,
  Progress as ProgressPrimitive,
  type ProgressProps as ProgressPrimitiveProps,
  ProgressTrack as ProgressTrackPrimitive,
  type ProgressTrackProps as ProgressTrackPrimitiveProps,
  ProgressValue as ProgressValuePrimitive,
  type ProgressValueProps as ProgressValuePrimitiveProps,
} from '@/components/animate-ui/primitives/base/progress';
import { cn } from '@/lib/utils';

type ProgressProps = ProgressPrimitiveProps;

function Progress(props: ProgressProps) {
  return <ProgressPrimitive {...props} />;
}

type ProgressTrackProps = ProgressTrackPrimitiveProps;

function ProgressTrack({ className, ...props }: ProgressTrackProps) {
  return (
    <ProgressTrackPrimitive
      className={cn('bg-primary/20 relative h-2 w-full overflow-hidden rounded-full', className)}
      {...props}
    >
      <ProgressIndicatorPrimitive className="bg-primary rounded-full h-full w-full flex-1" />
    </ProgressTrackPrimitive>
  );
}

type ProgressLabelProps = ProgressLabelPrimitiveProps;

function ProgressLabel(props: ProgressLabelProps) {
  return <ProgressLabelPrimitive className="text-sm font-medium" {...props} />;
}

type ProgressValueProps = ProgressValuePrimitiveProps;

function ProgressValue(props: ProgressValueProps) {
  return <ProgressValuePrimitive className="text-sm" {...props} />;
}

export {
  Progress,
  ProgressTrack,
  ProgressLabel,
  ProgressValue,
  type ProgressProps,
  type ProgressTrackProps,
  type ProgressLabelProps,
  type ProgressValueProps,
};
