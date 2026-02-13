import {
  Cancel01Icon,
  MinusSignIcon,
  PlusSignIcon,
  TextFontIcon,
  TextIcon,
} from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react';
import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from '@/components/ui/combobox';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Slider } from '@/components/ui/slider';
import { useReaderSettings } from '@/hooks/use-reader-settings';
import {
  getReaderFontStack,
  normalizeReaderFontFamily,
  type ReaderFontFamily,
  readerFontFamilies,
} from '@/lib/reader-fonts';

const MIN_FONT_SIZE = 14;
const MAX_FONT_SIZE = 24;
const MIN_LINE_WIDTH = 45;
const MAX_LINE_WIDTH = 80;
const MIN_LINE_HEIGHT = 1.4;
const MAX_LINE_HEIGHT = 2.2;
const LINE_HEIGHT_STEP = 0.05;
const DEFAULT_FONT_SIZE = 16;
const DEFAULT_LINE_WIDTH = 65;
const DEFAULT_LINE_HEIGHT = 1.75;
const DEFAULT_FONT_FAMILY = 'sans-serif';

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

function roundToStep(value: number, step: number) {
  return Math.round(value / step) * step;
}

function normalizeLineHeightValue(value: number) {
  const rounded = roundToStep(value, LINE_HEIGHT_STEP);
  return Number(rounded.toFixed(2));
}

export function ReaderSettings() {
  const { _ } = useLingui();
  const {
    fontSize,
    setFontSize,
    lineWidth,
    setLineWidth,
    lineHeight,
    setLineHeight,
    fontFamily,
    setFontFamily,
    resetReaderTypography,
    isLoading,
  } = useReaderSettings();
  const selectedFontFamily = normalizeReaderFontFamily(fontFamily);
  const [fontSizeValue, setFontSizeValue] = useState(fontSize);
  const [lineWidthValue, setLineWidthValue] = useState(lineWidth);
  const [lineHeightValue, setLineHeightValue] = useState(lineHeight);
  const [open, setOpen] = useState(false);
  const [fontSizeInput, setFontSizeInput] = useState(String(fontSize));
  const [lineWidthInput, setLineWidthInput] = useState(String(lineWidth));
  const [lineHeightInput, setLineHeightInput] = useState(lineHeight.toFixed(2));

  useEffect(() => {
    setFontSizeValue(fontSize);
    setFontSizeInput(String(fontSize));
  }, [fontSize]);

  useEffect(() => {
    setLineWidthValue(lineWidth);
    setLineWidthInput(String(lineWidth));
  }, [lineWidth]);

  useEffect(() => {
    const normalizedLineHeight = normalizeLineHeightValue(lineHeight);
    setLineHeightValue(normalizedLineHeight);
    setLineHeightInput(normalizedLineHeight.toFixed(2));
  }, [lineHeight]);

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

  const commitLineHeight = (nextValue: number) => {
    const normalizedValue = normalizeLineHeightValue(
      clamp(nextValue, MIN_LINE_HEIGHT, MAX_LINE_HEIGHT)
    );
    setLineHeightValue(normalizedValue);
    setLineHeightInput(normalizedValue.toFixed(2));
    if (normalizedValue !== lineHeight) {
      setLineHeight(normalizedValue);
    }
  };

  const getFontLabel = (family: ReaderFontFamily) => {
    switch (family) {
      case 'sans-serif':
        return _(msg`Sans`);
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

  const typographyIsDefault =
    fontSize === DEFAULT_FONT_SIZE &&
    lineWidth === DEFAULT_LINE_WIDTH &&
    lineHeight === DEFAULT_LINE_HEIGHT &&
    selectedFontFamily === DEFAULT_FONT_FAMILY;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-9 w-9 rounded-xl border border-transparent text-muted-foreground/90 hover:bg-accent/70 hover:text-muted-foreground"
        aria-label={_(msg`Reader typography settings`)}
        onClick={() => setOpen(true)}
      >
        <HugeiconsIcon icon={TextFontIcon} className="h-5 w-5" strokeWidth={2} />
      </Button>
      <DialogContent
        showCloseButton={false}
        className="w-[min(30rem,calc(100%-1.5rem))] max-h-[76vh] overflow-hidden rounded-2xl border-border/60 bg-popover/95 p-0 shadow-xl sm:max-w-[30rem]"
      >
        <DialogHeader className="space-y-0.5 px-3.5 pt-3 pb-0">
          <div className="flex items-center justify-between gap-2">
            <DialogTitle className="text-sm font-semibold">{_(msg`Typography`)}</DialogTitle>
            <div className="flex items-center gap-1">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs"
                disabled={isLoading || typographyIsDefault}
                onClick={resetReaderTypography}
              >
                {_(msg`Reset`)}
              </Button>
              <DialogClose
                render={
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 rounded-full text-muted-foreground hover:bg-accent/70 hover:text-muted-foreground"
                    aria-label={_(msg`Close`)}
                  />
                }
              >
                <HugeiconsIcon icon={Cancel01Icon} className="h-4 w-4" strokeWidth={2} />
              </DialogClose>
            </div>
          </div>
          <DialogDescription className="text-[11px] leading-snug text-muted-foreground">
            {_(msg`Tune the reading layout for long-form comfort.`)}
          </DialogDescription>
          <p className="text-[10px] text-muted-foreground/80">
            {_(msg`Tips: +/- font size, [ ] line width, Alt+↑/↓ line height`)}
          </p>
        </DialogHeader>

        <div className="max-h-[calc(76vh-74px)] overflow-y-auto px-3.5 py-3">
          <div className="overflow-hidden rounded-lg border border-border/60 bg-muted/20">
            <div className="grid grid-cols-[8.5rem_minmax(0,1fr)] gap-3 border-b border-border/60 px-3 py-2.5">
              <p className="pt-1 text-[12px] font-medium text-muted-foreground">
                {_(msg`Font Size`)}
              </p>
              <div className="space-y-2">
                <div className="flex items-center justify-end gap-2">
                  <Input
                    type="number"
                    min={MIN_FONT_SIZE}
                    max={MAX_FONT_SIZE}
                    step={1}
                    inputMode="numeric"
                    className="h-7 w-[4.5rem] bg-background/80 px-2 text-right text-xs tabular-nums"
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
                  <span className="w-5 text-xs text-muted-foreground">px</span>
                </div>
                <div className="flex items-center gap-2.5">
                  <HugeiconsIcon
                    icon={MinusSignIcon}
                    className="h-3.5 w-3.5 text-muted-foreground"
                  />
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
                  <HugeiconsIcon
                    icon={PlusSignIcon}
                    className="h-3.5 w-3.5 shrink-0 text-muted-foreground"
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-[8.5rem_minmax(0,1fr)] gap-3 border-b border-border/60 px-3 py-2.5">
              <p className="pt-1 text-[12px] font-medium text-muted-foreground">
                {_(msg`Line Width`)}
              </p>
              <div className="space-y-2">
                <div className="flex items-center justify-end gap-2">
                  <Input
                    type="number"
                    min={MIN_LINE_WIDTH}
                    max={MAX_LINE_WIDTH}
                    step={1}
                    inputMode="numeric"
                    className="h-7 w-[4.5rem] bg-background/80 px-2 text-right text-xs tabular-nums"
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
                  <span className="w-5 text-xs text-muted-foreground">ch</span>
                </div>
                <div className="flex items-center gap-2.5">
                  <HugeiconsIcon icon={TextIcon} className="h-4 w-4" strokeWidth={2} />
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
                  <HugeiconsIcon
                    icon={TextIcon}
                    className="h-3.5 w-3.5 shrink-0 text-muted-foreground"
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-[8.5rem_minmax(0,1fr)] gap-3 border-b border-border/60 px-3 py-2.5">
              <p className="pt-1 text-[12px] font-medium text-muted-foreground">
                {_(msg`Line Height`)}
              </p>
              <div className="space-y-2">
                <div className="flex items-center justify-end gap-2">
                  <Input
                    type="number"
                    min={MIN_LINE_HEIGHT}
                    max={MAX_LINE_HEIGHT}
                    step={LINE_HEIGHT_STEP}
                    inputMode="decimal"
                    className="h-7 w-[4.5rem] bg-background/80 px-2 text-right text-xs tabular-nums"
                    aria-label={_(msg`Line Height`)}
                    value={lineHeightInput}
                    onChange={(event) => setLineHeightInput(event.target.value)}
                    onBlur={() => {
                      const parsedValue = Number.parseFloat(lineHeightInput);
                      if (Number.isNaN(parsedValue)) {
                        setLineHeightInput(lineHeightValue.toFixed(2));
                        return;
                      }
                      commitLineHeight(parsedValue);
                    }}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') {
                        event.currentTarget.blur();
                      }
                      if (event.key === 'Escape') {
                        setLineHeightInput(lineHeightValue.toFixed(2));
                        event.currentTarget.blur();
                      }
                    }}
                    disabled={isLoading}
                  />
                  <span className="w-5 text-xs text-muted-foreground">x</span>
                </div>
                <div className="flex items-center gap-2.5">
                  <HugeiconsIcon
                    icon={MinusSignIcon}
                    className="h-3.5 w-3.5 text-muted-foreground"
                  />
                  <Slider
                    className="flex-1"
                    value={lineHeightValue}
                    min={MIN_LINE_HEIGHT}
                    max={MAX_LINE_HEIGHT}
                    step={LINE_HEIGHT_STEP}
                    disabled={isLoading}
                    onValueChange={(val) => {
                      const nextValue = normalizeLineHeightValue(
                        clamp(normalizeSliderValue(val), MIN_LINE_HEIGHT, MAX_LINE_HEIGHT)
                      );
                      setLineHeightValue(nextValue);
                      setLineHeightInput(nextValue.toFixed(2));
                    }}
                    onValueCommitted={(val) => {
                      commitLineHeight(normalizeSliderValue(val));
                    }}
                  />
                  <HugeiconsIcon
                    icon={PlusSignIcon}
                    className="h-3.5 w-3.5 shrink-0 text-muted-foreground"
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-[8.5rem_minmax(0,1fr)] items-center gap-3 border-b border-border/60 px-3 py-2.5">
              <p className="text-[12px] font-medium text-muted-foreground">{_(msg`Font Family`)}</p>
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
                  className="h-8 w-full bg-background/70 text-xs"
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
        </div>
      </DialogContent>
    </Dialog>
  );
}
