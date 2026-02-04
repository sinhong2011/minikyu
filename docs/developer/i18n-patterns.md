# Internationalization (i18n)

## Overview

This app uses [Lingui](https://lingui.dev/) for internationalization. All user-facing strings, including native menus, are translated from a single source of truth using compile-time message extraction and ICU MessageFormat.

### Key Design Decisions

- **Lingui**: Modern i18n library with compile-time extraction, ICU MessageFormat, and 25x smaller bundle than react-i18next
- **PO translation files**: Standard gettext Portable Object format in `/src/locales/{locale}/`
- **Source text as keys**: Use actual text as keys (`_(msg`Save Changes`)`) instead of string IDs
- **JavaScript-based native menus**: Menus are built from JavaScript to use the same translation system
- **RTL support**: CSS uses logical properties for automatic RTL layout

## Architecture

```
/src/locales/
├── en/
│   ├── messages.po       # English translations (source)
│   └── messages.ts       # Compiled messages for runtime
├── zh-CN/
│   ├── messages.po       # Chinese Simplified translations
│   └── messages.ts
├── zh-TW/
│   ├── messages.po       # Chinese Traditional translations
│   └── messages.ts
├── ja/
│   ├── messages.po       # Japanese translations
│   └── messages.ts
└── ko/
    ├── messages.po       # Korean translations
    └── messages.ts

/src/i18n/
├── config.ts            # Lingui i18n configuration
├── language-init.ts     # System locale detection
└── index.ts             # Exports

lingui.config.ts          # Lingui CLI configuration
```

## Quick Start

### Adding Translatable Strings

```typescript
import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';

function MyComponent() {
  const { _ } = useLingui();

  return (
    <div>
      <h1>{_(msg`My Feature`)}</h1>
      <p>{_(msg`This is my feature description`)}</p>
      <button>{_(msg`Save Changes`)}</button>
    </div>
  );
}
```

### Extracting Messages

```bash
bun run i18n:extract  # Extract messages to PO files
bun run i18n:compile  # Compile PO files to TS for runtime
```

The extraction automatically creates/updates PO files with your messages. Translate them in the `.po` files, then compile.

## Key Naming Conventions

Lingui uses **source text** as keys, not pre-defined IDs. Translation keys in PO files are generated automatically.

### Example Translation

```typescript
// Component code
_(msg`Save Changes`)
```

```po
# messages.po
msgid "Save Changes"
msgstr "保存更改"
```

### Key Generation

| Source Text                     | PO msgid                     |
| ------------------------------- | ---------------------------- |
| `_(msg`Save Changes`)`          | `Save Changes`               |
| `_(msg`About ${appName}`)`      | `About {appName}`            |

## Message Types

### Static Text

```typescript
_(msg`Hello World`)
```

### Interpolation (ICU MessageFormat)

```typescript
// In component
_(msg`About ${appName}`)

// In PO file
msgid "About {appName}"
msgstr "关于 {appName}"
```

### Plurals

```typescript
import { plural } from '@lingui/core/macro';

function ItemCount({ count }: { count: number }) {
  const { _ } = useLingui();

  return (
    <p>
      {_(msg`You have ${plural(count, {
        one: '# item',
        other: '# items'
      })} in your cart`)}
    </p>
  );
}
```

### Rich Text with JSX

```typescript
import { Trans } from '@lingui/react/macro';

<Trans>
  Hello <strong>{name}</strong>, you have <Count count={5} /> messages
</Trans>
```

## Extraction Workflow

### Step 1: Add Messages to Code

```typescript
// Use msg macro anywhere you need messages
_(msg`New Feature String`)
```

### Step 2: Extract Messages

```bash
bun run i18n:extract
```

This creates/updates PO files with your new messages:

```
Catalog statistics for src/locales/{locale}/messages:
┌─────────────┬─────────────┬─────────┐
│ Language    │ Total count │ Missing │
├─────────────┼─────────────┼─────────┤
│ en (source) │     97      │    -    │
│ zh-CN       │     97      │    1    │  ← Translate this!
│ ja          │     97      │    0    │
└─────────────┴─────────────┴─────────┘
```

### Step 3: Translate

Open `src/locales/zh-CN/messages.po` and translate missing strings:

```po
msgid "New Feature String"
msgstr "新功能字符串"
```

### Step 4: Compile

```bash
bun run i18n:compile
```

This compiles PO files to TypeScript for runtime use.

## Adding a New Language

### Step 1: Update lingui.config.ts

```typescript
export default defineConfig({
  sourceLocale: 'en',
  locales: ['en', 'zh-CN', 'zh-TW', 'ja', 'ko', 'es'], // Add new locale
  // ...
});
```

### Step 2: Extract

```bash
bun run i18n:extract
```

This creates the new locale directory with a PO file.

### Step 3: Translate

Translate all messages in `src/locales/es/messages.po`.

### Step 4: Compile

```bash
bun run i18n:compile
```

### Step 5: Update Available Languages

Update `/src/i18n/config.ts`:

```typescript
export const availableLanguages = ['en', 'zh-CN', 'zh-TW', 'ja', 'ko', 'es'];
```

### Add RTL Support (if applicable)

If the language is RTL, add it to the `rtlLanguages` array in `config.ts`:

```typescript
const rtlLanguages = ['he', 'fa', 'ur', 'ar'];
```

## RTL Language Support

### Automatic Direction Switching

The i18n config automatically updates `document.documentElement.dir` when the language changes:

```typescript
// In /src/i18n/config.ts
function onLocaleChange(locale: string) {
  const dir = rtlLanguages.includes(locale) ? 'rtl' : 'ltr';
  document.documentElement.dir = dir;
  document.documentElement.lang = locale;
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

### Using Lingui in Menus

```typescript
import { msg } from '@lingui/core/macro';
import { i18n } from '@lingui/core';

export async function buildAppMenu(): Promise<Menu> {
  const _ = i18n._.bind(i18n);

  const myItem = await MenuItem.new({
    id: 'my-action',
    text: _(msg`My Action`),
    action: handleMyAction,
  });

  // ... add to submenu
}
```

### Automatic Menu Rebuild

```typescript
// In /src/lib/menu.ts
export function setupMenuLanguageListener(): () => void {
  const handler = async () => {
    await buildAppMenu();
  };

  const unsubscribe = i18n.on('change', handler);
  return () => {
    if (unsubscribe) unsubscribe();
  };
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
import { availableLanguages, loadAndActivate } from '@/i18n/config';

function LanguageSelector() {
  const handleChange = async (lang: string) => {
    await loadAndActivate(lang);
    // Save to preferences...
  };

  return (
    <Select value={currentLanguage} onValueChange={handleChange}>
      {availableLanguages.map(lang => (
        <SelectItem key={lang} value={lang}>
          {lang.toUpperCase()}
        </SelectItem>
      ))}
    </Select>
  );
}
```

## React Components

### Native Lingui Approach (Recommended)

For new code, use Lingui's native API:

```typescript
import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';

function MyComponent() {
  const { _ } = useLingui();
  return <h1>{_(msg`Preferences`)}</h1>;
}
```

## Using Translations Outside React

### Native Lingui

```typescript
import { msg } from '@lingui/core/macro';
import { i18n } from '@lingui/core';

const aboutMessage = msg`About ${appName}`;
const _ = i18n._.bind(i18n);
const text = _(aboutMessage, { appName: 'My App' });
```

## ICU MessageFormat Reference

Lingui uses ICU MessageFormat for advanced formatting features.

### Variables

```typescript
_(msg`Hello ${name}`)
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
2. Change language to an RTL language (e.g., Hebrew, Persian, Urdu, Arabic)
3. Verify layout mirrors correctly
4. Check all text alignment uses logical properties

## Test File Limitations

Bun's test runner doesn't process Lingui macros. Use helper functions in test files:

```typescript
// Test files ONLY
import type { MessageDescriptor } from '@lingui/core';

const createMsgDescriptor = (text: string): MessageDescriptor => ({
  id: text,
  message: text,
});

// Use in tests
const mockCommand: AppCommand = {
  id: 'test-command',
  label: createMsgDescriptor('Test Command'), // ✅ Works in tests
  // label: msg`Test Command`,                // ❌ Breaks in Bun tests
};
```

## Best Practices

1. **Use source text as keys**: `_(msg`Save Changes`)` is better than string IDs
2. **Extract regularly**: Run `bun run i18n:extract` after adding new messages
3. **Translate before compiling**: Ensure all PO files are translated before `bun run i18n:compile`
4. **Use ICU MessageFormat**: Leverage pluralization, select, and other features
5. **Keep messages complete**: Translators need full context in the source text
6. **Use logical properties**: Always use `text-start`, `ps-*`, `me-*` etc. for RTL support

## Troubleshooting

### Messages Not Appearing

1. Did you run `bun run i18n:extract`?
2. Did you run `bun run i18n:compile`?
3. Check console for message extraction warnings

### Missing Translations

1. Check `bun run i18n:extract` output for "Missing" counts
2. Translate strings in the PO file
3. Run `bun run i18n:compile`

### RTL Not Working

1. Check language is in `rtlLanguages` array in `config.ts`
2. Verify `document.documentElement.dir` updates
3. Use CSS logical properties (`text-start`, not `text-left`)
