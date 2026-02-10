import { MinusSignIcon, PlusSignIcon, TextFontIcon, TextIcon } from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react';
import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { buttonVariants } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Slider } from '@/components/ui/slider';
import { useReaderSettings } from '@/hooks/use-reader-settings';
import {
  getReaderFontStack,
  normalizeReaderFontFamily,
  type ReaderFontFamily,
  readerFontFamilies,
} from '@/lib/reader-fonts';
import { cn } from '@/lib/utils';

export function ReaderSettings() {
  const { _ } = useLingui();
  const { fontSize, setFontSize, lineWidth, setLineWidth, fontFamily, setFontFamily } =
    useReaderSettings();
  const selectedFontFamily = normalizeReaderFontFamily(fontFamily);

  const getFontLabel = (family: ReaderFontFamily) => {
    switch (family) {
      case 'sans-serif':
        return _(msg`Sans`);
      case 'raleway':
        return _(msg`Raleway`);
      case 'system-ui':
        return _(msg`System UI`);
      case 'humanist':
        return _(msg`Humanist`);
      case 'serif':
        return _(msg`Serif`);
      case 'georgia':
        return _(msg`Georgia`);
      case 'book-serif':
        return _(msg`Book Serif`);
      case 'monospace':
        return _(msg`Monospace`);
      default:
        return _(msg`Sans`);
    }
  };

  const getFontTone = (family: ReaderFontFamily) => {
    switch (family) {
      case 'sans-serif':
        return _(msg`Clean and balanced`);
      case 'raleway':
        return _(msg`Refined and airy`);
      case 'system-ui':
        return _(msg`Native platform feel`);
      case 'humanist':
        return _(msg`Warm and friendly`);
      case 'serif':
        return _(msg`Classic reading`);
      case 'georgia':
        return _(msg`Strong newspaper tone`);
      case 'book-serif':
        return _(msg`Book-like rhythm`);
      case 'monospace':
        return _(msg`Code and precision`);
      default:
        return _(msg`Clean and balanced`);
    }
  };

  return (
    <Popover>
      <PopoverTrigger
        className={cn(
          buttonVariants({ variant: 'ghost', size: 'icon' }),
          'h-9 w-9 rounded-xl border border-transparent text-muted-foreground/90 hover:bg-accent/70 hover:text-foreground data-[state=open]:border-border/60 data-[state=open]:bg-accent/70 data-[state=open]:text-foreground'
        )}
        aria-label={_(msg`Reader typography settings`)}
      >
        <HugeiconsIcon icon={TextFontIcon} className="h-5 w-5" strokeWidth={2} />
      </PopoverTrigger>
      <PopoverContent className="w-80 space-y-4 rounded-2xl border-border/60 bg-popover/95 p-4 shadow-xl">
        <div className="space-y-1">
          <p className="text-sm font-semibold">{_(msg`Typography`)}</p>
          <p className="text-xs text-muted-foreground">
            {_(msg`Tune the reading layout for long-form comfort.`)}
          </p>
        </div>

        <div className="space-y-3 rounded-xl border border-border/60 bg-muted/20 p-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">{_(msg`Font Size`)}</span>
            <span className="rounded-md bg-background/80 px-2 py-0.5 text-xs text-muted-foreground">
              {fontSize}px
            </span>
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
            <HugeiconsIcon icon={PlusSignIcon} className="h-4 w-4 shrink-0 text-muted-foreground" />
          </div>
        </div>

        <Separator />

        <div className="space-y-3 rounded-xl border border-border/60 bg-muted/20 p-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">{_(msg`Line Width`)}</span>
            <span className="rounded-md bg-background/80 px-2 py-0.5 text-xs text-muted-foreground">
              {lineWidth}ch
            </span>
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

        <div className="space-y-3 rounded-xl border border-border/60 bg-muted/20 p-3">
          <span className="text-sm font-medium">{_(msg`Font Family`)}</span>
          <Select value={selectedFontFamily} onValueChange={(value) => setFontFamily(value)}>
            <SelectTrigger className="h-9 w-full bg-background/70">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="max-h-80">
              {readerFontFamilies.map((family) => (
                <SelectItem key={family} value={family}>
                  <span className="flex flex-col items-start gap-0.5 leading-tight">
                    <span style={{ fontFamily: getReaderFontStack(family) }}>
                      {getFontLabel(family)}
                    </span>
                    <span
                      className="text-[11px] text-muted-foreground"
                      style={{ fontFamily: getReaderFontStack(family) }}
                    >
                      {getFontTone(family)}
                    </span>
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="rounded-lg border border-dashed border-border/60 bg-background/70 px-3 py-2">
            <p className="text-[11px] uppercase tracking-[0.08em] text-muted-foreground">
              {_(msg`Preview`)}
            </p>
            <p
              className="mt-1 text-sm leading-7 text-foreground/90"
              style={{ fontFamily: getReaderFontStack(selectedFontFamily) }}
            >
              {_(msg`The quick brown fox jumps over the lazy dog.`)}
            </p>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
