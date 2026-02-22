# Miniflux Original Content Download Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Support one-click original-article fetching in the reader toolbar, and confirm/feed settings alignment for summary-only feeds.

**Architecture:** Keep local-first behavior intact: use Miniflux `fetch-content` API, then persist refreshed content in local SQLite so reader UI updates immediately and remains consistent after reload. Reuse existing feed advanced settings (`crawler`) and improve wording so users can find the option.

**Tech Stack:** Tauri v2, Rust, tauri-specta, React 19, TanStack Query, Lingui, Vitest

---

## UI/UX Experience Design

### UX Goals

1. Make “download original content” discoverable where reading happens.
2. Keep action confidence high with clear loading/success/failure feedback.
3. Avoid interrupting reading flow; all interactions should be low-friction.
4. Keep feed-level behavior (crawler setting) understandable for non-technical users.

### Primary User Journey

1. User opens a summary-only article in reader view.
2. User sees a dedicated toolbar action to fetch original content.
3. User taps action and immediately gets pending feedback.
4. If successful, content refreshes in place with clear success signal.
5. If failed, user sees reason and can retry without losing reading position.
6. User optionally enables feed-level crawler setting so future entries auto-fetch.

### Surface-Level Interaction Design

1. Reader toolbar button:
   - Placement: same action cluster as star/read/share.
   - Behavior: icon button + tooltip label.
   - States: idle, loading (spinner/disabled), success (toast), error (toast + retryable).
2. Feed settings toggle:
   - Label should be outcome-focused, not implementation-only.
   - Suggested copy: `Download original content (crawler)`.
   - Helper text should explain this helps summary-only feeds fetch full text.

### Feedback and State Design

1. Loading:
   - Disable button during in-flight request.
   - Tooltip changes to localized “Fetching original content…”.
2. Success:
   - Localized success toast and silent content refresh.
   - Preserve current scroll/reading context as much as possible.
3. Failure:
   - Localized error toast with server message.
   - Keep button enabled after failure for quick retry.

### Accessibility and Usability Requirements

1. Button must have explicit localized `aria-label`.
2. Tooltip text must match action intent and loading state.
3. Disabled/loading state must remain keyboard focus-safe.
4. Visual state changes must not rely on color alone.

### UX Acceptance Criteria

1. First-time user can discover “fetch original content” within 3 seconds in reader header.
2. User can distinguish idle/loading/success/error states without reading logs.
3. After successful fetch, refreshed article content appears without manual page navigation.
4. Feed-level option meaning is understandable without Miniflux API knowledge.

---

## Implementation Notes

1. Use `@test-driven-development` for each task (red -> green -> refactor).
2. Use bun commands only.
3. Do not commit unless user explicitly asks.
4. Assumption: “toolbar download button” means the reader toolbar in `EntryReadingHeader`.
5. Existing feed setting coverage already includes crawler/proxy toggles:
   - `src/components/miniflux/settings/FeedFormDialog.tsx`
   - `src/components/miniflux/AddFeedDialog.tsx`
   - `src/components/miniflux/EditFeedDialog.tsx`
6. UI copy and behavior must satisfy the UX acceptance criteria above.

---

### Task 1: Clarify Feed Setting Copy for Original Content

**Files:**
- Modify: `src/components/miniflux/settings/FeedFormDialog.tsx`
- Modify: `src/components/miniflux/AddFeedDialog.tsx`
- Modify: `src/components/miniflux/EditFeedDialog.tsx`
- Create: `src/components/miniflux/settings/FeedFormDialog.test.tsx`
- Modify: `src/locales/en/messages.po`
- Modify: `src/locales/ja/messages.po`
- Modify: `src/locales/ko/messages.po`
- Modify: `src/locales/zh-CN/messages.po`
- Modify: `src/locales/zh-TW/messages.po`

**Step 1: Add failing assertion for copy text in a component test (or create one if missing)**

Create/update a test that expects the crawler toggle label to communicate original-content behavior (for example: `Download original content (crawler)`).

**Step 2: Run test and verify RED**

Run:
```bash
bun run test:run src/components/miniflux/settings/FeedFormDialog.test.tsx
```

Expected: FAIL (label not present yet, or test file absent).

**Step 3: Update labels/tooltips in all feed edit/create surfaces**

Update crawler text in:
- `src/components/miniflux/settings/FeedFormDialog.tsx`
- `src/components/miniflux/AddFeedDialog.tsx`
- `src/components/miniflux/EditFeedDialog.tsx`

Use i18n strings only (`msg` macro).

**Step 4: Extract and compile i18n catalogs**

Run:
```bash
bun run i18n:extract
bun run i18n:compile
```

**Step 5: Re-run test and verify GREEN**

Run:
```bash
bun run test:run src/components/miniflux/settings/FeedFormDialog.test.tsx
```

Expected: PASS.

---

### Task 2: Persist Fetched Content to Local DB in Rust Command

**Files:**
- Modify: `src-tauri/src/commands/miniflux.rs`
- Modify: `src-tauri/src/commands/miniflux.test.rs`

**Step 1: Add failing Rust test for local DB content update after fetch**

Add a test case for helper logic that writes fetched content into `entries.content` for a target entry ID.

**Step 2: Run Rust test and verify RED**

Run:
```bash
cd src-tauri && cargo test test_update_entry_content
```

Expected: FAIL (helper not implemented yet).

**Step 3: Implement local persistence path in `fetch_entry_content` flow**

In `src-tauri/src/commands/miniflux.rs`:
- Fetch content from Miniflux API using existing client call.
- Update local SQLite `entries.content` for the same entry ID.
- Return fetched content string.
- Keep explicit error propagation (`map_err` + descriptive messages).

**Step 4: Re-run Rust test and verify GREEN**

Run:
```bash
cd src-tauri && cargo test test_update_entry_content
```

Expected: PASS.

**Step 5: Verify Rust compile**

Run:
```bash
cd src-tauri && cargo build --lib
```

Expected: PASS.

---

### Task 3: Wire Reader Toolbar Download Button to Fetch Mutation

**Files:**
- Modify: `src/components/miniflux/EntryReading.tsx`
- Modify: `src/components/miniflux/EntryReadingHeader.tsx`
- Modify: `src/services/miniflux/entries.ts`
- Modify: `src/locales/en/messages.po`
- Modify: `src/locales/ja/messages.po`
- Modify: `src/locales/ko/messages.po`
- Modify: `src/locales/zh-CN/messages.po`
- Modify: `src/locales/zh-TW/messages.po`

**Step 1: Add failing UI test for toolbar fetch button**

Create or update `src/components/miniflux/EntryReadingHeader.test.tsx`:
- Button is rendered with translated label.
- Clicking button calls fetch handler once.
- Button is disabled while fetch mutation is pending.

**Step 2: Run test and verify RED**

Run:
```bash
bun run test:run src/components/miniflux/EntryReadingHeader.test.tsx
```

Expected: FAIL (button/props absent).

**Step 3: Add button and mutation wiring**

In `EntryReading.tsx`:
- Use `useFetchEntryContent`.
- Pass `onFetchOriginalContent` and `isFetchingOriginalContent` props to header.
- Invoke with `updateContent: true`.

In `EntryReadingHeader.tsx`:
- Add toolbar button with download/fetch icon + tooltip.
- Hook button click to `onFetchOriginalContent`.
- Respect disabled/loading state.

In `src/services/miniflux/entries.ts`:
- Keep mutation as source of truth for fetch action.
- Add translated success/error toast text (no hardcoded user-facing English).
- Ensure query invalidation remains intact.

**Step 4: Extract and compile i18n catalogs**

Run:
```bash
bun run i18n:extract
bun run i18n:compile
```

**Step 5: Re-run UI test and verify GREEN**

Run:
```bash
bun run test:run src/components/miniflux/EntryReadingHeader.test.tsx
```

Expected: PASS.

---

### Task 4: Add Service-Level Tests for Fetch Mutation Behavior

**Files:**
- Modify: `src/services/miniflux/entries.test.ts`

**Step 1: Add failing tests for fetch mutation**

Cover:
- Calls `commands.fetchEntryContent(id, true)` with expected payload.
- Shows error toast on failure.
- Invalidates entry detail/list query keys on success.

**Step 2: Run test and verify RED**

Run:
```bash
bun run test:run src/services/miniflux/entries.test.ts
```

Expected: FAIL (tests not implemented yet).

**Step 3: Implement/adjust mutation behavior as needed**

Refactor `useFetchEntryContent` minimally until tests pass.

**Step 4: Re-run test and verify GREEN**

Run:
```bash
bun run test:run src/services/miniflux/entries.test.ts
```

Expected: PASS.

---

### Task 5: Full Verification Gates

**Files:**
- No new files; verification only

**Step 1: Run targeted frontend tests**

Run:
```bash
bun run test:run src/components/miniflux/EntryReadingHeader.test.tsx src/services/miniflux/entries.test.ts
```

Expected: PASS.

**Step 2: Run targeted Rust tests**

Run:
```bash
cd src-tauri && cargo test commands::miniflux
```

Expected: PASS.

**Step 3: Run project quality gate**

Run:
```bash
bun run check:all
```

Expected: PASS.

**Step 4: App runtime verification**

Run:
```bash
bun run dev
```

If local GUI app launch cannot be fully verified in the current agent runtime, ask the user to run this command and share startup logs/screenshots.

Expected:
- App starts without compile/runtime errors.
- Reader toolbar shows download button.
- Clicking button refreshes the current entry content.
- Feed settings still expose crawler/proxy options with updated wording.
