import { MinusSignIcon, PlusSignIcon, TextFontIcon, TextIcon } from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react';
import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { useEffect, useState } from 'react';
import { buttonVariants } from '@/components/ui/button';
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from '@/components/ui/combobox';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
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

const MIN_FONT_SIZE = 14;
const MAX_FONT_SIZE = 24;
const MIN_LINE_WIDTH = 45;
const MAX_LINE_WIDTH = 80;

type SliderValue = number | readonly number[];

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function normalizeSliderValue(value: SliderValue) {
  if (Array.isArray(value)) {
    return Number(value[0] ?? 0);
  }
  return Number(value);
}

export function ReaderSettings() {
  const { _ } = useLingui();
  const { fontSize, setFontSize, lineWidth, setLineWidth, fontFamily, setFontFamily, isLoading } =
    useReaderSettings();
  const selectedFontFamily = normalizeReaderFontFamily(fontFamily);
  const [fontSizeValue, setFontSizeValue] = useState(fontSize);
  const [lineWidthValue, setLineWidthValue] = useState(lineWidth);
  const [fontSizeInput, setFontSizeInput] = useState(String(fontSize));
  const [lineWidthInput, setLineWidthInput] = useState(String(lineWidth));

  useEffect(() => {
    setFontSizeValue(fontSize);
    setFontSizeInput(String(fontSize));
  }, [fontSize]);

  useEffect(() => {
    setLineWidthValue(lineWidth);
    setLineWidthInput(String(lineWidth));
  }, [lineWidth]);

  const commitFontSize = (nextValue: number) => {
    const normalizedValue = clamp(Math.round(nextValue), MIN_FONT_SIZE, MAX_FONT_SIZE);
    setFontSizeValue(normalizedValue);
    setFontSizeInput(String(normalizedValue));
    if (normalizedValue !== fontSize) {
      setFontSize(normalizedValue);
    }
  };

  const commitLineWidth = (nextValue: number) => {
    const normalizedValue = clamp(Math.round(nextValue), MIN_LINE_WIDTH, MAX_LINE_WIDTH);
    setLineWidthValue(normalizedValue);
    setLineWidthInput(String(normalizedValue));
    if (normalizedValue !== lineWidth) {
      setLineWidth(normalizedValue);
    }
  };

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
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm font-medium">{_(msg`Font Size`)}</span>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                min={MIN_FONT_SIZE}
                max={MAX_FONT_SIZE}
                step={1}
                inputMode="numeric"
                className="h-8 w-20 bg-background/80 px-2 text-right text-xs tabular-nums"
                aria-label={_(msg`Font Size`)}
                value={fontSizeInput}
                onChange={(event) => setFontSizeInput(event.target.value)}
                onBlur={() => {
                  const parsedValue = Number(fontSizeInput);
                  if (Number.isNaN(parsedValue)) {
                    setFontSizeInput(String(fontSizeValue));
                    return;
                  }
                  commitFontSize(parsedValue);
                }}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.currentTarget.blur();
                  }
                  if (event.key === 'Escape') {
                    setFontSizeInput(String(fontSizeValue));
                    event.currentTarget.blur();
                  }
                }}
                disabled={isLoading}
              />
              <span className="text-xs text-muted-foreground">px</span>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <HugeiconsIcon icon={MinusSignIcon} className="h-4 w-4 text-muted-foreground" />
            <Slider
              className="flex-1"
              value={fontSizeValue}
              min={MIN_FONT_SIZE}
              max={MAX_FONT_SIZE}
              step={1}
              disabled={isLoading}
              onValueChange={(val) => {
                const nextValue = clamp(
                  Math.round(normalizeSliderValue(val)),
                  MIN_FONT_SIZE,
                  MAX_FONT_SIZE
                );
                setFontSizeValue(nextValue);
                setFontSizeInput(String(nextValue));
              }}
              onValueCommitted={(val) => {
                commitFontSize(normalizeSliderValue(val));
              }}
            />
            <HugeiconsIcon icon={PlusSignIcon} className="h-4 w-4 shrink-0 text-muted-foreground" />
          </div>
        </div>

        <Separator />

        <div className="space-y-3 rounded-xl border border-border/60 bg-muted/20 p-3">
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm font-medium">{_(msg`Line Width`)}</span>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                min={MIN_LINE_WIDTH}
                max={MAX_LINE_WIDTH}
                step={1}
                inputMode="numeric"
                className="h-8 w-20 bg-background/80 px-2 text-right text-xs tabular-nums"
                aria-label={_(msg`Line Width`)}
                value={lineWidthInput}
                onChange={(event) => setLineWidthInput(event.target.value)}
                onBlur={() => {
                  const parsedValue = Number(lineWidthInput);
                  if (Number.isNaN(parsedValue)) {
                    setLineWidthInput(String(lineWidthValue));
                    return;
                  }
                  commitLineWidth(parsedValue);
                }}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.currentTarget.blur();
                  }
                  if (event.key === 'Escape') {
                    setLineWidthInput(String(lineWidthValue));
                    event.currentTarget.blur();
                  }
                }}
                disabled={isLoading}
              />
              <span className="text-xs text-muted-foreground">ch</span>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <HugeiconsIcon icon={TextIcon} className="h-5 w-5" strokeWidth={2} />
            <Slider
              className="flex-1"
              value={lineWidthValue}
              min={MIN_LINE_WIDTH}
              max={MAX_LINE_WIDTH}
              step={1}
              disabled={isLoading}
              onValueChange={(val) => {
                const nextValue = clamp(
                  Math.round(normalizeSliderValue(val)),
                  MIN_LINE_WIDTH,
                  MAX_LINE_WIDTH
                );
                setLineWidthValue(nextValue);
                setLineWidthInput(String(nextValue));
              }}
              onValueCommitted={(val) => {
                commitLineWidth(normalizeSliderValue(val));
              }}
            />
            <HugeiconsIcon icon={TextIcon} className="h-4 w-4 text-muted-foreground shrink-0" />
          </div>
        </div>

        <Separator />

        <div className="space-y-3 rounded-xl border border-border/60 bg-muted/20 p-3">
          <span className="text-sm font-medium">{_(msg`Font Family`)}</span>
          <div className="pt-1">
            <Combobox
              value={selectedFontFamily}
              onValueChange={(value) => {
                if (value && typeof value === 'string') {
                  setFontFamily(value);
                }
              }}
              disabled={isLoading}
            >
              <ComboboxInput
                placeholder={_(msg`Search fonts...`)}
                className="w-full bg-background/70"
              />
              <ComboboxContent>
                <ComboboxList>
                  <ComboboxEmpty>{_(msg`No fonts found.`)}</ComboboxEmpty>
                  {readerFontFamilies.map((family) => (
                    <ComboboxItem key={family} value={family}>
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
                    </ComboboxItem>
                  ))}
                </ComboboxList>
              </ComboboxContent>
            </Combobox>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
