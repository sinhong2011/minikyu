# Reader Settings Pane Design

## Problem

The `AppPreferences` backend struct has 8 reader-related fields with full validation, but zero UI controls exist to modify them. Users cannot customize their reading experience (font, spacing, theme, features).

## Solution

Add a dedicated **Reader** pane to the preferences dialog between Appearance and AI.

## Pane Structure

### Sidebar Position

```
App Settings
  General
  Appearance
  Reader        <- NEW
  AI
  Shortcuts
  Advanced
  About
```

### Section 1: Reader Theme

Visual swatch cards in a horizontal row. Each card previews the theme's background and text colors. Active card highlighted with a ring border.

Themes: default, paper, sepia, slate, oled

Maps to: `reader_theme` (string, validated against whitelist)

### Section 2: Typography

- **Font Family** - Select dropdown with 7 options: sans-serif, system-ui, humanist, serif, georgia, book-serif, monospace
- **Font Size** - Slider + numeric input, range 14-24 px
- **Line Width** - Slider + numeric input, range 45-80 ch
- **Line Height** - Slider + numeric input, range 1.4-2.2, step 0.05

Maps to: `reader_font_family`, `reader_font_size`, `reader_line_width`, `reader_line_height`

### Section 3: Code Blocks

- **Code Theme** - Select dropdown for syntax highlighting theme identifier

Maps to: `reader_code_theme` (string, max 64 chars)

### Section 4: Reading Features

- **Bionic Reading** - Toggle switch. Emphasize word beginnings for faster reading.
- **Status Bar** - Toggle switch. Show compact reading progress bar.

Maps to: `reader_bionic_reading`, `reader_status_bar`

## Technical Approach

### Files to Create

- `src/components/preferences/panes/ReaderPane.tsx` - New pane component

### Files to Modify

- `src/store/ui-store.ts` - Add `'reader'` to `PreferencesPane` union type
- `src/components/preferences/PreferencesDialog.tsx` - Add sidebar item, import, and render
- `src/services/preferences.ts` - Ensure defaults cover all 8 reader fields

### No Backend Changes

All 8 fields already exist in `AppPreferences` with validation:
- `validate_reader_settings()` - font size, line width, line height, font family
- `validate_reader_theme()` - whitelist of 5 themes
- `validate_reader_code_theme()` - max 64 char identifier

### Pattern

Same as existing panes:
- `usePreferences()` + `useSavePreferences()` hooks
- `SettingsSection` / `SettingsField` shared components
- Save on change (no explicit save button), consistent with AppearancePane
- All strings use `msg` macro + `useLingui` for i18n
- Inputs disabled during `isPending` state

### UI Components Needed

- Slider component (check if exists in ui library, may need shadcn/ui Slider)
- Theme swatch cards (custom, small clickable cards with color preview)
- Standard Select, Switch from existing ui components
