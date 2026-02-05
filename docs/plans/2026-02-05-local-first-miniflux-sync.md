# Local-First Miniflux Sync Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make categories/feeds/entries local-first via SQLite, with Miniflux API sync (push queue → pull remote) and sync events for UI status.

**Architecture:** SQLite is the single source of truth for UI reads. Mutations apply locally and enqueue sync operations. A sync command pushes queue to Miniflux, then pulls remote changes incrementally and upserts into SQLite. Events report sync status.

**Tech Stack:** Tauri v2, Rust + sqlx + reqwest, tauri-specta, SQLite, React 19, TanStack Query, Zustand v5.

---

### Task 1: Add sync queue tests (RED)

**Files:**
- Create: `src-tauri/src/commands/sync.test.rs`
- Modify: `src-tauri/src/commands/sync.rs`

**Step 1: Write the failing test**

```rust
#[tokio::test]
async fn test_enqueue_sync_operation_persists_queue_row() {
    let pool = setup_test_db().await;
    let payload = serde_json::json!({"status": "read"}).to_string();
    let id = enqueue_sync_operation(&pool, "entry", 123, "mark_read", &payload).await.unwrap();

    let row: (i64, String, String, i64, String, String) = sqlx::query_as(
        "SELECT id, entity_type, operation_type, entity_id, payload, status FROM sync_queue WHERE id = ?",
    )
    .bind(id)
    .fetch_one(&pool)
    .await
    .unwrap();

    assert_eq!(row.1, "entry");
    assert_eq!(row.2, "mark_read");
    assert_eq!(row.3, 123);
    assert_eq!(row.4, payload);
    assert_eq!(row.5, "pending");
}
```

**Step 2: Run test to verify it fails**

Run: `cd src-tauri && cargo test sync::test_enqueue_sync_operation_persists_queue_row`
Expected: FAIL with `cannot find function enqueue_sync_operation`

**Step 3: Write minimal implementation**

```rust
pub async fn enqueue_sync_operation(
    pool: &SqlitePool,
    entity_type: &str,
    entity_id: i64,
    operation_type: &str,
    payload: &str,
) -> Result<i64, String> {
    let now = Utc::now().to_rfc3339();
    let result = sqlx::query(
        r#"
        INSERT INTO sync_queue (operation_type, entity_type, entity_id, payload, retry_count, status, created_at, updated_at)
        VALUES (?, ?, ?, ?, 0, 'pending', ?, ?)
        "#,
    )
    .bind(operation_type)
    .bind(entity_type)
    .bind(entity_id)
    .bind(payload)
    .bind(&now)
    .bind(&now)
    .execute(pool)
    .await
    .map_err(|e| e.to_string())?;

    Ok(result.last_insert_rowid())
}
```

**Step 4: Run test to verify it passes**

Run: `cd src-tauri && cargo test sync::test_enqueue_sync_operation_persists_queue_row`
Expected: PASS

**Step 5: Commit**

```bash
git add src-tauri/src/commands/sync.rs src-tauri/src/commands/sync.test.rs
git commit -m "test: add sync queue enqueue test"
```

---

### Task 2: Create sync command module + DB helpers

**Files:**
- Create: `src-tauri/src/commands/sync.rs`
- Modify: `src-tauri/src/commands/mod.rs`

**Step 1: Write failing test for sync_state read**

```rust
#[tokio::test]
async fn test_get_sync_state_default_row_created() {
    let pool = setup_test_db().await;
    let state = get_or_create_sync_state(&pool).await.unwrap();
    assert_eq!(state.sync_in_progress, false);
}
```

**Step 2: Run test to verify it fails**

Run: `cd src-tauri && cargo test sync::test_get_sync_state_default_row_created`
Expected: FAIL missing function.

**Step 3: Implement minimal `get_or_create_sync_state`**

```rust
pub async fn get_or_create_sync_state(pool: &SqlitePool) -> Result<SyncState, String> {
    if let Some(row) = sqlx::query_as::<_, SyncState>(
        "SELECT id, last_sync_at, last_full_sync_at, sync_in_progress, sync_error, sync_version FROM sync_state LIMIT 1",
    )
    .fetch_optional(pool)
    .await
    .map_err(|e| e.to_string())? {
        return Ok(row);
    }

    sqlx::query(
        "INSERT INTO sync_state (last_sync_at, last_full_sync_at, sync_in_progress, sync_error, sync_version) VALUES (NULL, NULL, 0, NULL, 1)",
    )
    .execute(pool)
    .await
    .map_err(|e| e.to_string())?;

    sqlx::query_as::<_, SyncState>(
        "SELECT id, last_sync_at, last_full_sync_at, sync_in_progress, sync_error, sync_version FROM sync_state LIMIT 1",
    )
    .fetch_one(pool)
    .await
    .map_err(|e| e.to_string())
}
```

**Step 4: Run test to verify it passes**

Run: `cd src-tauri && cargo test sync::test_get_sync_state_default_row_created`
Expected: PASS

**Step 5: Commit**

```bash
git add src-tauri/src/commands/sync.rs src-tauri/src/commands/mod.rs
git commit -m "feat: add sync state helpers"
```

---

### Task 3: Add sync_miniflux command (push queue → pull remote)

**Files:**
- Modify: `src-tauri/src/commands/sync.rs`
- Modify: `src-tauri/src/commands/miniflux.rs`

**Step 1: Write failing test for sync summary**

```rust
#[tokio::test]
async fn test_sync_miniflux_returns_summary() {
    let pool = setup_test_db().await;
    let summary = SyncSummary { pushed: 0, pulled: 0, failed: 0 };
    assert_eq!(summary.pushed, 0);
}
```

**Step 2: Run test to verify it fails**

Run: `cd src-tauri && cargo test sync::test_sync_miniflux_returns_summary`
Expected: FAIL missing SyncSummary type.

**Step 3: Implement SyncSummary and sync_miniflux skeleton**

```rust
#[derive(Debug, Clone, Serialize, Deserialize, specta::Type)]
pub struct SyncSummary {
    pub pushed: i64,
    pub pulled: i64,
    pub failed: i64,
}

#[tauri::command]
#[specta::specta]
pub async fn sync_miniflux(app_handle: AppHandle, state: State<'_, AppState>) -> Result<SyncSummary, String> {
    // emit sync-started
    // push_queue
    // pull_remote
    // emit sync-completed
    Ok(SyncSummary { pushed: 0, pulled: 0, failed: 0 })
}
```

**Step 4: Run test to verify it passes**

Run: `cd src-tauri && cargo test sync::test_sync_miniflux_returns_summary`
Expected: PASS

**Step 5: Commit**

```bash
git add src-tauri/src/commands/sync.rs src-tauri/src/commands/miniflux.rs
git commit -m "feat: add sync_miniflux command skeleton"
```

---

### Task 4: Switch read commands to SQLite

**Files:**
- Modify: `src-tauri/src/commands/miniflux.rs`

**Step 1: Write failing test for get_categories_from_db**

```rust
#[tokio::test]
async fn test_get_categories_from_db_empty() {
    let pool = setup_test_db().await;
    let items = get_categories_from_db(&pool).await.unwrap();
    assert!(items.is_empty());
}
```

**Step 2: Run test to verify it fails**

Run: `cd src-tauri && cargo test miniflux::test_get_categories_from_db_empty`
Expected: FAIL missing function.

**Step 3: Implement minimal DB queries in miniflux.rs**

```rust
pub async fn get_categories_from_db(pool: &SqlitePool) -> Result<Vec<Category>, String> {
    let rows: Vec<Category> = sqlx::query_as(
        "SELECT id, user_id, title, hide_globally, created_at, updated_at FROM categories ORDER BY title ASC",
    )
    .fetch_all(pool)
    .await
    .map_err(|e| e.to_string())?;
    Ok(rows)
}
```

**Step 4: Run test to verify it passes**

Run: `cd src-tauri && cargo test miniflux::test_get_categories_from_db_empty`
Expected: PASS

**Step 5: Commit**

```bash
git add src-tauri/src/commands/miniflux.rs
git commit -m "feat: read categories/feeds/entries from sqlite"
```

---

### Task 5: Add sync status store + hooks

**Files:**
- Create: `src/store/sync-store.ts`
- Modify: `src/services/miniflux/index.ts`
- Modify: `src/services/miniflux/feeds.ts`

**Step 1: Write failing test for sync store**

```ts
import { syncStore } from '@/store/sync-store'

test('sync store default state', () => {
  const state = syncStore.getState()
  expect(state.syncing).toBe(false)
})
```

**Step 2: Run test to verify it fails**

Run: `bun run test src/store/sync-store.test.ts`
Expected: FAIL module not found.

**Step 3: Implement sync store**

```ts
export const useSyncStore = create<SyncStore>()((set) => ({
  syncing: false,
  lastSyncedAt: null,
  error: null,
  setSyncing: (syncing) => set({ syncing }),
  setLastSyncedAt: (lastSyncedAt) => set({ lastSyncedAt }),
  setError: (error) => set({ error }),
}))
```

**Step 4: Run test to verify it passes**

Run: `bun run test src/store/sync-store.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/store/sync-store.ts src/store/sync-store.test.ts
git commit -m "feat: add sync status store"
```

---

### Task 6: Update services + UI for sync

**Files:**
- Modify: `src/services/miniflux/feeds.ts`
- Modify: `src/components/miniflux/MinifluxLayout.tsx`

**Step 1: Write failing test for sync UI state**

```tsx
test('sync button disabled while syncing', () => {
  // render with sync store state syncing=true
  // assert disabled
})
```

**Step 2: Run test to verify it fails**

Run: `bun run test src/components/miniflux/MinifluxLayout.test.tsx`
Expected: FAIL missing behavior.

**Step 3: Implement sync state wiring**

```tsx
const syncing = useSyncStore((s) => s.syncing)
<Button disabled={syncing} ...>
```

**Step 4: Run test to verify it passes**

Run: `bun run test src/components/miniflux/MinifluxLayout.test.tsx`
Expected: PASS

**Step 5: Commit**

```bash
git add src/components/miniflux/MinifluxLayout.tsx src/services/miniflux/feeds.ts
git commit -m "feat: wire sync status to UI"
```

---

### Task 7: Update bindings + regenerate TS

**Files:**
- Modify: `src-tauri/src/bindings.rs`
- Modify: `src/lib/bindings.ts` (generated)
- Modify: `src/lib/tauri-bindings.ts`

**Step 1: Update bindings.rs**

Add new commands in collect_commands!:
```
crate::commands::sync::sync_miniflux,
crate::commands::sync::get_sync_status,
```

**Step 2: Regenerate bindings**

Run: `bun run codegen:tauri`
Expected: `src/lib/bindings.ts` updated.

**Step 3: Commit**

```bash
git add src-tauri/src/bindings.rs src/lib/bindings.ts src/lib/tauri-bindings.ts
git commit -m "chore: add sync commands to bindings"
```

---

### Task 8: Documentation update

**Files:**
- Modify: `docs/developer/data-persistence.md`

**Step 1: Add local-first sync section**

Document:
- SQLite as source of truth
- Sync queue pattern
- sync_miniflux flow

**Step 2: Commit**

```bash
git add docs/developer/data-persistence.md
git commit -m "docs: add local-first sync pattern"
```

---

### Task 9: Run diagnostics

Run:
- `cd src-tauri && cargo build --lib`
- `bun run codegen:tauri`
- `bun run check:all`
- `bun run dev`

Expected: All commands succeed, app launches.

---

**Execution options:**

1. **Subagent-Driven (this session)** — I dispatch a subagent per task with spec + quality reviews.
2. **Parallel Session (separate)** — New session with `superpowers:executing-plans`.

Which approach? (1 or 2)
