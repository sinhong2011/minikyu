## Task 6: get_accounts command

### Implementation Details
- Added `MinifluxAccount` struct with sqlx::FromRow derive for query_as
- Used regular `query_as` instead of `query_as!` macro (no sqlx offline mode)
- Followed existing pattern from get_feeds command (simple SELECT returning Vec)
- ORDER BY created_at DESC to show newest accounts first

### Test Coverage
- test_get_accounts_returns_all: Verifies all accounts returned
- test_get_accounts_correct_order: Verifies DESC ordering (newest first)
- test_get_accounts_empty_database: Verifies empty Vec on empty table
- All 10 tests pass in accounts module

### Key Decisions
- Struct fields: id, username, server_url, auth_method, is_active, created_at, updated_at
- No credentials returned (passwords/tokens in keyring only)
- No filtering/pagination - simple "get all" for account switcher UI

## Task 7: delete_miniflux_account Command

### Implementation Pattern
- **Test-first TDD approach**: Write failing tests before implementation
- **Error handling**: Query account first to get server_url/username before deletion
- **Graceful keyring deletion**: Handle NotFound case (log but don't fail) if credentials already deleted
- **Cascade deletion**: Explicit DELETE query on users table (WHERE server_url AND username)
- **Internal implementation function**: Use `_impl` pattern for testability without AppHandle

### Test Structure
- 5 comprehensive tests covering:
  1. Database deletion verification
  2. Keyring credentials deletion (token and password)
  3. Cascade delete from users table
  4. Non-existent account error handling
  5. Active account deletion (allowed per plan)

### Key Decisions
- **Allow deleting active account**: No validation needed, frontend handles confirmation
- **NotFound for missing account**: Return AccountError::NotFound if account ID doesn't exist
- **Graceful keyring handling**: Don't fail if credentials already gone (log only)
- **Explicit cascade**: Use WHERE clause on users table (no database-level CASCADE)

### Testing Pattern
- `delete_miniflux_account_impl(&pool, id)` - internal function for unit tests
- `delete_miniflux_account(app_handle, id)` - public Tauri command
- In-memory SQLite for test isolation
- Keyring cleanup in tests to avoid collisions

### Results
- ✅ All 5 delete tests pass
- ✅ Command registered in bindings.rs
- ✅ Compilation successful (cargo check)
- ✅ No dead_code warnings for delete_miniflux_account

## Task 10: auto_reconnect_miniflux Command (2026-01-31)

### Implementation Summary
Implemented `auto_reconnect_miniflux` command that queries database for active account and restores Miniflux connection on app startup using keyring credentials.

### Key Patterns Applied
1. **Database-first approach**: Query database for `is_active=1` BEFORE keyring operations
   - Reduces unnecessary keyring lookups if no account exists
   - Graceful early return with `Ok(())` if no active account
   
2. **Credential retrieval based on auth_method**:
   ```rust
   match auth_method.as_str() {
       "token" => get_token(&server_url, &username).await,
       "password" => get_password(&server_url, &username).await,
       _ => Err(AccountError::InvalidCredentials)
   }
   ```

3. **Reuse existing authentication flow**: Call `miniflux_connect()` instead of duplicating logic
   - Ensures consistent state management (MINIFLUX_STATE updates)
   - Handles all auth edge cases (invalid credentials, network errors)

4. **State management**: Pass `State<'_, MinifluxState>` to auto_reconnect command
   - Required for calling `miniflux_connect()` which updates shared state
   - Thread-safe access via `Arc<Mutex<Option<Arc<MinifluxClient>>>>`

### Error Handling Strategy
- **No active account**: Return `Ok(())` gracefully (user hasn't logged in yet)
- **Keyring errors**: Return `AccountError::NotFound` or `AccountError::KeyringError`
- **Connection failures**: Wrap miniflux_connect errors in `AccountError::KeyringError` with context
- **Invalid auth_method**: Return `AccountError::InvalidCredentials`

### Testing Approach (TDD)
Created 6 tests covering:
1. No active account → returns Ok(()) gracefully
2. Token-based auth → fetches token from keyring correctly
3. Password-based auth → fetches password from keyring correctly  
4. Invalid auth_method → returns InvalidCredentials error
5. Keyring not found → returns NotFound error
6. All paths through happy path (account fetch → keyring → connect → state update)

### Security Considerations
- Logs all operations at debug/info level for security auditing
- Does NOT expose credentials in logs (only server_url and username)
- Graceful failure on connection errors (doesn't block app startup)

### Command Registration
Added to `src-tauri/src/bindings.rs`:
```rust
accounts::auto_reconnect_miniflux,
```

TypeScript binding generated:
```typescript
async autoReconnectMiniflux() : Promise<Result<null, AccountError>>
```

### Files Modified
1. `src-tauri/src/commands/accounts.rs` - Added `auto_reconnect_miniflux` function
2. `src-tauri/src/commands/accounts.test.rs` - Added 6 tests
3. `src-tauri/src/bindings.rs` - Registered command
4. `src/lib/bindings.ts` - Auto-generated TypeScript binding

### Next Steps (Task 11)
Hook up auto_reconnect_miniflux to app startup in `lib.rs`:
1. Call after database initialization in setup() hook
2. Log connection success/failure (don't block startup on failure)
3. Consider emitting frontend event on successful reconnection

