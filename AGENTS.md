# AI Agent Instructions

## Overview

This repository is a template with sensible defaults for building Tauri React apps.

## Core Rules

### New Sessions

- Read @docs/tasks.md for task management
- Review `docs/developer/architecture-guide.md` for high-level patterns
- Check `docs/developer/README.md` for the full documentation index
- Check git status and project structure

### Development Practices

**CRITICAL:** Follow these strictly:

1. **Use bun only**: This project uses `bun`. Always use `bun install`, `bun run`, etc.
2. **Read Before Editing**: Always read files first to understand context
3. **Follow Established Patterns**: Use patterns from this file and `docs/developer`
4. **Senior Architect Mindset**: Consider performance, maintainability, testability
5. **Batch Operations**: Use multiple tool calls in single responses
6. **Match Code Style**: Follow existing formatting and patterns
7. **Test Coverage**: Write comprehensive tests for business logic

### Git Rules (CRITICAL)

**Full guide:** `docs/developer/git-flow.md`

When making commits, follow these rules:

1. **Commit Message Format** (conventional commits + sentence case):
   ```
   <type>(<scope>): <Subject>
   
   ✅ feat: Add user authentication
   ✅ fix(tauri): Handle window resize
   ✅ docs: Update API documentation
   ❌ feat: add user authentication  (lowercase subject)
   ❌ Add user authentication.       (no type, period at end)
   ```

2. **Commit Types**:
   - `feat` - New feature
   - `fix` - Bug fix
   - `docs` - Documentation only
   - `refactor` - Code refactoring
   - `test` - Adding/updating tests
   - `chore` - Maintenance tasks
   - `ci` - CI configuration
   - `build` - Build/dependencies

3. **Branch Naming**:
   ```
   feature/MKY-123-short-description
   fix/MKY-456-short-description
   docs/short-description
   ```

4. **Git Hooks** (Lefthook - cannot be bypassed):
   - **pre-commit**: Biome auto-fix + TypeScript check
   - **pre-push**: Tests + Tauri check
   - **commit-msg**: Conventional commit validation

5. **Never Commit Without Permission** unless explicitly requested by user

6. **If Hook Fails**: Fix the issue and retry - do NOT use `--no-verify`

## Operational Rules (CRITICAL)

After any code changes that could affect the application's ability to run:

1. **MUST RUN BUN RUN DEV TO VERIFY APP WORKS** after making Rust changes
   - Changes to Tauri commands, state management, or type systems
   - New features that affect app startup or core functionality
   - Before marking task complete, run `bun run dev` and ensure:
     - App launches successfully
     - No compilation errors in console
     - Core features work (menu, tray, windows)
     - New features are accessible

2. **RUST COMPILATION VERIFICATION** (after Rust changes)
   - Run `cd src-tauri && cargo build --lib` to check for compilation errors
   - If compilation fails, fix all errors before proceeding
   - Check that tauri-specta bindings are properly included in `src-tauri/src/bindings.rs`
   - Common errors to watch for:
     - Missing imports in `bindings.rs`
     - Syntax errors (unclosed delimiters, missing braces)
     - Type mismatches in collect_commands! macro
   - After fixing, regenerate TypeScript bindings: `bun run codegen:tauri`

3. **VERIFY BINDINGS REGENERATION** (after adding new commands)
   - When adding new Tauri commands, add them to `collect_commands!` macro in `bindings.rs`
   - After updating `bindings.rs`, run `bun run codegen:tauri` to regenerate TypeScript bindings
   - Verify new bindings exist in `src/lib/tauri-bindings.ts`

4. **CHECK FOR COMMON ISSUES** (before assuming completion)
   - ❌ Do NOT add commands that fail to compile due to:
     - Missing or incorrect imports
     - Syntax errors (unclosed braces, extra semicolons)
     - Type annotation issues (missing `#[derive]` on structs)
     - Incorrect macro usage in collect_commands!
   - ✅ Do use existing patterns from other commands as templates
   - ✅ Follow existing code style and formatting

5. **RUST-SPECIFIC RULES** (Critical)
   - **Modern Rust formatting**: Always use `format!("{}",variable)`` not old println!
   - **Error handling**: Use `?` operator and `map_err()` for Result types
   - **Async/Await**: Use `.await` on futures and async functions
   - **Arc/Mutex**: Wrap shared state in `Arc<Mutex<>>` for thread safety
   - **String types**: Use `String.to_string()`` and `.as_str()`` correctly
   - **No unwrap_or_else** when better to handle errors explicitly

6. **QUALITY GATES** (Before Marking Tasks Complete)
   - Run `bun run check:all` after significant changes
   - Includes: `bun run typecheck`, `cargo clippy -- -D warnings`, `cargo test`, `cargo fmt -- --check`
   - All must pass before considering work complete
   - LSP diagnostics must be clean on changed files

7. **TESTING NEW FEATURES** (After Implementation)
   - Verify the feature works as intended through manual testing
   - Check that error handling works correctly (user sees error messages)
   - Verify toast notifications appear for user feedback
   - Test edge cases: network failures, cancelled dialogs, file write errors
   - Ensure UI state updates correctly (downloads dialog opens/closes)

8. **NEVER ASSUME APP RUNS** 
   - Always verify by actually running `bun run dev`
   - Do NOT mark work complete until dev server starts and loads app
   - If dev server shows errors, fix them first
   - If Rust compiles but app won't launch, investigate further
9. **No Dev Server**: Ask user to run and report back
10. **No Unsolicited Commits**: Only when explicitly requested
11. **Documentation**: Update relevant `docs/developer/` files for new patterns
12. **Removing files**: Always use `rm -f`

### Operational Modes

#### Search Mode (Exhaustive Discovery)

When user requests search, exploration, or "find all X":

**MAXIMIZE SEARCH EFFORT** - Launch multiple agents IN PARALLEL:

- **Explore agents** (2-3): Codebase patterns, file structures, AST patterns
- **Librarian agents** (1-2): Remote repos, official docs, GitHub examples (when external libraries involved)
- **Direct tools**: Grep, AST-grep for targeted searches

**NEVER stop at first result** - be exhaustive. Search until:

- Same information appearing across multiple sources
- All reasonable search angles exhausted
- Clear confidence in completeness

#### Analyze Mode (Strategic Assessment)

When user requests analysis, debugging, or architectural decisions:

**CONTEXT GATHERING (parallel)**:

1. Launch 1-2 **explore agents** for codebase patterns and existing implementations
2. Launch 1-2 **librarian agents** if external libraries/frameworks involved
3. Use **direct tools** (Grep, AST-grep, LSP) for targeted searches

**IF COMPLEX** (architecture decisions, multi-system tradeoffs, debugging after 2+ failed attempts):

- Consult **oracle** agent for strategic guidance before proceeding

**SYNTHESIZE** all findings before implementing or responding.

**CRITICAL:** Use Tauri v2 docs only. Always use modern Rust formatting: `format!("{variable}")`

## Architecture Patterns (CRITICAL)

### State Management Onion

```
useState (component) → Zustand (global UI) → TanStack Query (persistent data)
```

**Decision**: Is data needed across components? → Does it persist between sessions?

### Performance Pattern (CRITICAL)

```typescript
// ✅ GOOD: Selector syntax - only re-renders when specific value changes
const leftSidebarVisible = useUIStore((state) => state.leftSidebarVisible)

// ❌ BAD: Destructuring causes render cascades (caught by ast-grep)
const { leftSidebarVisible } = useUIStore()

// ✅ GOOD: Use getState() in callbacks for current state
const handleAction = () => {
  const { data, setData } = useStore.getState()
  setData(newData)
}
```

### Static Analysis

- **React Compiler**: Handles memoization automatically - no manual `useMemo`/`useCallback` needed
- **ast-grep**: Enforces architecture patterns (e.g., no Zustand destructuring). See `docs/developer/static-analysis.md`
- **Knip/jscpd**: Periodic cleanup tools. Use `/cleanup` command (Claude Code)

### Event-Driven Bridge

- **Rust → React**: `app.emit("event-name", data)` → `listen("event-name", handler)`
- **React → Rust**: Use typed commands from `@/lib/tauri-bindings` (tauri-specta)
- **Commands**: All actions flow through centralized command system

### Tauri Command Pattern (tauri-specta)

```typescript
// ✅ GOOD: Type-safe commands with Result handling
import { commands } from "@/lib/tauri-bindings"

const result = await commands.loadPreferences()
if (result.status === "ok") {
  console.log(result.data.theme)
}

// ❌ BAD: String-based invoke (no type safety)
const prefs = await invoke("load_preferences")
```

**Adding commands**: See `docs/developer/tauri-commands.md`

### Type-Safe i64 Serialization (CRITICAL)

**Problem**: JavaScript's `Number` type can only safely represent integers up to 2^53 - 1. Rust's `i64` can represent up to 2^63 - 1, causing precision loss if serialized as numbers.

**Solution**: Use custom serde helpers to serialize `i64` as strings:

```rust
// src-tauri/src/commands/your_command.rs
use crate::utils::serde_helpers::{
    serialize_i64_as_string,
    deserialize_i64_from_string_or_number,
};

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub struct MyStruct {
    #[serde(
        serialize_with = "serialize_i64_as_string",
        deserialize_with = "deserialize_i64_from_string_or_number"
    )]
    #[specta(type = String)]
    pub my_id: i64,
}
```

**TypeScript usage**:

```typescript
// ✅ GOOD: Convert to/from strings
const myStruct = {
  my_id: String(numericId),  // Convert number to string
}

// When comparing
if (String(entry.id) === myStruct.my_id) { ... }

// ❌ BAD: Never use 'as any' to bypass type safety
const myStruct = {
  my_id: numericId as any,  // NO! This defeats TypeScript
}
```

**Command Parameters**: When Tauri commands accept i64 parameters (typed as `string` in bindings), convert back to number before invoking:

```typescript
// src/lib/tauri-bindings.ts
function toNumberId(id: string): number {
  const num = Number(id);
  if (Number.isNaN(num)) {
    throw new Error(`Invalid ID: "${id}" cannot be converted to number`);
  }
  return num;
}

export const commands = {
  ...generatedCommands,
  async getEntry(id: string): Promise<Result<Entry, string>> {
    return invoke('get_entry', { id: toNumberId(id) }) as Promise<Result<Entry, string>>;
  },
};
```

**Rules**:
- **NEVER use `as any`** to work around type mismatches
- **ALWAYS use explicit conversion** (`String()`, `Number()`) 
- **Use serde helpers** for any Rust i64 that crosses FFI boundary
- **Override commands** in `tauri-bindings.ts` when params need conversion
- **Pre-existing helpers**: `src-tauri/src/utils/serde_helpers.rs`

### Internationalization (i18n)

```typescript
// ✅ GOOD: Use useLingui hook in React components
import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';

function MyComponent() {
  const { _ } = useLingui();
  return <h1>{_(msg`My Feature`)}</h1>
}

// ✅ GOOD: Non-React contexts - bind i18n and use msg macro
import { msg } from '@lingui/core/macro';
import { i18n } from '@lingui/core';

const _ = i18n._.bind(i18n);
const text = _(msg`Save Changes`);
```

- **Translations**: Extracted with `bun run i18n:extract` → `src/locales/{locale}/messages.po` → compiled with `bun run i18n:compile`
- **RTL Support**: Use CSS logical properties (`text-start` not `text-left`)
- **Adding strings**: See `docs/developer/i18n-patterns.md`
- **All user-facing messages must be translatable**: Every string displayed to users must use the Lingui `msg` macro and `useLingui` hook

```typescript
// ✅ GOOD: User-facing message with translation
import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';

function MyComponent() {
  const { _ } = useLingui();
  return <p>{_(msg`This message will be translated`)}</p>
}

// ❌ BAD: Hardcoded string without translation
function BadComponent() {
  return <p>This will not be translated</p>
}
```

### Form Validation

All forms must use a Zod validation schema with TanStack Form:

```typescript
import { useForm } from "@tanstack/react-form"
import { z } from "zod"
import { msg } from "@lingui/core/macro"
import { useLingui } from "@lingui/react"

function MyForm() {
  const { _ } = useLingui()

  // Define schema with Zod - error messages must be translated
  const formSchema = z.object({
    fieldName: z.string().min(1, _(msg`Field is required`)),
    // Add more fields...
  })

  // Use in form
  const form = useForm({
    defaultValues: { ... },
    validators: {
      onChange: formSchema,
    },
    onSubmit: async ({ value }) => {
      // Handle submission
    },
  })

  // Form element must prevent default submission
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        e.stopPropagation()
        form.handleSubmit()
      }}
    >
      {/* form fields */}
    </form>
  )
}
```

**Important**: All validation error messages must be translated using the `msg` macro and `useLingui` hook.

### Documentation & Versions

- **Context7 First**: Always use Context7 for framework docs before WebSearch
- **Version Requirements**: Tauri v2.x, shadcn/ui v4.x, Tailwind v4.x, React 19.x, Zustand v5.x, Vite v7.x, Vitest v4.x

### Utility Libraries

**es-toolkit** (v1.x) - Preferred utility library for all new code:

```typescript
// ✅ GOOD: Use es-toolkit for utility functions
import {
  debounce,
  throttle,
  groupBy,
  keyBy,
  chunk,
  pick,
  omit,
} from "es-toolkit"

// ❌ BAD: Avoid lodash in new code
import { debounce } from "lodash-es"
```

**Why es-toolkit?**

- **Smaller bundle**: ~1-2KB per function vs ~70KB for full lodash
- **Better performance**: 2-10x faster than lodash equivalents
- **Native ESM**: Automatic tree-shaking without configuration
- **Modern**: Built for ES2020+, works natively with Bun/Deno
- **TypeScript**: First-class type support

**When to use lodash**: Only for `_.cloneDeep` with circular references or complex function composition. See `docs/developer/bundle-optimization.md` for details.

## Developer Documentation

For complete patterns and detailed guidance, see `docs/developer/README.md`.

Key documents:

- `architecture-guide.md` - Mental models, security, anti-patterns
- `state-management.md` - State onion, getState() pattern details
- `tauri-commands.md` - Adding new Rust commands
- `static-analysis.md` - All linting tools and quality gates
- `git-flow.md` - Branching strategy, commit conventions, PR workflow

## Claude Code Commands & Agents

These are specific to Claude Code but documented here for context.

### Commands

- `/check` - Check work against architecture, run `bun run check:all`, suggest commit message
- `/cleanup` - Run static analysis (knip, jscpd, check:all), get structured recommendations
- `/init` - One-time template initialization

### Agents

Task-focused agents that leverage separate context for focused work:

- `plan-checker` - Validate implementation plans against documented architecture
- `docs-reviewer` - Review developer docs for accuracy and codebase consistency
- `userguide-reviewer` - Review user guide against actual system features
- `cleanup-analyzer` - Analyze static analysis output (used by `/cleanup`)
