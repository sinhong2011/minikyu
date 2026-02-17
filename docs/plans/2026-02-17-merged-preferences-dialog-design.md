# Merged Preferences Dialog Design

**Date:** 2026-02-17
**Status:** Approved
**Author:** Claude (with user approval)

## Overview

Merge the Miniflux Settings dialog into the main Preferences dialog with clear organization between desktop app settings and Miniflux server management.

## Goals

1. **Unify settings access:** Single preferences dialog for all settings
2. **Clear separation:** Users can easily distinguish desktop vs server settings
3. **Maintain functionality:** All existing features preserved
4. **Clean organization:** Logical grouping that scales for future settings

## Current State

**Preferences Dialog** (`src/components/preferences/PreferencesDialog.tsx`):
- Desktop app settings only
- 4 panes: General, Appearance, Advanced, About
- Opened via keyboard shortcut

**Miniflux Settings Dialog** (`src/components/miniflux/MinifluxSettingsDialog.tsx`):
- Server management only
- 4 panes: Categories, Feeds, Users (admin), API Token
- Opened from user menu (UserNav component)

## Proposed Design

### 1. Sidebar Structure & Navigation

**Navigation Type:**
```typescript
type PreferencesPane =
  | 'general'      // Desktop app
  | 'appearance'   // Desktop app
  | 'advanced'     // Desktop app
  | 'about'        // Desktop app
  | 'categories'   // Miniflux server
  | 'feeds'        // Miniflux server
  | 'users'        // Miniflux server (admin only)
  | 'token';       // Miniflux server
```

**Sidebar Layout:**
```
┌─────────────────────┐
│  App Settings       │ ← Section header (non-clickable)
│  • General          │
│  • Appearance       │
│  • Advanced         │
│  • About            │
│                     │
│  Server Settings    │ ← Section header (hidden when disconnected)
│  • Categories       │
│  • Feeds            │
│  • Users (admin)    │ ← Hidden for non-admin users
│  • API Token        │
└─────────────────────┘
```

**Visual Design:**
- Section headers: Larger font, muted color, non-clickable
- Active item: Background highlight
- Badges: Count indicators (e.g., "3" next to Categories)
- 8px gap between sections
- Icons for each item

**Accessibility:**
- Headers: `<div role="presentation" aria-hidden="true">`
- Navigation items: `<button role="menuitem">`
- Full keyboard navigation support

### 2. Connection State Handling

**When Not Connected:**
- "Server Settings" section completely hidden from sidebar
- Only "App Settings" items visible
- No error messages in sidebar

**Connection Lost:**
- If user viewing Miniflux pane: Auto-switch to 'general' pane
- Show toast: "Disconnected from Miniflux server"

**Connection Established:**
- "Server Settings" section appears
- Current pane unchanged (unless it was a Miniflux pane that no longer exists)

**Admin Users:**
- "Users" menu item visibility depends on `currentUser?.is_admin`
- Reactively updates when permissions change

**Implementation:**
```typescript
const { data: isConnected } = useIsConnected();
const { data: currentUser } = useCurrentUser();

{isConnected && (
  <SidebarGroup>
    <SidebarGroupLabel>Server Settings</SidebarGroupLabel>
    {/* Miniflux items */}
  </SidebarGroup>
)}
```

### 3. Content Panes Integration

**File Structure:**
```
src/components/preferences/
├── PreferencesDialog.tsx          (main dialog - updated)
├── panes/
│   ├── GeneralPane.tsx            (existing, no changes)
│   ├── AppearancePane.tsx         (existing, no changes)
│   ├── AdvancedPane.tsx           (existing, no changes)
│   ├── AboutPane.tsx              (existing, no changes)
│   ├── CategoriesPane.tsx         (moved from miniflux/settings/)
│   ├── FeedsPane.tsx              (moved from miniflux/settings/)
│   ├── UsersPane.tsx              (moved from miniflux/settings/)
│   └── ApiTokenPane.tsx           (new, extracted from inline content)
└── shared/
    └── SettingsComponents.tsx     (existing, no changes)
```

**Pane State Management:**
- Parent `PreferencesDialog` manages `activePane` state
- Miniflux dialog states (category, feed, user, delete) managed by existing `MinifluxSettingsDialogStore`
- Each pane receives its own state via props (search queries, etc.)

**Provider Hierarchy:**
```typescript
<Dialog open={preferencesOpen} onOpenChange={setPreferencesOpen}>
  <DialogContent>
    <MinifluxSettingsDialogProvider>
      {/* Sidebar and content */}
    </MinifluxSettingsDialogProvider>
  </DialogContent>

  {/* Nested dialogs */}
  <FeedCategoryDialogsHost />
  <UserFormDialog />
  <DeleteEntityDialog />
</Dialog>
```

### 4. Dialog State Management

**UI Store Updates:**
```typescript
// src/store/ui-store.ts
export type PreferencesPane =
  | 'general' | 'appearance' | 'advanced' | 'about'
  | 'categories' | 'feeds' | 'users' | 'token';

interface UIState {
  // ... existing
  preferencesOpen: boolean;
  preferencesActivePane: PreferencesPane;

  // New helper
  openPreferencesToPane: (pane: PreferencesPane) => void;
}
```

**Opening to Specific Pane:**
```typescript
// From UserNav - "Settings" menu item
const handleOpenSettings = () => {
  useUIStore.getState().openPreferencesToPane('categories');
  useUIStore.getState().setPreferencesOpen(true);
};
```

### 5. Access Methods

**Primary Access:**
1. **Keyboard shortcut** - Opens to last-viewed pane or 'general' (default)
2. **Settings button** - To be added in app header/sidebar (opens to 'general')

**Deprecated:**
- User menu "Settings" item - Will open main dialog to 'categories' pane instead

### 6. Cleanup & Migration

**Files to Delete:**
- `src/components/miniflux/MinifluxSettingsDialog.tsx`

**Files to Move:**
- `miniflux/settings/CategoriesPane.tsx` → `preferences/panes/CategoriesPane.tsx`
- `miniflux/settings/FeedsPane.tsx` → `preferences/panes/FeedsPane.tsx`
- `miniflux/settings/UsersPane.tsx` → `preferences/panes/UsersPane.tsx`

**Files to Keep (unchanged):**
- `miniflux/settings/store.tsx` - Zustand store for dialog states
- `miniflux/settings/FeedFormDialog.tsx`
- `miniflux/settings/CategoryFormDialog.tsx`
- `miniflux/settings/UserFormDialog.tsx`
- `miniflux/settings/DeleteEntityDialog.tsx`
- `miniflux/settings/FeedCategoryDialogsHost.tsx`

**Component Updates:**
- `UserNav.tsx` - Remove local state, use UI store
- `AppSidebar.tsx` - No changes (uses existing store)

## Implementation Considerations

### API Usage
- All existing Miniflux service hooks preserved
- No changes to `src/services/miniflux/`
- Queries use `enabled` parameter to skip when disconnected

### Error Handling
- Existing toast notifications preserved
- Connection errors handled at service layer
- No additional error handling needed

### Performance
- No API calls for Miniflux panes when disconnected
- Desktop app settings unaffected by connection state
- Lazy loading of pane content

### Testing Checklist
- [ ] Connection state transitions (connected → disconnected → connected)
- [ ] Pane switching between app and server settings
- [ ] Admin user login/logout (Users pane visibility)
- [ ] Dialog open/close state persistence
- [ ] Keyboard navigation through sidebar
- [ ] Opening to specific panes from different entry points
- [ ] Toast notifications for connection state changes
- [ ] Badge counts display correctly

### Accessibility
- All existing features preserved
- Screen reader announcements for section headers
- Focus management when Server Settings appears/disappears
- ARIA attributes properly set

## Benefits

1. **Unified experience:** Single location for all settings
2. **Clear mental model:** Visual separation between local and remote settings
3. **Scalable:** Easy to add new settings to either section
4. **Maintainable:** Fewer dialog components to manage
5. **User-friendly:** Familiar pattern from other applications

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Users confused by merged dialog | Clear section headers and visual separation |
| Miniflux features harder to find | Keep "Settings" in user menu that opens to Categories pane |
| Admin users can't find Users pane | Keep visibility reactive, show when user is admin |
| State management complexity | Reuse existing stores, minimal changes |

## Future Enhancements

1. Add search/filter for settings items
2. Add "recently used" panes
3. Consider adding Accounts pane for multi-server support
4. Add keyboard shortcuts for direct pane access (Cmd+, for General, Cmd+Shift+C for Categories, etc.)
