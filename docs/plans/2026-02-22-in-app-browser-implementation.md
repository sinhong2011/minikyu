# In-App Browser Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** When a user clicks the article title (h1) in EntryReading, load the original URL in a native Tauri child webview that replaces the reader content in the right column, with sidebar auto-hiding.

**Architecture:** Tauri v2 child webview (`window.add_child`) positioned at the browser content pane's DOM coordinates. React tracks the pane rect via `ResizeObserver` and keeps the webview in sync. State is managed through the existing Zustand UIStore with two new fields. A new `useInAppBrowser` hook encapsulates all browser lifecycle logic. **IMPORTANT: All implementation must be done in a git worktree, not on main branch.**

**Tech Stack:** Rust (Tauri v2 child webview API), React 19, TypeScript, Zustand, `motion/react`, `useLingui` for i18n, Vitest + testing-library for React tests

> **Tauri script injection note:** Theme sync uses `Webview::eval()` — Tauri's official API method for executing JavaScript in a child webview. This is distinct from the JavaScript `eval()` function; in the code below it is written as `WEBVIEW_EXEC_JS!(webview, script)` as a placeholder — replace with `webview.eval(&script)` in the actual Rust file.

---

## Pre-flight: Create Worktree

Before writing any code, create an isolated worktree:

```bash
git worktree add .worktrees/feature-in-app-browser -b feature/in-app-browser
cd .worktrees/feature-in-app-browser
```

All subsequent work happens in `.worktrees/feature-in-app-browser/`.

---

## Task 1: Rust commands — `in_app_browser.rs`

**Files:**
- Create: `src-tauri/src/commands/in_app_browser.rs`

Provides 4 Tauri commands. The webview is identified by the constant label `"in-app-browser"`. All position/size values are logical pixels (directly from `getBoundingClientRect()`).

**Step 1: Create the file**

```rust
//! In-app browser commands.
//!
//! Manages a native child webview (WKWebView on macOS) that renders external
//! article URLs within the main application window. The webview is positioned
//! programmatically at the coordinates of the React browser pane element.

use tauri::{AppHandle, LogicalPosition, LogicalSize, Manager};

/// Label used to identify the browser child webview across all commands.
const BROWSER_LABEL: &str = "in-app-browser";

/// Opens an in-app browser webview at the given logical-pixel bounds.
///
/// If a browser webview is already open, navigates it to the new URL and
/// updates its bounds. Otherwise creates a new child webview attached to
/// the main window.
///
/// `x`, `y`, `width`, `height` are CSS logical pixels from
/// `getBoundingClientRect()` — no devicePixelRatio scaling needed.
#[tauri::command]
#[specta::specta]
pub async fn open_in_app_browser(
    app: AppHandle,
    url: String,
    x: f64,
    y: f64,
    width: f64,
    height: f64,
    is_dark: bool,
) -> Result<(), String> {
    let parsed_url = url
        .parse::<tauri::Url>()
        .map_err(|e| format!("Invalid URL: {e}"))?;

    if let Some(webview) = app.get_webview(BROWSER_LABEL) {
        // Reuse existing webview: update URL and position.
        webview
            .navigate(parsed_url)
            .map_err(|e| format!("Navigate failed: {e}"))?;
        webview
            .set_bounds(tauri::Rect {
                position: LogicalPosition::new(x, y).into(),
                size: LogicalSize::new(width, height).into(),
            })
            .map_err(|e| format!("set_bounds failed: {e}"))?;
    } else {
        // Create a new child webview attached to the main window.
        let window = app
            .get_window("main")
            .ok_or("Main window not found")?;

        window
            .add_child(
                tauri::webview::WebviewBuilder::new(
                    BROWSER_LABEL,
                    tauri::WebviewUrl::External(parsed_url),
                ),
                LogicalPosition::new(x, y),
                LogicalSize::new(width, height),
            )
            .map_err(|e| format!("Failed to create browser webview: {e}"))?;
    }

    // Apply initial theme. Use Tauri's Webview::eval() method to inject
    // a one-liner that sets the CSS color-scheme property.
    // Replace WEBVIEW_EXEC_JS! with: webview.eval(&script)
    let color_scheme = if is_dark { "dark" } else { "light" };
    if let Some(webview) = app.get_webview(BROWSER_LABEL) {
        let script = format!("document.documentElement.style.colorScheme = '{color_scheme}'");
        let _ = WEBVIEW_EXEC_JS!(webview, script); // → webview.eval(&script)
    }

    log::info!("In-app browser opened: {url}");
    Ok(())
}

/// Closes and destroys the in-app browser webview if it exists.
#[tauri::command]
#[specta::specta]
pub async fn close_in_app_browser(app: AppHandle) -> Result<(), String> {
    if let Some(webview) = app.get_webview(BROWSER_LABEL) {
        webview
            .close()
            .map_err(|e| format!("Failed to close browser webview: {e}"))?;
        log::info!("In-app browser closed");
    }
    Ok(())
}

/// Updates the position and size of the browser webview.
///
/// Called by the React ResizeObserver whenever the browser pane changes size.
#[tauri::command]
#[specta::specta]
pub async fn resize_browser_webview(
    app: AppHandle,
    x: f64,
    y: f64,
    width: f64,
    height: f64,
) -> Result<(), String> {
    if let Some(webview) = app.get_webview(BROWSER_LABEL) {
        webview
            .set_bounds(tauri::Rect {
                position: LogicalPosition::new(x, y).into(),
                size: LogicalSize::new(width, height).into(),
            })
            .map_err(|e| format!("resize_browser_webview set_bounds failed: {e}"))?;
    }
    Ok(())
}

/// Synchronises the browser webview's color scheme with the app theme.
///
/// Uses Tauri's Webview::eval() method to set colorScheme on the page root.
/// Replace WEBVIEW_EXEC_JS! with: webview.eval(&script)
#[tauri::command]
#[specta::specta]
pub async fn sync_browser_theme(app: AppHandle, is_dark: bool) -> Result<(), String> {
    if let Some(webview) = app.get_webview(BROWSER_LABEL) {
        let color_scheme = if is_dark { "dark" } else { "light" };
        let script = format!("document.documentElement.style.colorScheme = '{color_scheme}'");
        WEBVIEW_EXEC_JS!(webview, script) // → webview.eval(&script).map_err(...)
            .map_err(|e| format!("sync_browser_theme failed: {e}"))?;
    }
    Ok(())
}
```

> **Replace `WEBVIEW_EXEC_JS!(webview, script)` with the actual Tauri API call:**
> ```rust
> webview.eval(&script)
> ```
> This is Tauri's `Webview::eval()` method — Tauri's official API for executing
> a JavaScript string in a child webview. It is not the JavaScript `eval()` function.

**Step 2: Verify compilation (expect errors — module not registered yet)**

```bash
cd src-tauri && cargo build --lib 2>&1 | grep "^error" | head -10
```

---

## Task 2: Register the module and commands

**Files:**
- Modify: `src-tauri/src/commands/mod.rs`
- Modify: `src-tauri/src/bindings.rs`

**Step 1: Add module to `mod.rs`**

After `pub mod tray;` in `src-tauri/src/commands/mod.rs`, add:

```rust
pub mod in_app_browser;
```

**Step 2: Update the use statement in `bindings.rs`**

Change:
```rust
use crate::commands::{
    accounts, counters, data, downloads, miniflux, notifications, preferences, quick_pane,
    reading_state, recovery, sync, tray,
};
```
To:
```rust
use crate::commands::{
    accounts, counters, data, downloads, in_app_browser, miniflux, notifications, preferences,
    quick_pane, reading_state, recovery, sync, tray,
};
```

**Step 3: Add 4 commands to `collect_commands![]`**

At the end of the list (before the closing `]`), add:

```rust
        in_app_browser::open_in_app_browser,
        in_app_browser::close_in_app_browser,
        in_app_browser::resize_browser_webview,
        in_app_browser::sync_browser_theme,
```

**Step 4: Verify clean compilation**

```bash
cd src-tauri && cargo build --lib 2>&1 | grep "^error" | head -10
```

Expected: zero lines of output (no errors).

**Step 5: Commit**

```bash
git add src-tauri/src/commands/in_app_browser.rs \
        src-tauri/src/commands/mod.rs \
        src-tauri/src/bindings.rs
git commit -m "feat(tauri): Add in-app browser Rust commands"
```

---

## Task 3: Regenerate TypeScript bindings

**Step 1: Run codegen**

```bash
bun run codegen:tauri
```

**Step 2: Verify the 4 new functions appear**

```bash
grep -n "openInAppBrowser\|closeInAppBrowser\|resizeBrowserWebview\|syncBrowserTheme" \
  src/lib/bindings.ts
```

Expected: 4 lines found.

**Step 3: Commit**

```bash
git add src/lib/bindings.ts
git commit -m "chore: Regenerate TypeScript bindings for in-app browser commands"
```

---

## Task 4: UIStore — add `inAppBrowserUrl` state

**Files:**
- Modify: `src/store/ui-store.ts`
- Create/modify: `src/store/ui-store.test.ts`

**Step 1: Write the failing test**

Add to `src/store/ui-store.test.ts` (create if needed):

```typescript
import { beforeEach, describe, expect, it } from 'vitest'
import { useUIStore } from './ui-store'

describe('useUIStore — inAppBrowserUrl', () => {
  beforeEach(() => {
    useUIStore.setState({ inAppBrowserUrl: null })
  })

  it('starts with null inAppBrowserUrl', () => {
    expect(useUIStore.getState().inAppBrowserUrl).toBeNull()
  })

  it('setInAppBrowserUrl sets a URL', () => {
    useUIStore.getState().setInAppBrowserUrl('https://example.com')
    expect(useUIStore.getState().inAppBrowserUrl).toBe('https://example.com')
  })

  it('setInAppBrowserUrl(null) clears the URL', () => {
    useUIStore.getState().setInAppBrowserUrl('https://example.com')
    useUIStore.getState().setInAppBrowserUrl(null)
    expect(useUIStore.getState().inAppBrowserUrl).toBeNull()
  })
})
```

**Step 2: Run test (expect failure)**

```bash
bun run test src/store/ui-store.test.ts
```

Expected: FAIL — `setInAppBrowserUrl is not a function`.

**Step 3: Add state to `ui-store.ts`**

In the `UIState` interface, after `zenModeEntryId: string | null;`:

```typescript
  inAppBrowserUrl: string | null;
  setInAppBrowserUrl: (url: string | null) => void;
```

In the initial state object, after `zenModeEntryId: null,`:

```typescript
          inAppBrowserUrl: null,
```

In the actions section, after the `setZenModeEntryId` action:

```typescript
          setInAppBrowserUrl: (url: string | null) =>
            set({ inAppBrowserUrl: url }, undefined, 'setInAppBrowserUrl'),
```

**Step 4: Run test (expect pass)**

```bash
bun run test src/store/ui-store.test.ts
```

Expected: 3 tests PASS.

**Step 5: Commit**

```bash
git add src/store/ui-store.ts src/store/ui-store.test.ts
git commit -m "feat(store): Add inAppBrowserUrl state to UIStore"
```

---

## Task 5: Create `useInAppBrowser` hook

**Files:**
- Create: `src/hooks/use-in-app-browser.ts`
- Create: `src/hooks/use-in-app-browser.test.ts`

**Step 1: Write the failing test**

Create `src/hooks/use-in-app-browser.test.ts`:

```typescript
import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useUIStore } from '@/store/ui-store'

vi.mock('@/lib/tauri-bindings', () => ({
  commands: {
    openInAppBrowser: vi.fn().mockResolvedValue(undefined),
    closeInAppBrowser: vi.fn().mockResolvedValue(undefined),
    resizeBrowserWebview: vi.fn().mockResolvedValue(undefined),
    syncBrowserTheme: vi.fn().mockResolvedValue(undefined),
  },
}))

vi.mock('@tauri-apps/api/window', () => ({
  getCurrentWindow: () => ({
    theme: vi.fn().mockResolvedValue('light'),
    onThemeChanged: vi.fn().mockResolvedValue(vi.fn()),
  }),
}))

import { useInAppBrowser } from './use-in-app-browser'

describe('useInAppBrowser', () => {
  beforeEach(() => {
    useUIStore.setState({ inAppBrowserUrl: null, leftSidebarVisible: true })
  })

  it('closeBrowser clears inAppBrowserUrl', async () => {
    const { result } = renderHook(() => useInAppBrowser())
    useUIStore.setState({ inAppBrowserUrl: 'https://example.com' })

    await act(async () => {
      await result.current.closeBrowser()
    })

    expect(useUIStore.getState().inAppBrowserUrl).toBeNull()
  })

  it('closeBrowser restores sidebar visibility', async () => {
    const { result } = renderHook(() => useInAppBrowser())
    useUIStore.setState({ leftSidebarVisible: false })

    await act(async () => {
      await result.current.closeBrowser()
    })

    expect(useUIStore.getState().leftSidebarVisible).toBe(true)
  })
})
```

**Step 2: Run test (expect failure)**

```bash
bun run test src/hooks/use-in-app-browser.test.ts
```

Expected: FAIL — module not found.

**Step 3: Create the hook**

Create `src/hooks/use-in-app-browser.ts`:

```typescript
import { getCurrentWindow } from '@tauri-apps/api/window'
import { useCallback, useEffect, useRef } from 'react'
import { commands } from '@/lib/tauri-bindings'
import { useUIStore } from '@/store/ui-store'

// Duration matching the shadcn SidebarProvider CSS transition.
const SIDEBAR_ANIMATION_MS = 250

export function useInAppBrowser() {
  const setInAppBrowserUrl = useUIStore((state) => state.setInAppBrowserUrl)
  const setLeftSidebarVisible = useUIStore((state) => state.setLeftSidebarVisible)
  const inAppBrowserUrl = useUIStore((state) => state.inAppBrowserUrl)

  // Ref to the browser content pane div. InAppBrowserPane assigns this ref
  // so we can read its getBoundingClientRect() after the sidebar animates.
  const browserContentRef = useRef<HTMLDivElement | null>(null)

  /**
   * Opens the browser for the given URL.
   * Hides the sidebar, then after the CSS transition completes reads the
   * pane rect and calls the Tauri open command.
   */
  const openBrowser = useCallback(
    (url: string) => {
      setInAppBrowserUrl(url)
      setLeftSidebarVisible(false)

      setTimeout(() => {
        const el = browserContentRef.current
        if (!el) return
        const rect = el.getBoundingClientRect()
        getCurrentWindow()
          .theme()
          .then((theme) =>
            commands.openInAppBrowser(
              url,
              rect.left,
              rect.top,
              rect.width,
              rect.height,
              theme === 'dark'
            )
          )
          .catch((err) => console.error('[useInAppBrowser] open failed:', err))
      }, SIDEBAR_ANIMATION_MS)
    },
    [setInAppBrowserUrl, setLeftSidebarVisible]
  )

  /** Closes the browser and restores the sidebar. */
  const closeBrowser = useCallback(async () => {
    try {
      await commands.closeInAppBrowser()
    } catch (err) {
      console.error('[useInAppBrowser] close failed:', err)
    }
    setInAppBrowserUrl(null)
    setLeftSidebarVisible(true)
  }, [setInAppBrowserUrl, setLeftSidebarVisible])

  // ESC and Cmd/Ctrl+W close the browser when it is open.
  useEffect(() => {
    if (!inAppBrowserUrl) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        closeBrowser()
      }
      if (e.key === 'w' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        closeBrowser()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [inAppBrowserUrl, closeBrowser])

  // Sync OS theme changes into the browser webview.
  useEffect(() => {
    if (!inAppBrowserUrl) return

    let unlistenFn: (() => void) | undefined

    getCurrentWindow()
      .theme()
      .then((initial) => {
        commands.syncBrowserTheme(initial === 'dark').catch(() => {})
        return getCurrentWindow().onThemeChanged(({ payload }) => {
          commands.syncBrowserTheme(payload === 'dark').catch(() => {})
        })
      })
      .then((unlisten) => {
        unlistenFn = unlisten
      })
      .catch(() => {})

    return () => {
      unlistenFn?.()
    }
  }, [inAppBrowserUrl])

  return { openBrowser, closeBrowser, browserContentRef, inAppBrowserUrl }
}
```

**Step 4: Run test (expect pass)**

```bash
bun run test src/hooks/use-in-app-browser.test.ts
```

Expected: 2 tests PASS.

**Step 5: Commit**

```bash
git add src/hooks/use-in-app-browser.ts src/hooks/use-in-app-browser.test.ts
git commit -m "feat(hook): Add useInAppBrowser lifecycle hook"
```

---

## Task 6: Create `InAppBrowserPane` component

**Files:**
- Create: `src/components/miniflux/InAppBrowserPane.tsx`
- Create: `src/components/miniflux/InAppBrowserPane.test.tsx`

**Step 1: Write the failing test**

Create `src/components/miniflux/InAppBrowserPane.test.tsx`:

```typescript
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type React from 'react'

vi.mock('@/lib/tauri-bindings', () => ({
  commands: {
    resizeBrowserWebview: vi.fn().mockResolvedValue(undefined),
  },
}))

import { InAppBrowserPane } from './InAppBrowserPane'

describe('InAppBrowserPane', () => {
  it('renders the URL in the toolbar', () => {
    render(
      <InAppBrowserPane
        url="https://example.com/article"
        onClose={vi.fn()}
        browserContentRef={{ current: null } as React.RefObject<HTMLDivElement>}
      />
    )
    expect(screen.getByText('https://example.com/article')).toBeInTheDocument()
  })

  it('calls onClose when the close button is clicked', async () => {
    const onClose = vi.fn()
    render(
      <InAppBrowserPane
        url="https://example.com"
        onClose={onClose}
        browserContentRef={{ current: null } as React.RefObject<HTMLDivElement>}
      />
    )
    await userEvent.click(screen.getByRole('button', { name: /close/i }))
    expect(onClose).toHaveBeenCalledOnce()
  })
})
```

**Step 2: Run test (expect failure)**

```bash
bun run test src/components/miniflux/InAppBrowserPane.test.tsx
```

Expected: FAIL — module not found.

**Step 3: Create the component**

Create `src/components/miniflux/InAppBrowserPane.tsx`:

```typescript
import { Cancel01Icon } from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { msg } from '@lingui/core/macro'
import { useLingui } from '@lingui/react'
import { useEffect, type RefObject } from 'react'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipPanel, TooltipTrigger } from '@/components/ui/tooltip'
import { commands } from '@/lib/tauri-bindings'
import { cn } from '@/lib/utils'

interface InAppBrowserPaneProps {
  url: string
  onClose: () => void
  browserContentRef: RefObject<HTMLDivElement | null>
  className?: string
}

export function InAppBrowserPane({
  url,
  onClose,
  browserContentRef,
  className,
}: InAppBrowserPaneProps) {
  const { _ } = useLingui()

  // Keep the native webview in sync whenever this element resizes.
  // ResizeObserver covers: initial mount, sidebar animation, window resize.
  useEffect(() => {
    const el = browserContentRef.current
    if (!el) return

    const observer = new ResizeObserver(() => {
      const rect = el.getBoundingClientRect()
      commands
        .resizeBrowserWebview(rect.left, rect.top, rect.width, rect.height)
        .catch(() => {})
    })

    observer.observe(el)
    return () => observer.disconnect()
  }, [browserContentRef])

  return (
    <div className={cn('flex h-full flex-col', className)}>
      {/* Toolbar — React content rendered above the native webview area */}
      <div className="flex h-10 shrink-0 items-center gap-2 border-b bg-background px-3">
        <span className="flex-1 truncate text-xs text-muted-foreground select-all" title={url}>
          {url}
        </span>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="size-7 rounded-lg"
              onClick={onClose}
              aria-label={_(msg`Close browser`)}
            >
              <HugeiconsIcon icon={Cancel01Icon} className="size-4" />
            </Button>
          </TooltipTrigger>
          <TooltipPanel>{_(msg`Close browser`)}</TooltipPanel>
        </Tooltip>
      </div>

      {/* Anchor div — native WKWebView is positioned exactly here */}
      <div
        ref={browserContentRef}
        className="min-h-0 flex-1"
        aria-label={_(msg`Browser content`)}
      />
    </div>
  )
}
```

**Step 4: Run test (expect pass)**

```bash
bun run test src/components/miniflux/InAppBrowserPane.test.tsx
```

Expected: 2 tests PASS.

**Step 5: Commit**

```bash
git add src/components/miniflux/InAppBrowserPane.tsx \
        src/components/miniflux/InAppBrowserPane.test.tsx
git commit -m "feat(component): Add InAppBrowserPane with toolbar and ResizeObserver"
```

---

## Task 7: Intercept title click in `EntryReadingHeader` + `EntryReading`

**Files:**
- Modify: `src/components/miniflux/EntryReadingHeader.tsx`
- Modify: `src/components/miniflux/EntryReading.tsx`

### Part A — `EntryReadingHeader.tsx`

**Step 1: Add the prop to `EntryReadingHeaderProps` interface**

After `onClose?: () => void;` (around line 56), add:

```typescript
  onOpenInAppBrowser?: (url: string) => void;
```

**Step 2: Destructure the prop**

In the function parameters (around line 84), add `onOpenInAppBrowser` after `onClose`:

```typescript
  onClose,
  onOpenInAppBrowser,
```

**Step 3: Intercept the title anchor click (lines 553–560)**

Replace the `<a>` element:

```tsx
          <a
            href={entry.url}
            target="_blank"
            rel="noopener noreferrer"
            className="hover:underline decoration-primary/50 underline-offset-4 cursor-pointer"
            onClick={(e) => {
              if (onOpenInAppBrowser) {
                e.preventDefault()
                onOpenInAppBrowser(entry.url)
              }
            }}
          >
            <h1 className="text-2xl font-bold">{entry.title}</h1>
          </a>
```

When `onOpenInAppBrowser` is not provided, the anchor falls back to its default external-browser behaviour.

### Part B — `EntryReading.tsx`

**Step 4: Import the hook**

At the top of `EntryReading.tsx`, add:

```typescript
import { useInAppBrowser } from '@/hooks/use-in-app-browser'
```

**Step 5: Call the hook inside `EntryReading`**

Near the top of the function body (after existing hook calls), add:

```typescript
  const { openBrowser } = useInAppBrowser()
```

**Step 6: Pass the prop to `EntryReadingHeader`**

In the `EntryReadingHeader` JSX block (around line 634), add:

```tsx
        onOpenInAppBrowser={openBrowser}
```

**Step 7: TypeScript check**

```bash
bun run typecheck 2>&1 | head -20
```

Expected: no errors.

**Step 8: Commit**

```bash
git add src/components/miniflux/EntryReadingHeader.tsx \
        src/components/miniflux/EntryReading.tsx
git commit -m "feat(reader): Wire article title click to in-app browser"
```

---

## Task 8: Show `InAppBrowserPane` in `MainWindowContent`

**Files:**
- Modify: `src/components/layout/MainWindowContent.tsx`

**Step 1: Add imports**

At the top of `MainWindowContent.tsx`, add:

```typescript
import { InAppBrowserPane } from '@/components/miniflux/InAppBrowserPane'
import { useInAppBrowser } from '@/hooks/use-in-app-browser'
import { useUIStore } from '@/store/ui-store'
```

**Step 2: Read state at top of the function**

Inside `MainWindowContent`, add after the existing `useUIStore` calls:

```typescript
  const inAppBrowserUrl = useUIStore((state) => state.inAppBrowserUrl)
  const { closeBrowser, browserContentRef } = useInAppBrowser()
```

**Step 3: Replace the right-panel inner content**

Find the inner `<div className="flex h-full flex-col border-l">` (around line 43) and replace its children with:

```tsx
            <div className="flex h-full flex-col border-l">
              {inAppBrowserUrl ? (
                <InAppBrowserPane
                  url={inAppBrowserUrl}
                  onClose={closeBrowser}
                  browserContentRef={browserContentRef}
                />
              ) : (
                <AnimatePresence initial={false} mode="wait">
                  {selectedEntryId ? (
                    <motion.div
                      key="reading"
                      className="flex h-full flex-col"
                      initial={{ opacity: 0, x: 18, scale: 0.996 }}
                      animate={{ opacity: 1, x: 0, scale: 1 }}
                      exit={{ opacity: 0, x: -14, scale: 0.996 }}
                      transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
                    >
                      <EntryReading
                        entryId={selectedEntryId}
                        onNavigatePrev={onNavigatePrev}
                        onNavigateNext={onNavigateNext}
                        onClose={onClose}
                        hasPrev={hasPrev}
                        hasNext={hasNext}
                        nextEntryTitle={nextEntryTitle}
                        transitionDirection={entryTransitionDirection}
                      />
                    </motion.div>
                  ) : (
                    <motion.div
                      key="empty"
                      className="flex flex-1 flex-col items-center justify-center bg-muted/10"
                      initial={{ opacity: 0, x: -10, scale: 0.998 }}
                      animate={{ opacity: 1, x: 0, scale: 1 }}
                      exit={{ opacity: 0, x: 8, scale: 0.998 }}
                      transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
                    >
                      <EntryEmptyState />
                    </motion.div>
                  )}
                </AnimatePresence>
              )}
            </div>
```

**Step 4: TypeScript and lint**

```bash
bun run typecheck 2>&1 | head -20
```

Expected: no errors.

**Step 5: Commit**

```bash
git add src/components/layout/MainWindowContent.tsx
git commit -m "feat(layout): Show InAppBrowserPane when in-app browser is active"
```

---

## Task 9: i18n extraction + full quality gate

**Step 1: Extract strings**

```bash
bun run i18n:extract
bun run i18n:compile
```

**Step 2: Full quality gate**

```bash
bun run check:all
```

Expected: all pass. Fix any issues before continuing.

**Step 3: Commit i18n**

```bash
git add src/locales/
git commit -m "chore(i18n): Extract in-app browser toolbar strings"
```

---

## Task 10: Manual integration test (needs running app)

Ask the user to run:

```bash
bun run dev
```

**Verify:**

1. Click article in entry list → Reader View appears normally ✓
2. Click article `<h1>` title → sidebar animates closed, browser pane appears ✓
3. URL loads in native webview ✓
4. Switch OS dark/light mode → browser webview updates colorScheme ✓
5. Press ESC → browser closes, sidebar animates back ✓
6. Press Cmd+W (macOS) / Ctrl+W (Win/Linux) → same ✓
7. Click × in toolbar → same ✓
8. Resize window → webview stays aligned ✓

---

## Task 11: Finish the branch

Once all passes, invoke:

```
/superpowers:finishing-a-development-branch
```
