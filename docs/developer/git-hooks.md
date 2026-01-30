# Git Hooks with Lefthook

This project uses **Lefthook** for fast, cross-platform git hooks with automatic error fixing and file staging.

## Installation

Initial setup:

```bash
bun install
bun run lefthook
```

## Hooks Configured

### Pre-Commit (Runs Before Each Commit)

**Actions:**

- Run Biome to lint and format all staged files
- Run TypeScript type checking
- Auto-stage any fixed files

```yaml
# lefthook.yml
pre-commit:
  parallel: true
  commands:
    biome-check:
      glob: '*.{js,jsx,ts,tsx,json,css,md}'
      run: bun run biome check --write {staged_files}
      stage_fixed: true

    type-check:
      glob: '*.{ts,tsx}'
      run: bunx tsc --noEmit
```

### Pre-Push (Runs Before git push)

**Actions:**

- Run all tests
- Run Tauri check (type check + build check)

```yaml
pre-push:
  parallel: true
  commands:
    test:
      run: bun run test:run

    tauri-check:
      run: bun run tauri:check
```

### Commit-Msg (Validates Commit Message)

**Actions:**

- Validate commit message follows conventional commits format

```yaml
commit-msg:
  commands:
    lint:
      run: bunx commitlint --edit {1}
```

## Conventional Commits

Commit messages must follow this format:

```
<type>(<scope>): <subject>

<body>

<footer>
```

### Allowed Types

| Type       | Description      | Example                               |
| ---------- | ---------------- | ------------------------------------- |
| `feat`     | New feature      | `feat(auth): add OAuth2 login`        |
| `fix`      | Bug fix          | `fix: resolve null reference error`   |
| `docs`     | Documentation    | `docs: update installation guide`     |
| `style`    | Formatting       | `style: fix indentation in App.tsx`   |
| `refactor` | Code refactoring | `refactor: simplify state management` |
| `perf`     | Performance      | `perf: reduce bundle size by 20%`     |
| `test`     | Tests            | `test: add unit tests for auth`       |
| `build`    | Build/deps       | `build: upgrade React to v19`         |
| `ci`       | CI/CD            | `ci: GitHub Actions workflow`         |
| `chore`    | Other            | `chore: update README`                |
| `revert`   | Revert previous  | `revert: fix broken login`            |

### Valid Examples

```bash
# Simple
git commit -m "feat: add dark mode"

# With scope
git commit -m "fix(auth): resolve token refresh bug"

# Multi-line
git commit -m "feat(api): add user search

- Added search endpoint
- Implemented pagination
- Added caching"
```

### Invalid Examples

```bash
# ❌ No type
git commit -m "Fixed a bug"

# ❌ Wrong type
git commit -m "added: new feature"

# ❌ Missing colon
git commit -m "feat add dark mode"
```

## Skipping Hooks

Skip all hooks:

```bash
git commit --no-verify -m "message"
```

Skip specific hook:

```bash
git commit --no-verify lefthook -m "message"
```

⚠️ **Warning:** Only skip hooks for emergency fixes. Always run checks manually before pushing.

## Manual Usage

Run hooks manually:

```bash
# Run pre-commit hooks
lefthook run pre-commit

# Run pre-push hooks
lefthook run pre-push

# Run commit-msg on existing commit
lefthook run commit-msg
```

## Advantages over Husky

| Feature            | Lefthook            | Husky                      |
| ------------------ | ------------------- | -------------------------- |
| **Side effects**   | None                | Hooks run on `npm install` |
| **Performance**    | Parallel execution  | Sequential                 |
| **Auto-stage**     | `stage_fixed: true` | Manual                     |
| **Cross-platform** | Native binary       | Node.js                    |
| **Single binary**  | Yes                 | No                         |

## Troubleshooting

### Hooks Not Running

Install hooks:

```bash
bun run lefthook
```

### Hooks Fail but You Want to Commit

Fix issues first:

```bash
bun run lint:fix
bun run test:run
```

Or skip hooks (not recommended):

```bash
git commit --no-verify
```

### Biome Not Found

Install Biome:

```bash
bun add -D @biomejs/biome
```

### Type Check Failures

Fix TypeScript errors:

```bash
bun run typecheck
```

## Configuration File

**Location:** `lefthook.yml` (project root)

Edit to customize hooks, add new commands, or change behavior.

## References

- [Lefthook Documentation](https://lefthook.dev)
- [Conventional Commits](https://www.conventionalcommits.org)
- [Commitlint](https://commitlint.js.org)
