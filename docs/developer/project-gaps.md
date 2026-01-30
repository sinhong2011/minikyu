# Project Gaps & Next Steps

**Last Updated:** January 2026  
**Status:** Living document - update as features are implemented

This document tracks what's still needed to take this Tauri template from "excellent foundation" to "production-ready starter."

---

## Current State Summary

This template is **exceptionally well-architected** with comprehensive infrastructure:

- ✅ Modern stack (Tauri v2, React 19, TypeScript, Tailwind v4, shadcn/ui)
- ✅ File-based routing (TanStack Router) with type safety
- ✅ Three-layer state management (useState → Zustand → TanStack Query)
- ✅ Type-safe Rust-TypeScript bridge (tauri-specta)
- ✅ Command palette, quick pane, native menus, theme system
- ✅ Comprehensive static analysis (Biome, ast-grep, knip, jscpd)
- ✅ Git hooks (Lefthook + Commitlint)
- ✅ Automated releases (release-please)
- ✅ 70+ UI components, i18n support, cross-platform title bars
- ✅ Crash recovery, logging, notifications

**Remaining work focuses on production distribution, testing coverage, and polish.**

---

## Major Gaps (Production-Critical)

These block production use for real applications.

### 1. Tray Icon Support

**Status:** ❌ Not Implemented  
**Priority:** High  
**Effort:** Medium

Desktop apps need tray icons for background operation, quick access, and status indication.

**Implementation Notes:**
- Use `@tauri-apps/api/tray` (Tauri v2)
- Support all platforms (macOS/Windows/Linux)
- Add tray menu: Show, Hide, Quit, Preferences
- Consider tray states (active/inactive/default)
- Handle platform differences (macOS requires special handling for right-click)

**Reference:** [Tauri Tray Documentation](https://tauri.app/plugin/tray-icon/)

---

### 2. Code Signing & Distribution Setup

**Status:** ⚠️ Partial - Workflow exists, configuration missing  
**Priority:** High  
**Effort:** High

**Missing Configuration:**

| Item | Current | Required |
|------|---------|----------|
| macOS Signing Identity | `-` (ad-hoc) | Developer ID certificate |
| Windows Signing | None | Code signing certificate |
| Updater Public Key | `YOUR_UPDATER_PUBLIC_KEY_HERE` | Generated key pair |
| Update Endpoint | Placeholder URL | Real GitHub releases URL |
| TAURI_SIGNING_PRIVATE_KEY | Not set | Repository secret |
| TAURI_SIGNING_PRIVATE_KEY_PASSWORD | Not set | Repository secret |

**Why Required:**
- Bypass macOS Gatekeeper warnings
- Enable auto-updates (requires signed bundles)
- Windows SmartScreen compatibility
- Mac App Store submission (if desired)

**Setup Steps:**
1. Generate updater key pair: `bunx tauri signer generate`
2. Add private key to GitHub Secrets
3. Update `tauri.conf.json` with public key and endpoint
4. Obtain Apple Developer ID certificate for macOS
5. Obtain Windows code signing certificate (or use Azure Trusted Signing)
6. Update workflow environment variables

**Reference:** [Tauri Code Signing](https://tauri.app/distribute/Sign/)

---

### 3. User Guide Documentation

**Status:** ⚠️ Folder exists, content likely minimal  
**Priority:** High  
**Effort:** Medium

**Required Content:**
- `docs/userguide/getting-started.md` - Installation, first run
- `docs/userguide/features.md` - Feature overview
- `docs/userguide/keyboard-shortcuts.md` - Reference list
- `docs/userguide/troubleshooting.md` - Common issues and solutions
- `docs/userguide/updating.md` - How updates work

**Style Guide:**
- Target end users, not developers
- Include screenshots
- Step-by-step instructions
- Platform-specific notes where relevant

---

## Medium Priority Gaps

Important for quality and maintainability but not blocking.

### 4. E2E Test Coverage

**Status:** ⚠️ Setup exists (Playwright), limited tests  
**Priority:** Medium-High  
**Effort:** Medium-High

**Current Tests:**
- ✅ `resize-panel.spec.ts`
- ✅ `sidebar.spec.ts`

**Missing Coverage:**
- ⬜ Command palette (Cmd+K) - open, search, select, keyboard nav
- ⬜ Quick pane (Cmd+Shift+.) - global shortcut, overlay behavior
- ⬜ Preferences dialog - open, modify, save, persistence
- ⬜ Theme switching - light/dark/system, persistence
- ⬜ Native menus - File, Edit, View menu actions
- ⬜ Error handling - error boundaries, toast notifications
- ⬜ Cross-platform - verify behavior on macOS/Windows/Linux

**Implementation Pattern:**
```typescript
// Use Tauri Playwright integration
import { test, expect } from '@playwright/test';

test('command palette opens with Cmd+K', async ({ page }) => {
  await page.keyboard.press('Meta+k');
  await expect(page.locator('[role="dialog"]')).toBeVisible();
});
```

---

### 5. CI/CD Pipeline for Pull Requests

**Status:** ⚠️ Release workflow exists, no PR validation  
**Priority:** Medium  
**Effort:** Medium

**Create `.github/workflows/ci.yml`:**

```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  quality-gates:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Setup Bun
        uses: oven-sh/setup-bun@v1
      - name: Setup Rust
        uses: dtolnay/rust-toolchain@stable
      - name: Install dependencies
        run: bun install
      - name: Type check
        run: bun run typecheck
      - name: Lint
        run: bun run lint
      - name: Format check
        run: bun run format:check
      - name: AST lint
        run: bun run ast:lint
      - name: Unit tests
        run: bun run test:run
      - name: Rust tests
        run: bun run rust:test
      - name: Rust clippy
        run: bun run rust:clippy
```

**Consider Adding:**
- Security scanning (cargo-audit, npm audit)
- Bundle size tracking
- Performance regression tests
- Dependency update automation (Dependabot)

---

### 6. Error Boundary Robustness

**Status:** ⚠️ Component exists, needs verification  
**Priority:** Medium  **Effort:** Low-Medium

**Verify Coverage:**
- ✅ Global error boundary in `App.tsx`
- ⬜ Route-level error boundaries (TanStack Router)
- ⬜ Component-level error boundaries for critical UI
- ⬜ Error reporting integration (Sentry, etc.)

**Pattern to Follow:**
```typescript
// src/components/ErrorBoundary.tsx
export class ErrorBoundary extends React.Component {
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // Log to error reporting service
    logError(error, errorInfo);
  }
}
```

---

### 7. Accessibility Testing

**Status:** 📝 Not assessed  
**Priority:** Medium  **Effort:** Low-Medium

**Why Important:** shadcn/ui components are accessible by default, but custom code may introduce issues.

**Tools:**
- axe DevTools browser extension (manual)
- `@axe-core/react` (automated in tests)
- pa11y (CI integration)
- Manual keyboard navigation testing

**Checklist:**
- [ ] All interactive elements keyboard accessible
- [ ] Focus indicators visible
- [ ] ARIA labels on icon-only buttons
- [ ] Color contrast meets WCAG AA
- [ ] Screen reader navigation works

---

## Low Priority / Nice-to-Have

Enhancements for future iterations.

### 8. SQLite Database Integration

**Status:** 📝 Mentioned in docs, not implemented  
**Priority:** Low  **Effort:** High

**Use Cases:**
- Local data persistence beyond JSON
- Complex queries
- Migration system

**Implementation:**
- Add `rusqlite` to `Cargo.toml`
- Create database abstraction layer
- Setup migrations system
- Add TanStack Query integration

**Reference:** [docs/developer/data-persistence.md](./data-persistence.md)

---

### 9. Analytics & Telemetry

**Status:** 📝 Not implemented  
**Priority:** Low  **Effort:** Medium

**Requirements:**
- Privacy-first design
- Opt-in/opt-out in preferences
- Minimal data collection
- Crash/error reporting

**Options:**
- PostHog (self-hostable)
- Plausible (privacy-focused)
- Custom lightweight solution

**Pattern:**
```rust
// src-tauri/src/commands/analytics.rs
#[tauri::command]
#[specta::specta]
pub async fn track_event(event: String, properties: JsonValue) -> Result<(), String> {
    // Send to analytics provider if enabled
}
```

---

### 10. Feature Flags System

**Status:** 📝 Not implemented  
**Priority:** Low  **Effort:** Medium

**Use Cases:**
- Gradual feature rollouts
- A/B testing
- Premium feature gating

**Implementation:**
- Rust command to check flags
- React hook: `useFeatureFlag('new-ui')`
- External source (PostHog, LaunchDarkly, or config file)

---

### 11. Performance Monitoring

**Status:** 📝 Not implemented  
**Priority:** Low  **Effort:** Medium

**Metrics to Track:**
- App startup time
- Command execution latency
- React render performance
- Memory usage

**Tools:**
- Sentry Performance
- Custom metrics collection
- React Profiler API

---

### 12. Platform-Specific Enhancements

**macOS:**
- ⬜ Touch Bar support (legacy but some Macs still have it)
- ✅ Window vibrancy (implemented)
- ⬜ Native tabbing

**Windows:**
- ⬜ Jump List (recent files in taskbar)
- ⬜ Taskbar progress indicator
- ⬜ Notification badges

**Linux:**
- ⬜ Desktop entry validation
- ⬜ AppIndicator support for tray

**All Platforms:**
- ⬜ Deep links / URL scheme handling
- ⬜ File type associations
- ⬜ Drag-and-drop improvements

---

## Configuration Updates (Trivial)

### 13. Metadata & Branding

**Files to Update:**

| File | Fields to Update |
|------|------------------|
| `tauri.conf.json` | `productName`, `identifier`, `publisher`, `copyright` |
| `package.json` | `name`, `author`, `copyright` |
| `Cargo.toml` | `name`, `description`, `authors` |
| `README.md` | Repository URLs, your name, screenshots |
| `src-tauri/icons/` | Replace with your app icons |

**Icon Requirements:**
- macOS: `icon.icns` (multiple sizes)
- Windows: `icon.ico` (multiple sizes)
- Linux: PNG files (32x32, 128x128, 128x128@2x)

---

## Quick Wins (1-2 Hours Each)

High-value, low-effort improvements:

1. **Create `CHANGELOG.md` template**
   - Follow Keep a Changelog format
   - Link to release-please output

2. **Add `.vscode/` settings**
   - Recommended extensions
   - Format on save
   - Debug configurations

3. **Add `AUTHORS.md` or `CONTRIBUTORS.md`**
   - Attribution for template users

4. **Document the MCP Bridge integration**
   - Optional feature in `Cargo.toml`
   - Setup instructions if enabled

5. **Create issue templates**
   - Bug report
   - Feature request
   - Question

6. **Add PR template**
   - Checklist for contributors
   - Testing requirements

---

## Action Plan

### Phase 1: Production Ready (Week 1-2)
1. Implement tray icon
2. Configure code signing (obtain certificates)
3. Setup updater (generate keys, configure endpoint)
4. Write user guide documentation
5. Update all metadata/branding

### Phase 2: Quality Assurance (Week 3-4)
6. Add comprehensive E2E tests
7. Create CI pipeline for PRs
8. Verify error boundaries
9. Run accessibility audit

### Phase 3: Polish (Week 5+)
10. Implement quick wins (CHANGELOG, VS Code settings, etc.)
11. Add analytics (optional)
12. Add feature flags (optional)
13. Enhance platform-specific features

---

## Decision Log

| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-01 | SQLite deferred | JSON-based preferences sufficient for most use cases |
| 2026-01 | Analytics optional | Privacy-first approach, opt-in required |
| 2026-01 | E2E prioritized over unit tests | Desktop app behavior best tested end-to-end |

---

## Related Documentation

- [Architecture Guide](./architecture-guide.md)
- [Tauri Commands](./tauri-commands.md)
- [State Management](./state-management.md)
- [Testing](./testing.md)
- [Releases](./releases.md)

---

**Update this document as features are implemented.**
