# Delete Account UX Design

## Problem

1. Delete always targets the active account — no way to delete a non-active account
2. No fallback after deletion — deleting the active account leaves the app in a broken state (shows "Welcome" with no way to reconnect to existing accounts)
3. Welcome screen doesn't show existing accounts for quick reconnection
4. Icon mismatch — uses logout icon for a destructive delete action

## Design

### Per-Account Delete in UserNav Menu

Each account row in the UserNav dropdown gets a trash icon on hover:

- Trash icon (`Delete02Icon`) appears on the right side of each account row on hover
- Uses `e.stopPropagation()` to avoid triggering account switch
- Active account shows both checkmark and trash on hover
- The standalone "Delete Account" button at the bottom of the menu is removed

### Context-Aware Confirmation Dialogs

Three scenarios with different dialog messages:

**Non-active account:**
> Delete account "{username}" on {domain}? This will remove all saved credentials.
> [Cancel] [Delete]

**Active account (others exist):**
> Delete account "{username}" on {domain}? You are currently connected to this account. You'll be switched to "{next_username}" automatically.
> [Cancel] [Delete & Switch]

**Last/only account:**
> Delete account "{username}" on {domain}? This is your only account. Deleting it will disconnect you completely.
> [Cancel] [Delete & Disconnect]

### Post-Deletion Behavior

| Scenario | After deletion |
|----------|---------------|
| Non-active deleted | Nothing changes, stay connected |
| Active deleted, others exist | Backend promotes next account, auto-reconnects, UI refreshes |
| Last account deleted | Show welcome screen |

### Welcome Screen Enhancement

When the welcome screen is shown and accounts exist in the DB (e.g., accounts with `is_active = 0` that failed to auto-reconnect), show:

- Existing accounts as clickable buttons for quick reconnection
- "Add Account" button for new connections
- This covers the edge case where auto-reconnect fails (network down, credentials expired)

## Files to Change

| File | Change |
|------|--------|
| `src/components/miniflux/UserNav.tsx` | Per-account delete buttons, remove standalone delete, new confirmation logic |
| `src-tauri/src/commands/accounts.rs` | Already fixed: promote next account after active deletion |
| `src/components/miniflux/MinifluxLayout.tsx` | Welcome screen shows existing accounts for reconnection |
| `src/components/miniflux/UserNav.test.tsx` | Update tests for new delete flow |
