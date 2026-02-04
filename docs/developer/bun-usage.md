# Bun Package Manager Usage

This project uses **Bun** as the default package manager for development and build operations, with **npm** as a fallback for specific Tauri CLI commands due to known compatibility issues.

## Quick Commands

```bash
# Install dependencies
bun install

# Run development server
bun dev

# Run tests
bun test
bun test:run

# Build application
bun build

# Run type checking
bun typecheck

# Lint and fix
bun lint
bun lint:fix

# Format code
bun format
bun format:check

# Run all checks (the quality gate)
bun check:all

# Fix all issues
bun fix:all
```

## Tauri CLI Commands

Due to [known issues](#known-issues) with Bun and Tauri CLI, some Tauri commands should use bun:

```bash
# ❌ AVOID: May fail
bun tauri add <package>
bun tauri android init

# ✅ USE: bun fallback
npm run tauri add <package>
npm run tauri android init
# OR
pnpm tauri add <package>
pnpm tauri android init
```

**Standard Tauri commands work fine with Bun:**

```bash
# ✅ These work correctly
bun tauri dev
bun tauri build
bun tauri check
```

## Lock File Strategy

This project uses **`yarn.lock`** instead of Bun's binary `bun.lockb` to avoid merge conflicts.

```bash
# Generate yarn.lock with Bun
bun install --yarn

# Install with yarn.lock
bun install
```

**Why yarn.lock instead of bun.lockb?**

- Text-based mergeable format (bun.lockb is binary)
- Cross-platform compatibility with non-Bun users
- Avoids merge conflict issues in Git
- Bun Q3 2025 will introduce text lockfile, but for now yarn.lock is the best option

## Bun-specific Features

### Performance

Bun is significantly faster than npm:

| Operation          | Bun  | npm    | Speedup |
| ------------------ | ---- | ------ | ------- |
| Install (50 deps)  | 0.8s | 14.3s  | **18×** |
| Install (200 deps) | 2.1s | 46.1s  | **22×** |
| Script startup     | ~6ms | ~170ms | **28×** |

### Lifecycle Scripts

**IMPORTANT:** Bun does NOT execute postinstall scripts by default for security.

If a package requires postinstall scripts (e.g., `sharp`, `@sentry/cli`), add it to `trustedDependencies` in `package.json`:

```json
{
  "trustedDependencies": ["sharp", "@sentry/cli"]
}
```

Then reinstall:

```bash
rm -rf node_modules
bun install
```

## Migration from npm

Converting npm scripts to Bun is straightforward:

| npm command     | Bun equivalent               |
| --------------- | ---------------------------- |
| `npm install`   | `bun install`                |
| `npm add <pkg>` | `bun add <pkg>`              |
| `npm run test`  | `bun test` or `bun run test` |
| `npx <pkg>`     | `bunx <pkg>`                 |
| `node <file>`   | `bun <file>`                 |

## Known Issues

### Tauri CLI Detection

Tauri CLI doesn't properly detect Bun as a package manager, causing failures with:

- `tauri add <package>`
- `tauri android init`
- `tauri ios dev` (iOS development on older Tauri versions)

**Solution:** Use bun for these specific commands.

### Windows-Specific Issues

- `bun tauri android init` fails on Windows with panic errors
- Workaround: Use bun for Android development on Windows

### Vite + esbuild Permission Error

When running `bun run tauri dev`, permission errors with esbuild binary may occur:

```
Error: spawn .../esbuild-darwin-arm64/bin/esbuild EACCES
```

**Solution:**

```bash
chmod +x node_modules/.bin/esbuild
bun run tauri dev
```

## Troubleshooting

### Lockfile Conflicts

If you encounter merge conflicts with `yarn.lock`:

1. Resolve conflicts manually (text-based, easy to merge)
2. Or regenerate: `rm yarn.lock && bun install --yarn`

### Native Modules Fail

If native bindings fail:

1. Check if package needs postinstall script
2. Add to `trustedDependencies` in package.json
3. Reinstall: `rm -rf node_modules && bun install`

### Tauri Build Fails

If Tauri build fails with Bun:

1. Try falling back to npm: `npm run tauri build`
2. Check for permission issues with node_modules
3. Ensure Rust dependencies are compiled: `source ~/.cargo/env && cd src-tauri && cargo build`

## Package Manager Script Reference

All scripts in `package.json` use `bun run` or `bun <command>` instead of `npm run`:

```json
{
  "scripts": {
    "dev": "vite", // bun dev
    "build": "tsc && vite build", // bun build
    "test": "vitest", // bun test
    "tauri:dev": "source ~/.cargo/env && tauri dev", // bun tauri:dev
    "check:all": "bun run typecheck && ..." // bun check:all
  }
}
```

## References

- [Bun Documentation](https://bun.sh/docs)
- [Bun Package Manager](https://bun.sh/docs/install/package-manager)
- [Tauri CLI + Bun Issues](https://github.com/tauri-apps/tauri/issues?q=bun)
- [Bun Text Lockfile (Coming Q3 2025)](https://github.com/oven-sh/bun/issues/4744)
