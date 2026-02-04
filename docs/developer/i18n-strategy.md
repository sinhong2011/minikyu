# Internationalization (i18n) Strategy

This project uses **Lingui** for internationalization with compile-time message extraction, ICU MessageFormat, and RTL support.

## Current Setup

- **Library:** Lingui v5 with SWC compiler
- **Locales:** English (en), Chinese Simplified (zh-CN), Chinese Traditional (zh-TW), Japanese (ja), Korean (ko)
- **Language switching:** Runtime locale detection with system locale fallback
- **RTL Support:** Automatic `dir` and `lang` attribute updates on HTML element
- **Bundle size:** 25x smaller than react-i18next

## Why Lingui?

### Advantages

- **Compile-time extraction** - Messages extracted at build time, no runtime overhead
- **Type-safe** - No string key typos, direct macro usage
- **ICU MessageFormat** - Built-in pluralization, select, and ordinal support
- **SWC compiler** - Fast compilation without Babel
- **PO file format** - Standard gettext format, translator-friendly
- **Small bundle** - Minimal runtime footprint

## Configuration

**File:** `src/i18n/config.ts`

```typescript
import { i18n } from '@lingui/core';

const rtlLanguages = ['he', 'fa', 'ur'];

function onLocaleChange(locale: string) {
  const dir = rtlLanguages.includes(locale) ? 'rtl' : 'ltr';
  document.documentElement.dir = dir;
  document.documentElement.lang = locale;
}

async function loadAndActivate(locale: string): Promise<void> {
  const { messages } = await import(`../locales/${locale}/messages.ts`);
  i18n.loadAndActivate({ locale, messages });
  onLocaleChange(locale);
}

export const availableLanguages = ['en', 'zh-CN', 'zh-TW', 'ja', 'ko'];
```

**File:** `lingui.config.ts`

```typescript
export default defineConfig({
  sourceLocale: 'en',
  locales: ['en', 'zh-CN', 'zh-TW', 'ja', 'ko'],
  catalogs: [
    {
      path: 'src/locales/{locale}/messages',
      include: ['src/'],
    },
  ],
  format: 'po',
});
```

## Usage

### React Components

```tsx
import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';

function MyComponent() {
  const { _ } = useLingui();
  return <h1>{_(msg`My Feature Title`)}</h1>;
}
```

### Non-React Contexts

```typescript
import { msg } from '@lingui/core/macro';
import { i18n } from '@lingui/core';

const _ = i18n._.bind(i18n);
console.log(_(msg`Some message`));
```

### Interpolation

```typescript
const userName = 'Alice';
_(msg`Hello, ${userName}!`);
```

### Plurals

```typescript
import { plural } from '@lingui/core/macro';

_(msg`You have ${plural(count, {
  one: '# item',
  other: '# items'
})} in your cart`);
```

## Extraction Workflow

### Step 1: Add Messages to Code

```typescript
// Use msg macro anywhere you need messages
_(msg`New Feature String`);
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

## RTL Support

RTL languages automatically:

- Set `dir="rtl"` on HTML element
- Update CSS logical properties support via Tailwind
- Flip layout direction

### CSS Logical Properties

Use logical properties instead of physical ones:

| Physical (avoid) | Logical (use)                   |
| ---------------- | ------------------------------- |
| `text-left`      | `text-start`                    |
| `pl-4`           | `ps-4` (padding-inline-start)   |
| `mr-2`           | `me-2` (margin-inline-end)      |
| `border-l`       | `border-s` (border-inline-start)|

## Adding a New Language

### Step 1: Update lingui.config.ts

```typescript
export default defineConfig({
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

## Best Practices

1. **Use source text as keys**: `_(msg`Save Changes`)` is better than string IDs
2. **Extract regularly**: Run `bun run i18n:extract` after adding new messages
3. **Translate before compiling**: Ensure all PO files are translated before `bun run i18n:compile`
4. **Use ICU MessageFormat**: Leverage pluralization, select, and other features
5. **Keep messages complete**: Translators need full context in the source text
6. **Use logical properties**: Always use `text-start`, `ps-*`, `me-*` etc. for RTL support

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

## Migration from react-i18next

The project has fully migrated from react-i18next to Lingui. The old `i18n-patterns.md` documented Lingui patterns while `i18n-strategy.md` (this file) incorrectly still referenced react-i18next. This has now been corrected.

## References

- [Lingui Documentation](https://lingui.dev)
- [ICU MessageFormat](https://unicode-org.github.io/icu/userguide/format_parse/messages/)
- [gettext PO Format](https://www.gnu.org/software/gettext/manual/html_node/PO-Files.html)
