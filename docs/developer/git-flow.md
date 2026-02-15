# Git Flow Guide

This document defines the Git workflow for this project. All developers (human and AI) must follow these rules.

## Branching Strategy

### Branch Types

| Branch Type | Pattern | Purpose | Lifetime |
|-------------|---------|---------|----------|
| `main` | `main` | Production-ready code, source of releases | Permanent |
| `feature` | `feature/<ticket-id>-<short-desc>` | New features | Deleted after merge |
| `fix` | `fix/<ticket-id>-<short-desc>` | Bug fixes | Deleted after merge |
| `refactor` | `refactor/<ticket-id>-<short-desc>` | Code refactoring | Deleted after merge |
| `docs` | `docs/<short-desc>` | Documentation only | Deleted after merge |
| `chore` | `chore/<short-desc>` | Maintenance tasks | Deleted after merge |
| `hotfix` | `hotfix/<version>` | Emergency production fixes | Deleted after merge |

### Branch Naming Rules

```
<prefix>/<ticket-id>-<kebab-case-description>

Examples:
feature/MKY-123-add-user-authentication
fix/MKY-456-fix-login-crash
refactor/MKY-789-split-auth-module
docs/update-api-documentation
chore/upgrade-dependencies
hotfix/v1.2.1-security-patch
```

**Rules:**
- Use lowercase only
- Use kebab-case for descriptions
- Keep descriptions under 50 characters
- Include ticket ID if available (format: `MKY-XXX`)

## Commit Message Convention

### Format

```
<type>(<scope>): <subject>

[optional body]

[optional footer(s)]
```

### Types (from commitlint config)

| Type | Description | Example |
|------|-------------|---------|
| `feat` | New feature | `feat(auth): Add OAuth2 login support` |
| `fix` | Bug fix | `fix(api): Handle null response in user endpoint` |
| `docs` | Documentation only | `docs: Update installation instructions` |
| `style` | Code style (formatting, etc) | `style: Format imports with Biome` |
| `refactor` | Code refactoring | `refactor(hooks): Extract common logic to useAuth` |
| `perf` | Performance improvement | `perf(list): Virtualize long lists` |
| `test` | Adding/updating tests | `test(auth): Add unit tests for login flow` |
| `build` | Build system or dependencies | `build: Upgrade Tauri to v2.1.0` |
| `ci` | CI configuration | `ci: Add macOS universal build` |
| `chore` | Other changes | `chore: Update .gitignore` |
| `revert` | Revert previous commit | `revert: Revert "feat: Add OAuth2 login"` |

### Scope (Optional but Recommended)

Common scopes:
- `tauri` - Tauri/Rust backend changes
- `ui` - UI component changes
- `hooks` - React hooks
- `store` - Zustand store changes
- `api` - API/service layer
- `i18n` - Internationalization
- `routes` - Routing changes

### Subject Rules

1. **Sentence case**: First letter capitalized, rest lowercase
   - ✅ `feat: Add user authentication`
   - ❌ `feat: add user authentication`
   - ❌ `feat: ADD USER AUTHENTICATION`

2. **Imperative mood**: Use "Add" not "Added" or "Adds"
   - ✅ `fix: Resolve memory leak`
   - ❌ `fix: Resolved memory leak`

3. **No period at end**
   - ✅ `feat: Add new button`
   - ❌ `feat: Add new button.`

4. **Max 72 characters**

### Body (Optional)

- Separate from subject with blank line
- Explain what and why, not how
- Use bullet points for multiple changes

### Examples

```bash
# Simple feature
feat(ui): Add dark mode toggle

# With body
feat(auth): Implement session management

- Add automatic token refresh
- Handle session expiry gracefully
- Store session state in Zustand

Closes #123

# Breaking change
feat(api)!: Change user endpoint response format

BREAKING CHANGE: The user endpoint now returns a nested object
instead of flat properties. Update all consumers accordingly.

# Fix with issue reference
fix(tauri): Handle window close event properly

Fixes #456
```

## Pull Request Workflow

### Creating a PR

1. **Create branch from main**
   ```bash
   git checkout main
   git pull origin main
   git checkout -b feature/MKY-123-add-feature
   ```

2. **Make commits following convention**
   ```bash
   git add .
   git commit -m "feat: Add new feature"
   ```

3. **Push and create PR**
   ```bash
   git push -u origin feature/MKY-123-add-feature
   gh pr create --title "feat: Add new feature" --body "..."
   ```

### PR Title Format

PR title should match the main commit type:

```
<type>(<scope>): <description>

Examples:
feat: Add user authentication
fix: Resolve login crash
refactor: Split auth module
```

### PR Description Template

```markdown
## Summary
<!-- 1-3 bullet points describing the change -->

## Changes
<!-- List of specific changes -->

## Testing
<!-- How was this tested? -->

## Screenshots (if UI changes)
<!-- Before/after screenshots -->

## Checklist
- [ ] Tests pass (`bun run test:run`)
- [ ] Type check passes (`bun run typecheck`)
- [ ] Lint passes (`bun run lint`)
- [ ] Self-reviewed the code
```

### Merge Rules

1. **Squash and merge** for feature branches (single atomic commit)
2. **Rebase and merge** for branches with clean commit history
3. **Delete branch** after merge

## Git Hooks (Lefthook)

### Pre-commit (runs automatically)

```yaml
biome-check: # Runs on staged files
  - Fixes formatting issues
  - Stages fixed files automatically

type-check: # Runs on .ts/.tsx files
  - TypeScript type checking
```

**If pre-commit fails:**
1. Check the error message
2. Fix the issue manually or let Biome auto-fix
3. Stage the fixed files
4. Commit again

### Pre-push (runs automatically)

```yaml
test: # Runs all tests
  - bun run test:run

tauri-check: # Runs Tauri check
  - bun run tauri:check
```

**If pre-push fails:**
1. Fix failing tests
2. Run `bun run test:run` locally to verify
3. Push again

### Commit-msg (runs automatically)

```yaml
lint: # Validates commit message
  - commitlint checks format
```

**If commit-msg fails:**
1. Read the error from commitlint
2. Rewrite the commit message following convention
3. Commit again

## Release Process

### Automated Release (Recommended)

This project uses **Release-Please** for automated releases.

1. **Merge PRs with conventional commits** to `main`
   ```bash
   feat: Add new feature      # → Minor version bump (0.1.0 → 0.2.0)
   fix: Resolve bug           # → Patch bump (0.1.0 → 0.1.1)
   feat!: Breaking change     # → Major bump (0.1.0 → 1.0.0)
   ```

2. **Release-Please automatically:**
   - Creates/updates release PR
   - Bumps version in package.json, Cargo.toml, tauri.conf.json
   - Generates CHANGELOG.md
   - Creates GitHub release when PR is merged

3. **CI automatically:**
   - Builds for all platforms (macOS Intel/ARM, Windows, Linux)
   - Signs artifacts (if secrets configured)
   - Uploads to GitHub release
   - Generates `latest.json` for auto-updater

### Manual Release (Emergency Only)

```bash
# 1. Ensure clean state
bun run check:all

# 2. Create and push tag
git tag v1.0.0
git push origin v1.0.0

# 3. Wait for CI to build and create draft release
# 4. Review and publish the draft release on GitHub
```

## Version Bumping Rules

| Commit Type | Version Bump | Example |
|-------------|--------------|---------|
| `feat` | Minor | 0.1.0 → 0.2.0 |
| `fix` | Patch | 0.1.0 → 0.1.1 |
| `feat!` or `BREAKING CHANGE` | Major | 0.1.0 → 1.0.0 |
| `docs`, `style`, `refactor`, `test`, `chore` | None | - |

---

## AI Agent Rules

When making commits on behalf of a user, AI agents MUST follow these rules:

### 1. Commit Message Rules

```
ALWAYS use conventional commit format
ALWAYS use sentence case for subject
NEVER use lowercase subject start
NEVER end subject with period
NEVER commit without user permission (unless explicitly requested)
```

### 2. Branch Rules

```
ALWAYS create feature branch for changes
NEVER commit directly to main
NEVER force push to shared branches
```

### 3. Pre-commit Rules

```
ALWAYS verify hooks pass before claiming completion
IF hook fails → Fix and retry, do NOT bypass
IF Biome fixes issues → Stage fixed files and commit again
```

### 4. Commit Frequency

```
Commit after each logical unit of work
Group related changes in single commit
Separate unrelated changes into multiple commits
```

### 5. Commit Message Examples

```bash
# Feature
git commit -m "feat(ui): Add settings dialog"

# Fix
git commit -m "fix(tauri): Handle window resize event"

# With scope
git commit -m "feat(auth): Add OAuth2 login support"

# Breaking change
git commit -m "feat(api)!: Change user response format

BREAKING CHANGE: User endpoint returns nested object"

# Multiple changes (use body)
git commit -m "feat: Implement user preferences

- Add preferences dialog
- Persist settings to Rust backend
- Add theme selection
- Add language selection"
```

### 6. Forbidden Patterns

```bash
# ❌ NEVER do these
git commit -m "updates"              # Too vague
git commit -m "fix stuff"            # Not descriptive
git commit -m "WIP"                  # No context
git commit -m "Add feature."         # Period at end
git commit -m "add feature"          # Lowercase start
git commit --no-verify               # Bypassing hooks (unless explicitly allowed)
git push --force                     # Force push (unless explicitly requested)
```

---

## Quick Reference

### Daily Workflow

```bash
# Start new feature
git checkout main && git pull
git checkout -b feature/MKY-123-description

# Make changes and commit
git add .
git commit -m "feat: Add new feature"

# Push and create PR
git push -u origin feature/MKY-123-description
gh pr create

# After review, squash merge via GitHub UI
```

### Useful Commands

```bash
# Check what will be committed
git status
git diff --staged

# Amend last commit (before push)
git commit --amend

# Interactive rebase (clean up commits)
git rebase -i HEAD~3

# Check commit history
git log --oneline -10

# Undo last commit (keep changes)
git reset --soft HEAD~1

# Undo last commit (discard changes)
git reset --hard HEAD~1
```

### Troubleshooting

| Issue | Solution |
|-------|----------|
| Pre-commit fails | Let Biome auto-fix, stage fixed files, retry |
| Tests fail in pre-push | Run `bun run test:run` locally, fix, retry |
| Commit message rejected | Follow conventional commit format |
| Merge conflict | `git fetch`, `git rebase origin/main`, resolve conflicts |
| Accidentally committed to main | Create branch, `git cherry-pick` the commit |
