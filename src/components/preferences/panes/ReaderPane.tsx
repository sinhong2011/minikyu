import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { Switch } from '@/components/animate-ui/components/base/switch';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { showToast } from '@/components/ui/sonner';
import { Textarea } from '@/components/ui/textarea';
import { logger } from '@/lib/logger';
import {
  normalizeReaderCodeTheme,
  type ReaderCodeTheme,
  readerCodeThemeOptions,
} from '@/lib/shiki-highlight';
import { usePreferences, useSavePreferences } from '@/services/preferences';
import { SettingsField, SettingsSection } from '../shared/SettingsComponents';

const READER_THEMES = [
  {
    id: 'default',
    bg: 'bg-white dark:bg-zinc-900',
    text: 'text-zinc-900 dark:text-zinc-100',
    border: 'border-zinc-200 dark:border-zinc-700',
  },
  {
    id: 'paper',
    bg: 'bg-stone-50 dark:bg-stone-900',
    text: 'text-stone-900 dark:text-stone-100',
    border: 'border-stone-200 dark:border-stone-700',
  },
  {
    id: 'sepia',
    bg: 'bg-amber-50 dark:bg-amber-950',
    text: 'text-amber-950 dark:text-amber-100',
    border: 'border-amber-200 dark:border-amber-800',
  },
  {
    id: 'slate',
    bg: 'bg-slate-200 dark:bg-slate-800',
    text: 'text-slate-800 dark:text-slate-200',
    border: 'border-slate-300 dark:border-slate-600',
  },
  { id: 'oled', bg: 'bg-black', text: 'text-zinc-300', border: 'border-zinc-800' },
] as const;

const FONT_FAMILIES = [
  { id: 'sans-serif' },
  { id: 'system-ui' },
  { id: 'humanist' },
  { id: 'serif' },
  { id: 'georgia' },
  { id: 'book-serif' },
  { id: 'monospace' },
] as const;

function useThemeLabels() {
  const { _ } = useLingui();
  return {
    default: _(msg`Default`),
    paper: _(msg`Paper`),
    sepia: _(msg`Sepia`),
    slate: _(msg`Slate`),
    oled: _(msg`OLED`),
  } as Record<string, string>;
}

function useFontFamilyLabels() {
  const { _ } = useLingui();
  return {
    'sans-serif': _(msg`Sans Serif`),
    'system-ui': _(msg`System UI`),
    humanist: _(msg`Humanist`),
    serif: _(msg`Serif`),
    georgia: _(msg`Georgia`),
    'book-serif': _(msg`Book Serif`),
    monospace: _(msg`Monospace`),
  } as Record<string, string>;
}

export function ReaderPane() {
  const { _ } = useLingui();
  const { data: preferences } = usePreferences();
  const savePreferences = useSavePreferences();
  const themeLabels = useThemeLabels();
  const fontFamilyLabels = useFontFamilyLabels();

  const handleThemeChange = async (themeId: string) => {
    if (!preferences) return;

    logger.info('Updating reader theme', { theme: themeId });

    try {
      await savePreferences.mutateAsync({
        ...preferences,
        // biome-ignore lint/style/useNamingConvention: preferences field name
        reader_theme: themeId,
      });
    } catch {
      logger.error('Failed to save reader theme');
      showToast.error(_(msg`Failed to update reader theme`));
    }
  };

  const handleFontFamilyChange = async (value: string) => {
    if (!preferences) return;

    logger.info('Updating reader font family', { fontFamily: value });

    try {
      await savePreferences.mutateAsync({
        ...preferences,
        // biome-ignore lint/style/useNamingConvention: preferences field name
        reader_font_family: value,
      });
    } catch {
      logger.error('Failed to save reader font family');
      showToast.error(_(msg`Failed to update font family`));
    }
  };

  const handleSliderCommit = async (
    field: 'reader_font_size' | 'reader_line_width' | 'reader_line_height',
    value: number
  ) => {
    if (!preferences) return;

    logger.info(`Updating ${field}`, { value });

    try {
      await savePreferences.mutateAsync({
        ...preferences,
        [field]: value,
      });
    } catch {
      logger.error(`Failed to save ${field}`);
      showToast.error(_(msg`Failed to update reader settings`));
    }
  };

  const handleCodeThemeChange = async (value: string) => {
    if (!preferences) return;

    const normalized = normalizeReaderCodeTheme(value);
    logger.info('Updating reader code theme', { codeTheme: normalized });

    try {
      await savePreferences.mutateAsync({
        ...preferences,
        // biome-ignore lint/style/useNamingConvention: preferences field name
        reader_code_theme: normalized,
      });
    } catch {
      logger.error('Failed to save reader code theme');
      showToast.error(_(msg`Failed to update code theme`));
    }
  };

  const formatCodeThemeLabel = (theme: ReaderCodeTheme) => {
    if (theme === 'auto') return _(msg`Auto`);
    return theme
      .split('-')
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ');
  };

  const handleToggle = async (
    field: 'reader_bionic_reading' | 'reader_status_bar' | 'reader_auto_mark_read',
    checked: boolean
  ) => {
    if (!preferences) return;

    logger.info(`Updating ${field}`, { value: checked });

    try {
      await savePreferences.mutateAsync({
        ...preferences,
        [field]: checked,
      });
    } catch {
      logger.error(`Failed to save ${field}`);
      showToast.error(_(msg`Failed to update setting`));
    }
  };

  const currentTheme = preferences?.reader_theme ?? 'default';

  return (
    <div className="space-y-6">
      {/* Reader Theme */}
      <SettingsSection title={_(msg`Reader Theme`)}>
        <SettingsField
          label={_(msg`Surface Theme`)}
          description={_(msg`Choose the background surface for the article reader`)}
        >
          <div className="flex flex-wrap gap-3">
            {READER_THEMES.map((theme) => (
              <button
                key={theme.id}
                type="button"
                onClick={() => handleThemeChange(theme.id)}
                disabled={!preferences || savePreferences.isPending}
                className={`flex w-20 flex-col items-center gap-1.5 rounded-lg border-2 p-2 transition-colors disabled:opacity-50 ${
                  currentTheme === theme.id
                    ? 'border-primary ring-primary/20 ring-2'
                    : `${theme.border} hover:border-primary/50`
                }`}
              >
                <div className={`flex h-12 w-full flex-col gap-1 rounded p-1.5 ${theme.bg}`}>
                  <div className={`h-1 w-10 rounded-full ${theme.text} opacity-60 bg-current`} />
                  <div className={`h-1 w-8 rounded-full ${theme.text} opacity-40 bg-current`} />
                  <div className={`h-1 w-11 rounded-full ${theme.text} opacity-60 bg-current`} />
                  <div className={`h-1 w-6 rounded-full ${theme.text} opacity-40 bg-current`} />
                </div>
                <span className="text-xs font-medium">{themeLabels[theme.id]}</span>
              </button>
            ))}
          </div>
        </SettingsField>
      </SettingsSection>

      {/* Typography */}
      <SettingsSection title={_(msg`Typography`)}>
        <SettingsField
          label={_(msg`Font Family`)}
          description={_(msg`Choose the typeface for article text`)}
        >
          <Select
            value={preferences?.reader_font_family ?? 'sans-serif'}
            onValueChange={handleFontFamilyChange}
            disabled={!preferences || savePreferences.isPending}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {FONT_FAMILIES.map((font) => (
                <SelectItem key={font.id} value={font.id}>
                  {fontFamilyLabels[font.id]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </SettingsField>

        <SettingsField
          label={_(msg`Font Size`)}
          description={_(msg`Article text size in pixels (14-24)`)}
        >
          <div className="flex items-center gap-4">
            <Slider
              className="flex-1"
              min={14}
              max={24}
              step={1}
              value={preferences?.reader_font_size ?? 16}
              onValueCommitted={(value) =>
                handleSliderCommit(
                  'reader_font_size',
                  typeof value === 'number' ? value : (value[0] ?? 16)
                )
              }
              disabled={!preferences || savePreferences.isPending}
            />
            <div className="flex items-center gap-1">
              <Input
                type="number"
                min={14}
                max={24}
                step={1}
                value={preferences?.reader_font_size ?? 16}
                onChange={(e) => {
                  const val = Number.parseInt(e.target.value, 10);
                  if (val >= 14 && val <= 24) {
                    handleSliderCommit('reader_font_size', val);
                  }
                }}
                className="w-16 text-center"
                disabled={!preferences || savePreferences.isPending}
              />
              <Label className="text-sm text-muted-foreground">px</Label>
            </div>
          </div>
        </SettingsField>

        <SettingsField
          label={_(msg`Line Width`)}
          description={_(msg`Maximum width of article text in characters (45-80)`)}
        >
          <div className="flex items-center gap-4">
            <Slider
              className="flex-1"
              min={45}
              max={80}
              step={1}
              value={preferences?.reader_line_width ?? 65}
              onValueCommitted={(value) =>
                handleSliderCommit(
                  'reader_line_width',
                  typeof value === 'number' ? value : (value[0] ?? 65)
                )
              }
              disabled={!preferences || savePreferences.isPending}
            />
            <div className="flex items-center gap-1">
              <Input
                type="number"
                min={45}
                max={80}
                step={1}
                value={preferences?.reader_line_width ?? 65}
                onChange={(e) => {
                  const val = Number.parseInt(e.target.value, 10);
                  if (val >= 45 && val <= 80) {
                    handleSliderCommit('reader_line_width', val);
                  }
                }}
                className="w-16 text-center"
                disabled={!preferences || savePreferences.isPending}
              />
              <Label className="text-sm text-muted-foreground">ch</Label>
            </div>
          </div>
        </SettingsField>

        <SettingsField
          label={_(msg`Line Height`)}
          description={_(msg`Spacing between lines of text (1.4-2.2)`)}
        >
          <div className="flex items-center gap-4">
            <Slider
              className="flex-1"
              min={1.4}
              max={2.2}
              step={0.05}
              value={preferences?.reader_line_height ?? 1.75}
              onValueCommitted={(value) =>
                handleSliderCommit(
                  'reader_line_height',
                  typeof value === 'number' ? value : (value[0] ?? 1.75)
                )
              }
              disabled={!preferences || savePreferences.isPending}
            />
            <Input
              type="number"
              min={1.4}
              max={2.2}
              step={0.05}
              value={preferences?.reader_line_height ?? 1.75}
              onChange={(e) => {
                const val = Number.parseFloat(e.target.value);
                if (val >= 1.4 && val <= 2.2) {
                  handleSliderCommit('reader_line_height', val);
                }
              }}
              className="w-16 text-center"
              disabled={!preferences || savePreferences.isPending}
            />
          </div>
        </SettingsField>
      </SettingsSection>

      {/* Code Blocks */}
      <SettingsSection title={_(msg`Code Blocks`)}>
        <SettingsField
          label={_(msg`Code theme`)}
          description={_(msg`Syntax highlighting theme for code blocks`)}
        >
          <Select
            value={normalizeReaderCodeTheme(preferences?.reader_code_theme)}
            onValueChange={handleCodeThemeChange}
            disabled={!preferences || savePreferences.isPending}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {readerCodeThemeOptions.map((themeOption) => (
                <SelectItem key={themeOption} value={themeOption}>
                  {formatCodeThemeLabel(themeOption)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </SettingsField>
        <SettingsField
          label={_(msg`Language detection`)}
          description={_(msg`How code block languages are detected for syntax highlighting`)}
        >
          <Select
            value={preferences?.reader_code_detection_mode ?? 'auto'}
            onValueChange={async (value) => {
              if (!preferences) return;
              try {
                await savePreferences.mutateAsync({
                  ...preferences,
                  // biome-ignore lint/style/useNamingConvention: preferences field name
                  reader_code_detection_mode: value,
                });
              } catch {
                showToast.error(_(msg`Failed to update setting`));
              }
            }}
            disabled={!preferences || savePreferences.isPending}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="auto">{_(msg`Auto (LLM + regex)`)}</SelectItem>
              <SelectItem value="regex">{_(msg`Regex only`)}</SelectItem>
            </SelectContent>
          </Select>
        </SettingsField>
        <SettingsField
          label={_(msg`Detection prompt`)}
          description={_(
            msg`Custom prompt for LLM code language detection. Leave empty to use default.`
          )}
        >
          <Textarea
            value={preferences?.reader_code_detection_prompt ?? ''}
            onChange={(e) => {
              if (preferences) {
                savePreferences.mutate({
                  ...preferences,
                  // biome-ignore lint/style/useNamingConvention: preferences field name
                  reader_code_detection_prompt: e.target.value || null,
                });
              }
            }}
            placeholder="You are a programming language identifier. Given a code snippet, respond with ONLY the programming language name in lowercase. For example: rust, python, javascript, typescript, c, cpp, go, java, etc. If you cannot identify the language, respond with: text Do not include any other text, explanation, or formatting."
            rows={3}
            className="text-xs"
            disabled={
              !preferences ||
              savePreferences.isPending ||
              (preferences?.reader_code_detection_mode ?? 'auto') !== 'auto'
            }
          />
        </SettingsField>
      </SettingsSection>

      {/* Reading Features */}
      <SettingsSection title={_(msg`Reading Features`)}>
        <SettingsField
          label={_(msg`Bionic Reading`)}
          description={_(msg`Emphasize the beginning of words to guide faster reading`)}
        >
          <div className="flex items-center space-x-2">
            <Switch
              id="bionic-reading"
              checked={preferences?.reader_bionic_reading ?? false}
              onCheckedChange={(checked) => handleToggle('reader_bionic_reading', checked)}
              disabled={!preferences || savePreferences.isPending}
            />
            <Label htmlFor="bionic-reading" className="text-sm">
              {(preferences?.reader_bionic_reading ?? false) ? _(msg`Enabled`) : _(msg`Disabled`)}
            </Label>
          </div>
        </SettingsField>

        <SettingsField
          label={_(msg`Status Bar`)}
          description={_(msg`Show a compact reading progress bar at the bottom of the reader`)}
        >
          <div className="flex items-center space-x-2">
            <Switch
              id="status-bar"
              checked={preferences?.reader_status_bar ?? false}
              onCheckedChange={(checked) => handleToggle('reader_status_bar', checked)}
              disabled={!preferences || savePreferences.isPending}
            />
            <Label htmlFor="status-bar" className="text-sm">
              {(preferences?.reader_status_bar ?? false) ? _(msg`Enabled`) : _(msg`Disabled`)}
            </Label>
          </div>
        </SettingsField>

        <SettingsField
          label={_(msg`Auto mark as read`)}
          description={_(msg`Automatically mark entries as read when scrolled past 20%`)}
        >
          <div className="flex items-center space-x-2">
            <Switch
              id="auto-mark-read"
              checked={preferences?.reader_auto_mark_read ?? false}
              onCheckedChange={(checked) => handleToggle('reader_auto_mark_read', checked)}
              disabled={!preferences || savePreferences.isPending}
            />
            <Label htmlFor="auto-mark-read" className="text-sm">
              {(preferences?.reader_auto_mark_read ?? false) ? _(msg`Enabled`) : _(msg`Disabled`)}
            </Label>
          </div>
        </SettingsField>
      </SettingsSection>
    </div>
  );
}
