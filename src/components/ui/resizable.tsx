'use client';
import { HorizontalResizeIcon } from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react';
import type * as React from 'react';
import * as ResizablePrimitive from 'react-resizable-panels';

import { cn } from '@/lib/utils';

function ResizablePanelGroup({
  className,
  orientation = 'horizontal',
  ...props
}: React.ComponentProps<typeof ResizablePrimitive.Group>) {
  return (
    <ResizablePrimitive.Group
      data-slot="resizable-panel-group"
      orientation={orientation}
      className={cn('flex h-full w-full data-[panel-group-direction=vertical]:flex-col', className)}
      {...props}
    />
  );
}

function ResizablePanel({ ...props }: React.ComponentProps<typeof ResizablePrimitive.Panel>) {
  return <ResizablePrimitive.Panel data-slot="resizable-panel" {...props} />;
}

function ResizableHandle({
  className,
  ...props
}: React.ComponentProps<typeof ResizablePrimitive.Separator>) {
  return (
    <ResizablePrimitive.Separator
      data-slot="resizable-handle"
      className={cn(
        'group/handle relative flex w-4 mx-0.5 items-center justify-center cursor-col-resize transition-colors duration-200 focus-visible:outline-hidden data-[panel-group-direction=vertical]:h-4 data-[panel-group-direction=vertical]:my-0.5 data-[panel-group-direction=vertical]:w-full data-[panel-group-direction=vertical]:cursor-row-resize [&[data-panel-group-direction=vertical]>div]:rotate-90',
        className
      )}
      {...props}
    >
      <div className="absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-foreground/0 transition-colors duration-200 group-hover/handle:bg-foreground/10 group-active/handle:bg-foreground/15" />
      <div className="absolute top-1/2 left-1/2 z-10 -translate-x-1/2 -translate-y-1/2 text-foreground/40 opacity-0 transition-opacity duration-200 group-hover/handle:opacity-100 group-active/handle:opacity-100">
        <HugeiconsIcon icon={HorizontalResizeIcon} className="size-5" />
      </div>
    </ResizablePrimitive.Separator>
  );
}

export { ResizablePanelGroup, ResizablePanel, ResizableHandle };
