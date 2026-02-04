# Lingui i18n Implementation

This document explains the idiomatic Lingui pattern implementation in the project, using inline message descriptors rather than centralized message files.

## Architecture

### Pure Lingui Pattern

Messages are defined inline using the `msg` macro at the point of use:

```typescript
// Components
import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';

function MyComponent() {
  const { _ } = useLingui();
  return <div>{_(msg`Welcome to the app`)}</div>;
}

// Non-React code
import { msg } from '@lingui/core/macro';
import { i18n } from '@lingui/core';

const _ = i18n._.bind(i18n);
const notification = _(msg`Task completed successfully`);
```

### Advantages

1. **No duplication** - Messages defined once where used
2. **Type safety** - Direct macro usage, no string keys
3. **Performance** - Direct message descriptor compilation
4. **Maintainability** - Messages co-located with usage
5. **Extraction** - Automatic discovery by Lingui tools

## Usage Patterns

### React Components

**Pattern:**

```typescript
import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';

function PreferencesDialog() {
  const { _ } = useLingui();

  return (
    <div>
      <h1>{_(msg`Preferences`)}</h1>
      <p>{_(msg`Configure your application settings`)}</p>
    </div>
  );
}
```

### Command Definitions

**Pattern:**

```typescript
import { msg } from "@lingui/core/macro";
import type { AppCommand } from "@/lib/commands/types";

export const navigationCommands: AppCommand[] = [
  {
    id: "show-sidebar",
    label: msg`Show Sidebar`,
    description: msg`Show the application sidebar`,
    execute: () => {
      // implementation
    },
  },
];
```

### Non-React Code

**Pattern:**

```typescript
import { msg } from "@lingui/core/macro";
import { i18n } from "@lingui/core";

export function createMenu() {
  const _ = i18n._.bind(i18n);
  return [
    {
      label: _(msg`File`),
      submenu: [
        { label: _(msg`Open`), role: "open" },
        { label: _(msg`Save`), role: "save" },
      ],
    },
  ];
}
```

## Test File Limitations

**IMPORTANT**: Bun's test runner doesn't process Lingui macros. Use helper functions in test files:

```typescript
// Test files ONLY
import type { MessageDescriptor } from "@lingui/core";

const createMsgDescriptor = (text: string): MessageDescriptor => ({
  id: text,
  message: text,
});

// Use in tests
const mockCommand: AppCommand = {
  id: "test-command",
  label: createMsgDescriptor("Test Command"), // ✅ Works in tests
  // label: msg`Test Command`,                // ❌ Breaks in Bun tests
};
```

## Extraction & Compilation

### Adding New Messages

1. **Add inline messages** using `msg` macro:

   ```typescript
   const title = msg`New Feature Title`;
   ```

2. **Extract messages**:

   ```bash
   bun run i18n:extract --clean
   ```

3. **Verify extraction**:
   ```bash
   # Should show increased message count
   bun run i18n:extract --clean
   ```

### Translation Workflow

1. **Development** - Add `msg` macros inline
2. **Extract** - `bun run i18n:extract --clean`
3. **Translate** - Fill `msgstr` fields in `.po` files
4. **Compile** - `bun run i18n:compile`
5. **Runtime** - App loads compiled `.ts` files

### File Structure

```
src/locales/
├── en/
│   ├── messages.po    # Source language (msgstr = msgid)
│   └── messages.ts    # Compiled runtime file
├── zh-CN/
│   ├── messages.po    # Chinese Simplified (msgstr = "" awaiting translation)
│   └── messages.ts    # Compiled runtime file
├── zh-TW/
│   ├── messages.po    # Chinese Traditional
│   └── messages.ts
├── ja/
│   ├── messages.po    # Japanese
│   └── messages.ts
└── ko/
    ├── messages.po    # Korean
    └── messages.ts
```

## Configuration

### Lingui Configuration

```typescript
// lingui.config.ts
import { defineConfig } from '@lingui/cli';

export default defineConfig({
  sourceLocale: 'en',
  locales: ['en', 'zh-CN', 'zh-TW', 'ja', 'ko'],
  catalogs: [
    {
      path: 'src/locales/{locale}/messages',
      include: ['src/'],
      exclude: ['**/node_modules/**'],
    },
  ],
  format: 'po',
  orderBy: 'messageId',
  compilerBabelOptions: {
    minified: false,
    sourceMaps: false,
  },
});
```

### i18n Config

```typescript
// src/i18n/config.ts
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
export { i18n, loadAndActivate };
```

## Best Practices

### ✅ DO

1. **Use msg macro everywhere**:

   ```typescript
   const text = msg`Hello world`;
   ```

2. **Extract after changes**:

   ```bash
   bun run i18n:extract --clean
   ```

3. **Use descriptive messages**:

   ```typescript
   // ✅ Good - clear context
   const title = msg`User Profile Settings`;

   // ❌ Bad - vague
   const title = msg`Settings`;
   ```

4. **Use variables for dynamic content**:

   ```typescript
   const greeting = msg`Hello ${userName}`;
   ```

5. **Test files use createMsgDescriptor**:
   ```typescript
   label: createMsgDescriptor('Test Command'),
   ```

### ❌ DON'T

1. **Don't use string keys**:

   ```typescript
   // ❌ Bad
   t("user.profile.title");

   // ✅ Good
   _(msg`User Profile`);
   ```

2. **Don't use msg macro in test files**:

   ```typescript
   // ❌ Breaks with Bun
   label: msg`Test`,

   // ✅ Works in tests
   label: createMsgDescriptor('Test'),
   ```

3. **Don't bypass extraction**:

   ```typescript
   // ❌ Bad - won't be extracted
   const text = "Hello world";

   // ✅ Good - will be extracted
   const text = msg`Hello world`;
   ```

4. **Don't hand-edit .po files** - use extract/compile cycle

## Current State

- **Pattern**: Pure inline `msg` macro usage
- **Tests**: Working with `createMsgDescriptor` helper
- **Build**: TypeScript passes, extraction/compilation working
- **Languages**: en (source), zh-CN, zh-TW, ja, ko

## References

- [Lingui Documentation](https://lingui.dev)
- [i18n-patterns.md](./i18n-patterns.md) - General i18n patterns
- [i18n-strategy.md](./i18n-strategy.md) - Strategic overview
