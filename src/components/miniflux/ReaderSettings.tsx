import { MinusSignIcon, PlusSignIcon, TextFontIcon, TextIcon } from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react';
import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { Button, buttonVariants } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Separator } from '@/components/ui/separator';
import { Slider } from '@/components/ui/slider';
import { useReaderSettings } from '@/hooks/use-reader-settings';
import { cn } from '@/lib/utils';

export function ReaderSettings() {
  const { _ } = useLingui();
  const { fontSize, setFontSize, lineWidth, setLineWidth, fontFamily, setFontFamily } =
    useReaderSettings();

  return (
    <Popover>
      <PopoverTrigger className={cn(buttonVariants({ variant: 'ghost', size: 'icon' }), 'h-9 w-9')}>
        <HugeiconsIcon icon={TextFontIcon} className="h-5 w-5" strokeWidth={2} />
      </PopoverTrigger>
      <PopoverContent className="w-72 space-y-4">
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">{_(msg`Font Size`)}</span>
            <span className="text-xs text-muted-foreground">{fontSize}px</span>
          </div>
          <div className="flex items-center gap-4">
            <HugeiconsIcon icon={MinusSignIcon} className="h-4 w-4 text-muted-foreground" />
            <Slider
              value={[fontSize]}
              min={14}
              max={24}
              step={1}
              onValueChange={(val) => {
                if (Array.isArray(val)) setFontSize(val[0]);
              }}
            />
            <HugeiconsIcon icon={PlusSignIcon} className="h-4 w-4 text-muted-foreground" />
          </div>
        </div>

        <Separator />

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">{_(msg`Line Width`)}</span>
            <span className="text-xs text-muted-foreground">{lineWidth}ch</span>
          </div>
          <div className="flex items-center gap-4">
            <HugeiconsIcon icon={TextIcon} className="h-5 w-5" strokeWidth={2} />
            <Slider
              value={[lineWidth]}
              min={45}
              max={80}
              step={5}
              onValueChange={(val) => {
                if (Array.isArray(val)) setLineWidth(val[0]);
              }}
            />
            <HugeiconsIcon icon={TextIcon} className="h-4 w-4 text-muted-foreground shrink-0" />
          </div>
        </div>

        <Separator />

        <div className="space-y-3">
          <span className="text-sm font-medium">{_(msg`Font Family`)}</span>
          <div className="grid grid-cols-3 gap-2">
            {['sans-serif', 'serif', 'monospace'].map((f) => (
              <Button
                key={f}
                variant={fontFamily === f ? 'secondary' : 'outline'}
                size="sm"
                className="h-8 text-xs capitalize"
                onClick={() => setFontFamily(f)}
              >
                {f.split('-')[0]}
              </Button>
            ))}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
