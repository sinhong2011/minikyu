# Release Automation with Release-Please

This project uses **Release-Please** for automated version bumping, changelog generation, and GitHub releases.

## How It Works

Release-Please automatically:

1. Analyzes commit messages since the last release
2. Determines version bump based on conventional commits
3. Creates a release PR with version updates
4. Merging the PR triggers: version tags + GitHub release + Tauri build

## Workflow

### 1. Write Conventional Commits

All commits must follow conventional commit format:

```bash
# Features (minor version)
git commit -m "feat: add dark mode"
git commit -m "feat(auth): add OAuth2 login"

# Bug fixes (patch version)
git commit -m "fix: resolve null reference error"

# Breaking changes (major version)
git commit -m "feat!: remove legacy API"
git commit -m "fix!: breaking change in auth flow"

# Other types (no version bump)
git commit -m "docs: update README"
git commit -m "chore: upgrade dependencies"
```

### 2. Push to Main Branch

```bash
git push origin main
```

Release-Please GitHub Action runs automatically on every push to `main`.

### 3. Release PR Created

When enough commits are accumulated for a release, Release-Please creates a PR:

```
Release: v0.2.0

## What's Changed

Features:
- Add dark mode by @username
- Add OAuth2 login by @username

Bug Fixes:
- Fix null reference error by @username
```

### 4. Review and Merge

Review the release PR and merge it.

### 5. Automatic Release

On merge:

- Version tags (e.g., `v0.2.0`)
- GitHub release with changelog
- Tauri builds for macOS, Windows, Linux
- Assets uploaded to GitHub release

## Version Bumping Rules

| Commit Type                          | Version Bump          | Example                  |
| ------------------------------------ | --------------------- | ------------------------ |
| `fix:`                               | patch (0.1.0 → 0.1.1) | `fix: bug fix`           |
| `feat:`                              | minor (0.1.0 → 0.2.0) | `feat: new feature`      |
| `feat!:`, `fix!:`, `BREAKING CHANGE` | major (0.1.0 → 1.0.0) | `feat!: breaking change` |

For versions before 1.0.0, Breaking Changes → minor, feat → patch (configurable).

## Manual Version Override

Force a specific version:

```bash
git commit --allow-empty -m "chore: release 2.0.0" -m "Release-As: 2.0.0"
```

## Configuration

**GitHub Workflow:** `.github/workflows/release-please.yml`

- Runs on push to main
- Creates release PRs
- Builds Tauri on release

**Config File:** `.release-please.json`

```json
{
  "packages": {
    ".": {
      "release-type": "node",
      "package-name": "tauri-template",
      "changelog-path": "CHANGELOG.md",
      "extra-files": ["src-tauri/tauri.conf.json", "src-tauri/Cargo.toml"]
    }
  }
}
```

## Files Updated on Release

Release-Please automatically updates:

- `package.json` → `version` field
- `package-lock.json` (if exists, but we use yarn.lock)
- `yarn.lock` → updated with new version
- `CHANGELOG.md` → new release entry
- `src-tauri/tauri.conf.json` → `version` field
- `src-tauri/Cargo.toml` → `version` field

## Changelog Sections

Generated changelog includes:

```markdown
## [0.2.0](https://github.com/user/repo/compare/v0.1.0...v0.2.0) (2025-01-22)

### Features

- Add dark mode ([abc123](...))
- Add OAuth2 login ([def456](...))

### Bug Fixes

- Fix null reference error ([ghi789](...))

### Documentation

- Update installation guide ([jkl012](...))
```

## Skipping Release

If you want to push changes without triggering release:

Add `release-please:skip` label to your PR before merging.

## Local Testing

To test locally without pushing:

```bash
# Install release-please globally
bun add -g release-please

# Dry run
release-please manifest-pr \
  --token=$GITHUB_TOKEN \
  --repo-url=user/repo \
  --release-type=node

# Create release PR
release-please release-pr \
  --token=$GITHUB_TOKEN \
  --repo-url=user/repo \
  --release-type=node
```

## Troubleshooting

### Release PR Not Created

1. Check commit messages follow conventional commits
2. Ensure no breaking errors in the workflow logs
3. Verify GitHub Actions permissions (contents: write, pull-requests: write)

### Version Not Bumping

1. All commits since last release must have conventional types
2. Check if `release-please:skip` label is on PR
3. Verify `.release-please.json` configuration

### Build Fails Release

1. Check workflow logs on GitHub Actions
2. Verify Tauri builds locally: `bun run tauri:build`
3. Ensure secrets are configured (GITHUB_TOKEN is auto-provided)

## Migration from Manual Release Script

**Old way:**

```bash
node scripts/prepare-release.js
# Manual version bump
# Manual git tagging
# Manual GitHub release
```

**New way:**

```bash
# Just commit with conventional messages
git commit -m "feat: add feature"
git push
# Automation handles everything
```

## References

- [Release-Please Documentation](https://github.com/googleapis/release-please)
- [Conventional Commits](https://www.conventionalcommits.org)
- [GitHub Action](https://github.com/googleapis/release-please-action)
