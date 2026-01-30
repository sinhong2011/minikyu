# Internationalization (i18n)

## Overview

This app uses [Lingui](https://lingui.dev/) for internationalization. All user-facing strings, including native menus, are translated from a single source of truth using compile-time message extraction and ICU MessageFormat.

### Key Design Decisions

- **Lingui**: Modern i18n library with compile-time extraction, ICU MessageFormat, and 25x smaller bundle than react-i18next
- **PO translation files**: Standard gettext Portable Object format in `/src/locales/{locale}/`
- **Source text as keys**: Use actual text as keys (`t\`Save Changes``) instead of string IDs
- **JavaScript-based native menus**: Menus are built from JavaScript to use the same translation system
- **RTL support**: CSS uses logical properties for automatic RTL layout

## Architecture

```
/src/locales/
├── en/
│   ├── messages.po       # English translations (source)
│   └── messages.ts       # Compiled messages for runtime
├── ar/
│   ├── messages.po       # Arabic translations (RTL)
│   └── messages.ts
├── fr/
│   ├── messages.po       # French translations
│   └── messages.ts

/src/i18n/
├── config.ts            # Lingui i18n configuration
├── language-init.ts     # System locale detection
├── compat.ts            # Legacy i18next compatibility layer
├── react.ts             # useTranslation() compatibility wrapper
└── index.ts             # Exports

lingui.config.ts          # Lingui CLI configuration
```

## Quick Start

### Adding Translatable Strings

```typescript
import { t } from '@lingui/core/macro'
import { useLingui } from '@lingui/react'

function MyComponent() {
  const { i18n } = useLingui()

  return (
    <div>
      <h1>{t(i18n)`My Feature`}</h1>
      <p>{t(i18n)`This is my feature description`}</p>
      <button>{t(i18n)`Save Changes`}</button>
    </div>
  )
}
```

### Extracting Messages

```bash
npm run i18n:extract  # Extract messages to PO files
npm run i18n:compile  # Compile PO files to TS for runtime
```

The extraction automatically creates/updates PO files with your messages. Translate them in the `.po` files, then compile.

## Key Naming Conventions

Lingui uses **source text** as keys, not pre-defined IDs. Translation keys in PO files are generated automatically.

### Example Translation

```typescript
// Component code
t(i18n)`Save Changes`
```

```po
# messages.po
msgid "Save Changes"
msgstr "حفظ التغييرات"
```

### Key Generation

| Source Text                  | PO msgid                     |
| ---------------------------- | ---------------------------- |
| `t\`Save Changes\``          | `Save Changes`               |
| `t\`preferences.title\``     | `preferences.title` (legacy) |
| `t(i18n)\`About {appName}\`` | `About {appName}`            |

## Message Types

### Static Text

```typescript
t(i18n)`Hello World`
```

### Interpolation (ICU MessageFormat)

```typescript
// In component
t(i18n)`About ${appName}`

// In PO file
msgid "About {appName}"
msgstr "عن {appName}"
```

### Plurals

```typescript
import { plural } from '@lingui/core/macro'

function ItemCount({ count }: { count: number }) {
  const { i18n } = useLingui()

  return (
    <p>
      {t(i18n)`You have ${plural(count, {
        one: '# item',
        other: '# items'
      })} in your cart`}
    </p>
  )
}
```

### Rich Text with JSX

```typescript
import { Trans } from '@lingui/react/macro'

<Trans>
  Hello <strong>{name}</strong>, you have <Count count={5} /> messages
</Trans>
```

## Extraction Workflow

### Step 1: Add Messages to Code

```typescript
// Use t macro anywhere you need messages
t(i18n)`New Feature String`
```

### Step 2: Extract Messages

```bash
npm run i18n:extract
```

This creates/updates PO files with your new messages:

```
Catalog statistics for src/locales/{locale}/messages:
┌─────────────┬─────────────┬─────────┐
│ Language    │ Total count │ Missing │
├─────────────┼─────────────┼─────────┤
│ en (source) │     97      │    -    │
│ ar          │     97      │    1    │  ← Translate this!
│ fr          │     97      │    0    │
└─────────────┴─────────────┴─────────┘
```

### Step 3: Translate

Open `src/locales/ar/messages.po` and translate missing strings:

```po
msgid "New Feature String"
msgstr "سلسلة ميزة جديدة"
```

### Step 4: Compile

```bash
npm run i18n:compile
```

This compiles PO files to TypeScript for runtime use.

## Adding a New Language

### Step 1: Update lingui.config.ts

```typescript
export default defineConfig({
  sourceLocale: 'en',
  locales: ['en', 'ar', 'fr', 'es'], // Add new locale
  // ...
})
```

### Step 2: Extract

```bash
npm run i18n:extract
```

This creates the new locale directory with a PO file.

### Step 3: Translate

Translate all messages in `src/locales/es/messages.po`.

### Step 4: Compile

```bash
npm run i18n:compile
```

### Step 5: Update Available Languages

Update `/src/i18n/config.ts`:

```typescript
export const availableLanguages = ['en', 'ar', 'fr', 'es']
```

### Add RTL Support (if applicable)

If the language is RTL, add it to the `rtlLanguages` array in `config.ts`:

```typescript
const rtlLanguages = ['ar', 'he', 'fa', 'ur', 'es'] // if Spanish is RTL
```

## RTL Language Support

### Automatic Direction Switching

The i18n config automatically updates `document.documentElement.dir` when the language changes:

```typescript
// In /src/i18n/config.ts
function onLocaleChange(locale: string) {
  const dir = rtlLanguages.includes(locale) ? 'rtl' : 'ltr'
  document.documentElement.dir = dir
  document.documentElement.lang = locale
}
```

### CSS Logical Properties

Use CSS logical properties instead of physical properties for automatic RTL support:

| Physical (avoid) | Logical (use)                         |
| ---------------- | ------------------------------------- |
| `left`           | `start` or `inset-inline-start`       |
| `right`          | `end` or `inset-inline-end`           |
| `margin-left`    | `margin-inline-start` or `ms-*`       |
| `margin-right`   | `margin-inline-end` or `me-*`         |
| `padding-left`   | `padding-inline-start` or `ps-*`      |
| `padding-right`  | `padding-inline-end` or `pe-*`        |
| `text-left`      | `text-start`                          |
| `text-right`     | `text-end`                            |
| `border-left`    | `border-s-*` or `border-inline-start` |
| `border-right`   | `border-e-*` or `border-inline-end`   |

### Example

```tsx
// ❌ BAD: Physical properties break in RTL
<div className="text-left pl-4 mr-2">

// ✅ GOOD: Logical properties work in both LTR and RTL
<div className="text-start ps-4 me-2">
```

## Native Menus

Native menus are built from JavaScript to use the same i18n system.

### Using Compatibility Layer

```typescript
import { i18nCompat } from '@/i18n'

export async function buildAppMenu(): Promise<Menu> {
  const { t } = i18nCompat

  const myItem = await MenuItem.new({
    id: 'my-action',
    text: t('menu.myAction'),
    action: handleMyAction,
  })

  // ... add to submenu
}
```

### Automatic Menu Rebuild

```typescript
// In /src/lib/menu.ts
export function setupMenuLanguageListener(): void {
  const { t } = i18nCompat

  i18nCompat.on('languageChanged', async () => {
    await buildAppMenu()
  })
}
```

## System Locale Detection

On app startup, the language is initialized based on:

1. **User's saved preference** (if set in preferences)
2. **System locale** (if we have translations for it)
3. **English** (fallback)

See `/src/i18n/language-init.ts` for the implementation.

## Language Selector

The language selector in Preferences > Appearance allows users to change the language:

```typescript
import { availableLanguages } from '@/i18n/config'
import { loadAndActivate } from '@/i18n/config'

function LanguageSelector() {
  const handleChange = async (lang: string) => {
    await loadAndActivate(lang)
    // Save to preferences...
  }

  return (
    <Select value={currentLanguage} onValueChange={handleChange}>
      {availableLanguages.map(lang => (
        <SelectItem key={lang} value={lang}>
          {lang.toUpperCase()}
        </SelectItem>
      ))}
    </Select>
  )
}
```

## React Components

### useTranslation() Compatibility

Existing code using `useTranslation()` continues to work via compatibility layer:

```typescript
import { useTranslation } from '@/i18n/react'

function MyComponent() {
  const { t } = useTranslation()
  return <h1>{t('preferences.title')}</h1>
}
```

### Native Lingui Approach (Recommended)

For new code, use Lingui's native API:

```typescript
import { t } from '@lingui/core/macro'
import { useLingui } from '@lingui/react'

function MyComponent() {
  const { i18n } = useLingui()
  return <h1>{t(i18n)`Preferences`}</h1>
}
```

## Using Translations Outside React

### Compatibility Layer

For non-React contexts, use the compatibility layer:

```typescript
import { i18nCompat } from '@/i18n'

const { t } = i18nCompat
const text = t('menu.about', { appName: 'My App' })
```

### Native Lingui

```typescript
import { msg } from '@lingui/core/macro'
import { i18n } from '@lingui/core'

const aboutMessage = msg`About {appName}`
const _ = i18n._
const text = _(aboutMessage, { appName: 'My App' })
```

## Migration from react-i18next

### Existing Code

No changes needed - the compatibility layer (`src/i18n/react.ts` and `src/i18n/compat.ts`) ensures existing i18next code continues to work.

### New Features

For new features, use Lingui's native approach:

- Use `t\`source text\``instead of`t('key')`
- Use ICU MessageFormat for interpolation: `{variable}`
- Use `plural()` macro for pluralization
- Extract messages with `npm run i18n:extract`

### Gradual Migration

Migrate incrementally by converting components to use Lingui macros when convenient:

```diff
- import { useTranslation } from 'react-i18next'
+ import { t } from '@lingui/core/macro'
+ import { useLingui } from '@lingui/react'

function MyComponent() {
-  const { t } = useTranslation()
+  const { i18n } = useLingui()

-  return <h1>{t('preferences.title')}</h1>
+  return <h1>{t(i18n)`Preferences`}</h1>
}
```

## ICU MessageFormat Reference

Lingui uses ICU MessageFormat for advanced formatting features.

### Variables

```typescript
t(i18n)`Hello ${name}`
```

### Plurals

```typescript
plural(count, {
  one: '# item',
  other: '# items',
})
```

### Select

```typescript
select(gender, {
  male: 'He',
  female: 'She',
  other: 'They',
})
```

### Ordinals

```typescript
ordinal(position, {
  one: '#st',
  two: '#nd',
  few: '#rd',
  other: '#th',
})
```

## Testing with RTL

To test RTL layout:

1. Open Preferences > Appearance
2. Change language to Arabic (ar)
3. Verify layout mirrors correctly
4. Check all text alignment uses logical properties

## Best Practices

1. **Use source text as keys**: `t\`Save Changes\``is better than`t('saveButton')`
2. **Extract regularly**: Run `npm run i18n:extract` after adding new messages
3. **Translate before compiling**: Ensure all PO files are translated before `npm run i18n:compile`
4. **Use ICU MessageFormat**: Leverage pluralization, select, and other features
5. **Keep messages complete**: Translators need full context in the source text
6. **Use logical properties**: Always use `text-start`, `ps-*`, `me-*` etc. for RTL support

## Troubleshooting

### Messages Not Appearing

1. Did you run `npm run i18n:extract`?
2. Did you run `npm run i18n:compile`?
3. Check console for message extraction warnings

### Missing Translations

1. Check `npm run i18n:extract` output for "Missing" counts
2. Translate strings in the PO file
3. Run `npm run i18n:compile`

### RTL Not Working

1. Check language is in `rtlLanguages` array in `config.ts`
2. Verify `document.documentElement.dir` updates
3. Use CSS logical properties (`text-start`, not `text-left`)
