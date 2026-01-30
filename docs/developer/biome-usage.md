# Biome Configuration Guide

This project uses **Biome** to replace ESLint and Prettier for faster, unified linting and formatting.

## Quick Commands

```bash
# Check code (lint + format)
bun run lint

# Auto-fix issues
bun run lint:fix

# Format code
bun run format

# Check format only
bun run format:check
```

## Configuration

**File:** `biome.json`

```json
{
  "$schema": "https://biomejs.dev/schemas/latest/schema.json",
  "formatter": {
    "enabled": true,
    "indentStyle": "space",
    "indentWidth": 2,
    "lineWidth": 100
  },
  "linter": {
    "enabled": true,
    "rules": {
      "recommended": true
    }
  }
}
```

## Differences from ESLint + Prettier

### Formatting

| Prettier             | Biome                  |
| -------------------- | ---------------------- |
| `prettier --write .` | `bun run format`       |
| `prettier --check .` | `bun run format:check` |

### Linting

| ESLint           | Biome              |
| ---------------- | ------------------ |
| `eslint .`       | `bun run lint`     |
| `eslint . --fix` | `bun run lint:fix` |

### Key Changes

1. **Single Tool**: Biome combines linting + formatting + import sorting
2. **No `.prettierrc` or `.eslintrc`**: Everything in `biome.json`
3. **No `eslint-plugin-import`**: Import sorting built-in
4. **Faster**: 15-50x faster than ESLint + Prettier

## Import Sorting

Biome automatically organizes imports:

```typescript
// BEFORE
import { useEffect } from 'react'
import Button from './Button'
import { useState } from 'react'

// AFTER (Biome auto-organizes)
import { useEffect, useState } from 'react'
import Button from './Button'
```

## Rules Configured

### Enabled Rules

- ✅ `recommended`: All recommended Biome rules
- ✅ `noUnusedVariables`: Detect unused variables
- ✅ `useExhaustiveDependencies`: React hooks dependency warnings
- ✅ `useImportType`: Enforce type-only imports where possible
- ✅ `trailingCommas`: es5 style

### Disabled Rules

- ❌ `noExplicitAny`: Allow `any` type for flexibility
- ❌ `noConsoleLog`: Allow console.log for debugging
- ❌ `noNegationElse`: Allow useful else patterns
- ❌ `noSvgWithoutTitle`: Allow SVGs without titles

### Test Files

Test files (`.test.ts`, `.test.tsx`, `.spec.ts`, `.spec.tsx`) have relaxed rules:

```json
"overrides": [
  {
    "include": ["*.test.ts", "*.test.tsx"],
    "linter": {
      "rules": {
        "suspicious": {
          "noExplicitAny": "off",
          "noConsoleLog": "off"
        }
      }
    }
  }
]
```

## Suppressing Rules

### Ignore Specific Line

```typescript
// biome-ignore lint/suspicious/noExplicitAny: legacy API
const data: any = fetchLegacy()
```

### Ignore All Rules on Line

```typescript
// biome-ignore all: complex dynamic logic
const result = complexFunction()
```

### Block Suppression

```typescript
// biome-ignore-start lint: temporary code
const foo: any = bar
console.log(foo)
// biome-ignore-end lint
```

## Ignoring Files

Configure ignored files in `biome.json`:

```json
{
  "files": {
    "ignore": ["node_modules", "dist", "build", "coverage"]
  }
}
```

## Formatting Style

Biome matches the existing Prettier style:

```json
{
  "formatter": {
    "indentStyle": "space",
    "indentWidth": 2,
    "lineWidth": 100,
    "lineEnding": "lf"
  },
  "javascript": {
    "formatter": {
      "quoteStyle": "single",
      "jsxQuoteStyle": "double",
      "semicolons": "always",
      "trailingCommas": "es5"
    }
  }
}
```

## Performance

| Tool              | Time  | Comparison     |
| ----------------- | ----- | -------------- |
| Biome             | ~1.3s | **19x faster** |
| ESLint only       | ~24s  | baseline       |
| ESLint + Prettier | ~28s  | 1.2x slower    |

## Migration from ESLint + Prettier

### ESLint Rule Mapping

| ESLint Rule                          | Biome Rule                              |
| ------------------------------------ | --------------------------------------- |
| `no-unused-vars`                     | `correctness/noUnusedVariables`         |
| `react-hooks/exhaustive-deps`        | `correctness/useExhaustiveDependencies` |
| `no-console`                         | `suspicious/noConsoleLog`               |
| `@typescript-eslint/no-explicit-any` | `suspicious/noExplicitAny`              |
| `import/order`                       | `organizeImports` (built-in)            |

### React Hooks

Biome natively supports React hooks:

```typescript
// ✅ Detected
useEffect(() => {
  const data = fetchData()
}, []) // Warning: 'data' is missing in dependency array
```

## Integration with Tooling

### VSCode

Install Biome extension:

```bash
code --install-extension biomejs.biome
```

Add to `.vscode/settings.json`:

```json
{
  "editor.defaultFormatter": "biomejs.biome",
  "editor.formatOnSave": true,
  "[javascript]": {
    "editor.defaultFormatter": "biomejs.biome"
  },
  "[javascriptreact]": {
    "editor.defaultFormatter": "biomejs.biome"
  },
  "[typescript]": {
    "editor.defaultFormatter": "biomejs.biome"
  },
  "[typescriptreact]": {
    "editor.defaultFormatter": "biomejs.biome"
  }
}
```

### Git Hooks (Lefthook)

Biome integrates with Lefthook (see Phase 5):

```yaml
# lefthook.yml
pre-commit:
  parallel: true
  commands:
    biome-check:
      glob: '*.{js,jsx,ts,tsx,json,css,md}'
      run: bun run biome check --write {staged_files}
      stage_fixed: true
```

## Troubleshooting

### Biome Not Found

If Biome isn't installed:

```bash
bun add -D @biomejs/biome
```

### Conflicts with Old Config

Remove old ESLint/Prettier configs:

```bash
rm -f eslint.config.js prettier.config.js .eslintrc* .prettierrc*
```

### Format Not Applied

Check if `write` flag is used:

```bash
# ❌ Dry run only (no changes)
bun run biome check .

# ✅ Apply fixes
bun run biome check --write .
```

## References

- [Biome Documentation](https://biomejs.dev)
- [Biome vs ESLint + Prettier](https://biomejs.dev/blog/introducing-biome)
- [Rule Reference](https://biomejs.dev/linter/rules)
