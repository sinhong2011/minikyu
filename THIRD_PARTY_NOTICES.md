# Third-Party Notices

This project is licensed under the [MIT License](./LICENSE.md).

This file records third-party licensing information and audit notes for dependencies used by Minikyu.

## Audit Metadata

- Audit date: 2026-03-04 (Asia/Hong_Kong)
- Package managers audited: Bun (`node_modules`) and Cargo (`cargo metadata --locked`)
- Scope: runtime + development dependencies currently resolved in this workspace

## Manual Verification Records

The following dependencies required manual verification because package metadata was incomplete during automated scanning.

### `tauri-nspanel` (Rust git dependency)

- Dependency location: `src-tauri/Cargo.toml` (git dependency on `ahkohd/tauri-nspanel`, branch `v2.1`)
- Cargo metadata license field: missing (`UNKNOWN`)
- Verified evidence:
  - `~/.cargo/git/checkouts/tauri-nspanel-*/da9c9a8/LICENSE_MIT`
  - `~/.cargo/git/checkouts/tauri-nspanel-*/da9c9a8/LICENSE_APACHE-2.0`
  - `~/.cargo/git/checkouts/tauri-nspanel-*/da9c9a8/README.md` states: "MIT or MIT/Apache 2.0 where applicable."
- Working assumption for compliance tracking: MIT and/or Apache-2.0

### `@ast-grep/cli` (JavaScript dev dependency wrapper)

- Package metadata (`@ast-grep/cli`): no `license` field (`UNKNOWN`)
- Verified evidence:
  - Platform package in this environment: `@ast-grep/cli-darwin-arm64` declares `"license": "MIT"`
  - Upstream repository: `https://github.com/ast-grep/ast-grep`
- Working assumption for compliance tracking: MIT (via platform package)

### `cli-table` (transitive JavaScript dependency)

- Package metadata (`cli-table`): no `license` field in `package.json`
- Verified evidence:
  - `node_modules/cli-table/LICENSE` contains MIT License text
- Working assumption for compliance tracking: MIT

## Notable Non-MIT Licenses Found

These are commonly used permissive or weak-copyleft licenses but should still be included in third-party notice review.

- `dompurify` - `(MPL-2.0 OR Apache-2.0)`
- `lightningcss` (and platform package) - `MPL-2.0`
- `@fontsource-variable/figtree` - `OFL-1.1`
- `caniuse-lite` - `CC-BY-4.0`

## Distribution Checklist

- Keep this file in release artifacts where practical.
- Preserve upstream license files for dependencies when required by their terms.
- Re-run license audit after dependency upgrades.
