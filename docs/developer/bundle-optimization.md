# Bundle Optimization

Bundle size optimization for Tauri React applications.

## Built-in Optimizations

This app includes several optimizations out of the box:

### Rust Binary (20-30% size reduction)

**File**: `src-tauri/Cargo.toml`

```toml
[profile.release]
codegen-units = 1     # Better LLVM optimization
lto = true            # Link-time optimizations
opt-level = "s"       # Optimize for size
panic = "abort"       # No panic unwinding code
strip = true          # Remove debug symbols
```

### Tauri Build

**File**: `src-tauri/tauri.conf.json`

```json
{
  "build": {
    "removeUnusedCommands": true
  }
}
```

Removes Tauri commands not called from your frontend.

## Analyzing Bundle Size

```bash
bun run build:analyze   # Build and analyze

# Manual analysis
bun run build
du -sh dist/*           # Check output sizes
ls -lah dist/assets/    # Examine chunks
```

## When to Optimize Further

The built-in optimizations are sufficient for most apps. Consider more when:

- Built app > 10MB
- Initial load > 3 seconds
- Large dependencies you don't fully use

## Tree Shaking

### Import Optimization

```typescript
// ❌ Imports entire library
import * as icons from "@hugeicons/core-free-icons"

// ✅ Import only what you need
import { HugeiconsIcon } from "@hugeicons/react"
import {
  Search01Icon,
  Settings01Icon,
  UserIcon,
} from "@hugeicons/core-free-icons"

// ❌ Full lodash
import _ from "lodash"

// ✅ Specific functions - prefer es-toolkit over lodash
import { debounce } from "es-toolkit"
```

### es-toolkit (Recommended)

**Version**: 1.x (latest stable)

We recommend using **es-toolkit** as the primary utility library. It provides modern, tree-shakeable alternatives to lodash with better performance and smaller bundle sizes.

**Installation**:

```bash
bun add es-toolkit
```

**Advantages over lodash**:

| Feature      | es-toolkit            | lodash               |
| ------------ | --------------------- | -------------------- |
| Bundle size  | ~1-2KB per function   | ~70KB full import    |
| Tree shaking | Native ESM, automatic | Requires `lodash-es` |
| Performance  | 2-10x faster          | Standard             |
| TypeScript   | First-class support   | Good support         |
| Modern JS    | Built for ES2020+     | Legacy compatibility |
| Deno/Bun     | Native support        | Requires polyfills   |

**Common replacements**:

```typescript
// ✅ es-toolkit (recommended)
import {
  debounce,
  throttle,
  groupBy,
  keyBy,
  chunk,
  pick,
  omit,
} from "es-toolkit"

// ❌ lodash equivalents (avoid)
import {
  debounce,
  throttle,
  groupBy,
  keyBy,
  chunk,
  pick,
  omit,
} from "lodash-es"
```

**When to use es-toolkit**:

- All new code should prefer es-toolkit
- Refactor existing lodash imports during code maintenance
- Use for debouncing, throttling, array/object manipulation

**When you might still need lodash**:

- Deep clone with circular references (`_.cloneDeep`)
- Complex function composition (`_.flow`, `_.compose`)
- Legacy code that would require extensive refactoring

### Date Libraries

```typescript
// ✅ Tree-shakeable imports
import { format } from "date-fns/format"
import { parseISO } from "date-fns/parseISO"

// Or use native API
new Intl.DateTimeFormat("en-US").format(date)
```

## Code Splitting

For apps with multiple routes/features:

```typescript
import { lazy, Suspense } from 'react'

const Dashboard = lazy(() => import('./Dashboard'))
const Settings = lazy(() => import('./Settings'))

// In component
<Suspense fallback={<div>Loading...</div>}>
  <Dashboard />
</Suspense>
```

### Manual Chunking (Advanced)

```typescript
// vite.config.ts
export default defineConfig({
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ["react", "react-dom"],
          ui: ["@radix-ui/react-dialog", "@radix-ui/react-dropdown-menu"],
        },
      },
    },
  },
})
```

## Tauri-Specific Optimizations

### Remove Unused Plugins

```toml
# src-tauri/Cargo.toml - Comment out unused plugins
[dependencies]
# tauri-plugin-fs = "2"        # Remove if not used
```

### Minimize Capabilities

Only include permissions you use in `src-tauri/capabilities/desktop.json`.

## Common Issues

| Issue                    | Solution                                          |
| ------------------------ | ------------------------------------------------- |
| Large initial bundle     | Implement code splitting                          |
| Duplicate dependencies   | `bun ls react` then `bun dedupe`                  |
| Unused shadcn components | Remove from `src/components/ui/`                  |
| Heavy date library       | Use `date-fns` with tree shaking or native `Intl` |

## Measuring Impact

```bash
# Rust binary size
cd src-tauri && cargo build --release
ls -lah target/release/minikyu

# Frontend bundle
bun run build && du -sh dist/
```

**Remember**: Measure before optimizing. Don't over-optimize prematurely.
