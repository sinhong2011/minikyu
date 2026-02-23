# In-App Browser Design

## Overview

Add a Reeder-style in-app browser to the Miniflux reader. When a user clicks the article title (h1) in the EntryReading view, the original article URL opens in a native WKWebView child webview embedded within the main window. The sidebar hides with animation, and the browser pane replaces the reader content in the right column.

## User Interaction Flow

1. User reads an article in `EntryReading` (right column).
2. User clicks the article's `<h1>` title link in `EntryReadingHeader`.
3. Left sidebar animates closed (~250ms CSS transition via shadcn `SidebarProvider`).
4. After animation completes, a React toolbar + native WKWebView appears in the right column.
5. Press **ESC**, **Cmd+W**, or the **×** button to close.
6. Browser closes, sidebar animates back open.

## Layout States

**Normal:**

```
[Sidebar 18rem] [Entry List] [Reader View (EntryReading)]
```

**Browser open:**

```
[Entry List] [Browser Toolbar (React) + WKWebView (native)]
```

Entry List width is unchanged. The freed sidebar space is absorbed by the right column expanding.

## State Management

Add to `src/store/ui-store.ts`:

```typescript
inAppBrowserUrl: string | null        // null = browser closed
setInAppBrowserUrl: (url: string | null) => void
```

**Open sequence:**
1. `setInAppBrowserUrl(entry.url)`
2. `setLeftSidebarVisible(false)` triggers shadcn sidebar CSS transition
3. `setTimeout(250)` then calculate browser pane rect and call Tauri `openInAppBrowser`

**Close sequence:**
1. Call Tauri `closeInAppBrowser`
2. `setInAppBrowserUrl(null)`
3. `setLeftSidebarVisible(true)` — sidebar animates back

## React Components

### `InAppBrowserPane.tsx` (new)

Renders inside the right column when `inAppBrowserUrl` is set. Layout:

```
┌─────────────────────────────────────────┐
│ ← → | 🔒 https://... | [Reload] | [×] │  ← React toolbar h-10
├─────────────────────────────────────────┤
│                                         │
│   browserContentRef div (flex-1)        │
│   ← Native WKWebView sits here         │
│                                         │
└─────────────────────────────────────────┘
```

- `browserContentRef`: `useRef<HTMLDivElement>` — positioning anchor for the native webview.
- `ResizeObserver` on this ref calls `resizeBrowserWebview(x, y, w, h)` whenever bounds change.
- Toolbar rendered in React above the native webview position.

### `MainWindowContent.tsx` (modify)

```tsx
// In the right ResizablePanel:
{inAppBrowserUrl
  ? <InAppBrowserPane url={inAppBrowserUrl} onClose={closeBrowser} />
  : <EntryReading ... />
}
```

### `EntryReadingHeader.tsx` (modify)

Intercept the `<a href={entry.url}>` onClick at line 554:

```tsx
<a
  href={entry.url}
  onClick={(e) => {
    e.preventDefault()
    openInAppBrowser(entry.url)   // from useInAppBrowser hook
  }}
>
  <h1>{entry.title}</h1>
</a>
```

## Hook: `use-in-app-browser.ts` (new)

Responsibilities:
- `openBrowser(url)`: setInAppBrowserUrl, hide sidebar, setTimeout then call Tauri command
- `closeBrowser()`: call Tauri closeInAppBrowser, clear URL, restore sidebar
- ESC and Cmd+W listeners via `useEffect` + `window.addEventListener`
- Theme sync: `getCurrentWindow().theme()` + `onThemeChanged` listener
- Returns `{ openBrowser, closeBrowser, browserUrl }`

## Rust Commands (`in_app_browser.rs`)

| Command | Signature | Purpose |
|---------|-----------|---------|
| `open_in_app_browser` | `(window, url, x, y, width, height, is_dark)` | Create or reuse child webview at given bounds |
| `close_in_app_browser` | `(window)` | Close and destroy the child webview |
| `resize_browser_webview` | `(window, x, y, width, height)` | Update webview bounds (LogicalPosition + LogicalSize) |
| `sync_browser_theme` | `(window, is_dark)` | Inject JS colorScheme into browser webview via Tauri webview script API |

Webview label: `"in-app-browser"` (constant).

Webview creation uses `window.add_child(WebviewBuilder::new(label, WebviewUrl::External(url)), LogicalPosition, LogicalSize)`.

Position coordinates use **LogicalPosition** (direct 1:1 with `getBoundingClientRect()` CSS pixels).

Existing webview reuse: call `window.get_webview(BROWSER_LABEL)`. If found, call `set_bounds` + `navigate`. If not found, create new.

## Theme Sync

```typescript
const win = getCurrentWindow()
const theme = await win.theme()          // 'dark' | 'light' | null
await commands.syncBrowserTheme(theme === 'dark')

const unlisten = await win.onThemeChanged(({ payload }) => {
  commands.syncBrowserTheme(payload === 'dark')
})
```

Rust side uses Tauri's `Webview::execute_script` (or equivalent script injection API) to set `document.documentElement.style.colorScheme`.

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| ESC | Close browser, restore sidebar |
| Cmd+W (macOS) / Ctrl+W (Win/Linux) | Close browser, restore sidebar |

## Files to Create / Modify

| File | Action |
|------|--------|
| `src-tauri/src/commands/in_app_browser.rs` | Create |
| `src-tauri/src/commands/mod.rs` | Add `pub mod in_app_browser;` |
| `src-tauri/src/bindings.rs` | Register 4 new commands in `collect_commands!` |
| `src/store/ui-store.ts` | Add `inAppBrowserUrl` state + setter |
| `src/hooks/use-in-app-browser.ts` | Create hook |
| `src/components/miniflux/InAppBrowserPane.tsx` | Create component |
| `src/components/miniflux/EntryReadingHeader.tsx` | Intercept title onClick |
| `src/components/layout/MainWindowContent.tsx` | Switch browser/reader in right panel |

## Constraints

- Use `LogicalPosition` / `LogicalSize` (not physical pixels) for all Tauri webview positioning.
- Do not modify the sidebar animation — rely on existing shadcn `SidebarProvider` CSS transition.
- All user-facing strings in toolbar must use `useLingui` + `msg` macro.
- Run `bun run codegen:tauri` after updating `bindings.rs`.
- Run `cargo build --lib` to verify Rust compilation before marking tasks complete.
