# Reader Settings Pane Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a dedicated Reader pane to the preferences dialog exposing all 8 reader-related backend fields (typography, theme, features).

**Architecture:** New `ReaderPane.tsx` component following the same pattern as `GeneralPane` and `AppearancePane`. Uses `usePreferences()` + `useSavePreferences()` hooks with save-on-change. Theme swatches are clickable cards. Sliders use `onValueCommitted` for persistence (avoids saving on every drag pixel).

**Tech Stack:** React, Lingui i18n, base-ui Slider, shadcn Select/Switch, TanStack Query, Zustand

---

### Task 1: Register the Reader Pane in UI Store and Dialog

**Files:**
- Modify: `src/store/ui-store.ts:5-16` (add `'reader'` to PreferencesPane union)
- Modify: `src/components/preferences/PreferencesDialog.tsx:86-117` (add sidebar item + render)

**Step 1: Add `'reader'` to the PreferencesPane type**

In `src/store/ui-store.ts`, add `'reader'` to the union type after `'appearance'`:

```typescript
export type PreferencesPane =
  | 'general'
  | 'appearance'
  | 'reader'        // <-- ADD THIS
  | 'translation'
  | 'shortcuts'
  | 'advanced'
  | 'about'
  | 'categories'
  | 'feeds'
  | 'users'
  | 'token'
  | 'integrations';
```

**Step 2: Add sidebar item and pane rendering in PreferencesDialog**

In `src/components/preferences/PreferencesDialog.tsx`:

1. Add import at the top:
```typescript
import { Book01Icon } from '@hugeicons/core-free-icons';
import { ReaderPane } from './panes/ReaderPane';
```

2. Add to `appSettingsItems` array after appearance (line ~96):
```typescript
{
  id: 'reader' as const,
  label: msg`Reader`,
  icon: Book01Icon,
},
```

3. Add rendering in the pane switch area (after the appearance line ~606):
```typescript
{activePane === 'reader' && <ReaderPane />}
```

**Step 3: Verify TypeScript compiles**

Run: `bun run typecheck`
Expected: May fail because `ReaderPane` doesn't exist yet. That's OK, we'll create it next.

---

### Task 2: Create ReaderPane with Theme Swatches Section

**Files:**
- Create: `src/components/preferences/panes/ReaderPane.tsx`

**Step 1: Create the ReaderPane component with theme section**

Create `src/components/preferences/panes/ReaderPane.tsx`:

```tsx
import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { showToast } from '@/components/ui/sonner';
import { logger } from '@/lib/logger';
import { usePreferences, useSavePreferences } from '@/services/preferences';
import { SettingsField, SettingsSection } from '../shared/SettingsComponents';

const READER_THEMES = [
  { id: 'default', bg: 'bg-white dark:bg-zinc-900', text: 'text-zinc-900 dark:text-zinc-100', border: 'border-zinc-200 dark:border-zinc-700' },
  { id: 'paper', bg: 'bg-stone-50 dark:bg-stone-900', text: 'text-stone-900 dark:text-stone-100', border: 'border-stone-200 dark:border-stone-700' },
  { id: 'sepia', bg: 'bg-amber-50 dark:bg-amber-950', text: 'text-amber-950 dark:text-amber-100', border: 'border-amber-200 dark:border-amber-800' },
  { id: 'slate', bg: 'bg-slate-200 dark:bg-slate-800', text: 'text-slate-800 dark:text-slate-200', border: 'border-slate-300 dark:border-slate-600' },
  { id: 'oled', bg: 'bg-black', text: 'text-zinc-300', border: 'border-zinc-800' },
] as const;

// Labels must be inside component to use useLingui
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

export function ReaderPane() {
  const { _ } = useLingui();
  const { data: preferences } = usePreferences();
  const savePreferences = useSavePreferences();
  const themeLabels = useThemeLabels();

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

  const currentTheme = preferences?.reader_theme ?? 'default';

  return (
    <div className="space-y-6">
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
                <div
                  className={`flex h-12 w-full flex-col gap-1 rounded p-1.5 ${theme.bg}`}
                >
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
    </div>
  );
}
```

**Step 2: Verify TypeScript compiles**

Run: `bun run typecheck`
Expected: PASS

**Step 3: Commit**

```
feat(preferences): Add Reader pane with theme swatches
```

---

### Task 3: Add Typography Section (Font Family + Sliders)

**Files:**
- Modify: `src/components/preferences/panes/ReaderPane.tsx`

**Step 1: Add imports for Slider, Select, Input, Label**

Add to the top of `ReaderPane.tsx`:

```tsx
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
```

**Step 2: Add font family options constant and label hook**

Add above the component, after the theme constants:

```tsx
const FONT_FAMILIES = [
  { id: 'sans-serif' },
  { id: 'system-ui' },
  { id: 'humanist' },
  { id: 'serif' },
  { id: 'georgia' },
  { id: 'book-serif' },
  { id: 'monospace' },
] as const;

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
```

**Step 3: Add handler functions to the component**

Inside `ReaderPane`, add these handlers after `handleThemeChange`:

```tsx
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
```

**Step 4: Add Typography section JSX after the theme section**

Inside the return, after the `SettingsSection` for Reader Theme and before the closing `</div>`:

```tsx
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
          handleSliderCommit('reader_font_size', typeof value === 'number' ? value : value[0])
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
          handleSliderCommit('reader_line_width', typeof value === 'number' ? value : value[0])
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
          handleSliderCommit('reader_line_height', typeof value === 'number' ? value : value[0])
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
```

Also add `const fontFamilyLabels = useFontFamilyLabels();` near the top of the component alongside `themeLabels`.

**Step 5: Verify TypeScript compiles**

Run: `bun run typecheck`
Expected: PASS

**Step 6: Commit**

```
feat(preferences): Add typography settings to Reader pane
```

---

### Task 4: Add Code Theme and Reading Features Sections

**Files:**
- Modify: `src/components/preferences/panes/ReaderPane.tsx`

**Step 1: Add Switch import**

```tsx
import { Switch } from '@/components/animate-ui/components/base/switch';
```

**Step 2: Add handler functions**

Inside `ReaderPane`, add:

```tsx
const handleCodeThemeChange = async (value: string) => {
  if (!preferences) return;

  logger.info('Updating reader code theme', { codeTheme: value });

  try {
    await savePreferences.mutateAsync({
      ...preferences,
      // biome-ignore lint/style/useNamingConvention: preferences field name
      reader_code_theme: value,
    });
  } catch {
    logger.error('Failed to save reader code theme');
    showToast.error(_(msg`Failed to update code theme`));
  }
};

const handleToggle = async (
  field: 'reader_bionic_reading' | 'reader_status_bar',
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
```

**Step 3: Add Code Blocks section JSX**

After Typography section:

```tsx
<SettingsSection title={_(msg`Code Blocks`)}>
  <SettingsField
    label={_(msg`Syntax Theme`)}
    description={_(msg`Syntax highlighting theme for code blocks`)}
  >
    <Select
      value={preferences?.reader_code_theme ?? 'auto'}
      onValueChange={handleCodeThemeChange}
      disabled={!preferences || savePreferences.isPending}
    >
      <SelectTrigger>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="auto">{_(msg`Auto`)}</SelectItem>
      </SelectContent>
    </Select>
  </SettingsField>
</SettingsSection>
```

Note: The code theme dropdown currently has only "auto". This matches the backend default and the `validate_reader_code_theme` validator which accepts any string up to 64 chars. More themes can be added later when the reader's code block rendering supports them.

**Step 4: Add Reading Features section JSX**

After Code Blocks section:

```tsx
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
</SettingsSection>
```

**Step 5: Verify TypeScript compiles**

Run: `bun run typecheck`
Expected: PASS

**Step 6: Commit**

```
feat(preferences): Add code theme and reading features to Reader pane
```

---

### Task 5: Final Verification

**Step 1: Run full quality gates**

Run: `bun run check:all`
Expected: All checks pass (typecheck, clippy, cargo test, cargo fmt)

**Step 2: Extract i18n strings**

Run: `bun run i18n:extract && bun run i18n:compile`
Expected: New translation keys extracted for all Reader pane strings

**Step 3: Run dev server to verify**

Run: `bun run dev`
Expected: App launches. Open Preferences -> Reader pane visible between Appearance and AI. All controls render and respond to interaction.

**Step 4: Manual testing checklist**

- [ ] Theme swatches: clicking changes selection ring, persists on dialog close/reopen
- [ ] Font family dropdown: all 7 options listed, selection persists
- [ ] Font size slider: drags between 14-24, number input syncs, persists
- [ ] Line width slider: drags between 45-80, number input syncs, persists
- [ ] Line height slider: drags between 1.4-2.2 in 0.05 steps, input syncs, persists
- [ ] Code theme dropdown: "Auto" selected by default
- [ ] Bionic reading toggle: switches on/off, label updates, persists
- [ ] Status bar toggle: switches on/off, label updates, persists
- [ ] All controls disabled during save (isPending state)
- [ ] Error toast shown on save failure

**Step 5: Commit final state**

```
feat(preferences): Complete Reader settings pane
```
