# Merged Preferences Dialog Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Merge Miniflux settings into the main Preferences dialog with clear separation between desktop app and server settings.

**Architecture:** Extend existing PreferencesDialog with grouped sidebar (App Settings vs Server Settings). Move Miniflux panes from separate dialog into preferences/panes. Hide Server Settings section when not connected to Miniflux API. Reuse existing Zustand store for Miniflux dialog states.

**Tech Stack:** React 19, Zustand v5, TanStack Query, Radix UI Sidebar, Hugeicons, Lingui i18n, TypeScript

---

## Task 1: Update UI Store Types

**Files:**
- Modify: `src/store/ui-store.ts:5-6,50,96`

**Context:** Extend PreferencesPane type to include Miniflux panes. Add helper action to open preferences to specific pane.

**Step 1: Update PreferencesPane type**

Find line 5:
```typescript
export type PreferencesPane = 'general' | 'appearance' | 'advanced' | 'about';
```

Replace with:
```typescript
export type PreferencesPane =
  | 'general'
  | 'appearance'
  | 'advanced'
  | 'about'
  | 'categories'
  | 'feeds'
  | 'users'
  | 'token';
```

**Step 2: Add openPreferencesToPane to interface**

Find the UIState interface (around line 7) and add after line 26:
```typescript
openPreferencesToPane: (pane: PreferencesPane) => void;
```

**Step 3: Implement openPreferencesToPane action**

Find the actions object in the create function (around line 45) and add after the setPreferencesActivePane action (around line 96):
```typescript
openPreferencesToPane: (pane: PreferencesPane) =>
  set({ preferencesActivePane: pane, preferencesOpen: true }, undefined, 'openPreferencesToPane'),
```

**Step 4: Type check**

Run: `bun run typecheck`

Expected: PASS (no type errors)

**Step 5: Commit**

```bash
git add src/store/ui-store.ts
git commit -m "feat: extend PreferencesPane type and add openPreferencesToPane helper

- Add categories, feeds, users, token to PreferencesPane type
- Add openPreferencesToPane action for opening preferences to specific pane
- Supports opening preferences dialog to Miniflux server settings"
```

---

## Task 2: Move Miniflux Panes to Preferences

**Files:**
- Create: `src/components/preferences/panes/CategoriesPane.tsx` (move from miniflux/settings/)
- Create: `src/components/preferences/panes/FeedsPane.tsx` (move from miniflux/settings/)
- Create: `src/components/preferences/panes/UsersPane.tsx` (move from miniflux/settings/)
- Create: `src/components/preferences/panes/ApiTokenPane.tsx` (new, extract content)
- Delete: `src/components/miniflux/MinifluxSettingsDialog.tsx`

**Step 1: Read MinifluxSettingsDialog to extract ApiTokenPane**

Read: `src/components/miniflux/MinifluxSettingsDialog.tsx:503-530`

The token pane content is in the main dialog component. Extract this into a separate component.

**Step 2: Create ApiTokenPane component**

Create: `src/components/preferences/panes/ApiTokenPane.tsx`

```typescript
import { Key01Icon } from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react';
import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { queryClient } from '@/lib/query-client';
import { commands } from '@/lib/tauri-bindings';
import { useActiveAccount } from '@/services/miniflux/accounts';

export function ApiTokenPane() {
  const { _ } = useLingui();
  const { data: currentAccount } = useActiveAccount();
  const [tokenValue, setTokenValue] = React.useState('');
  const [isSavingToken, setIsSavingToken] = React.useState(false);

  const handleSaveToken = async () => {
    if (!currentAccount || !tokenValue.trim()) {
      return;
    }

    setIsSavingToken(true);

    try {
      const result = await commands.minifluxConnect({
        // biome-ignore lint/style/useNamingConvention: API field names
        server_url: currentAccount.server_url,
        // biome-ignore lint/style/useNamingConvention: API field names
        auth_token: tokenValue.trim(),
      });

      if (result.status === 'error') {
        toast.error(_(msg`Failed to update API token`), {
          description: result.error,
        });
        return;
      }

      setTokenValue('');
      queryClient.invalidateQueries({ queryKey: ['miniflux'] });
      toast.success(_(msg`API token updated`));
    } finally {
      setIsSavingToken(false);
    }
  };

  return (
    <section className="space-y-3 rounded-md border p-4">
      <div className="flex items-center gap-2">
        <HugeiconsIcon icon={Key01Icon} className="size-4 text-muted-foreground" />
        <h3 className="text-sm font-semibold">{_(msg`API token`)}</h3>
      </div>
      <div className="text-xs text-muted-foreground">
        {currentAccount
          ? `${_(msg`Server`)}: ${currentAccount.server_url}`
          : _(msg`No active account`)}
      </div>
      <div className="flex gap-2">
        <Input
          type="password"
          value={tokenValue}
          onChange={(event) => setTokenValue(event.target.value)}
          placeholder={_(msg`Paste new API token`)}
          disabled={isSavingToken || !currentAccount}
        />
        <Button
          onClick={handleSaveToken}
          disabled={isSavingToken || !currentAccount || !tokenValue.trim()}
        >
          {_(msg`Update token`)}
        </Button>
      </div>
    </section>
  );
}
```

**Step 3: Move CategoriesPane**

Run: `git mv src/components/miniflux/settings/CategoriesPane.tsx src/components/preferences/panes/CategoriesPane.tsx`

**Step 4: Move FeedsPane**

Run: `git mv src/components/miniflux/settings/FeedsPane.tsx src/components/preferences/panes/FeedsPane.tsx`

**Step 5: Move UsersPane**

Run: `git mv src/components/miniflux/settings/UsersPane.tsx src/components/preferences/panes/UsersPane.tsx`

**Step 6: Type check**

Run: `bun run typecheck`

Expected: PASS (may have import errors in files that import these, will fix in next task)

**Step 7: Commit moves**

```bash
git add src/components/preferences/panes/CategoriesPane.tsx \
        src/components/preferences/panes/FeedsPane.tsx \
        src/components/preferences/panes/UsersPane.tsx \
        src/components/preferences/panes/ApiTokenPane.tsx
git commit -m "refactor: move Miniflux panes to preferences directory

- Move CategoriesPane, FeedsPane, UsersPane to preferences/panes/
- Extract ApiTokenPane from MinifluxSettingsDialog
- Prepare for merging into unified Preferences dialog"
```

---

## Task 3: Update PreferencesDialog Component

**Files:**
- Modify: `src/components/preferences/PreferencesDialog.tsx`

**Step 1: Add new imports**

Add to imports (after line 33):
```typescript
import { useIsConnected, useCurrentUser } from '@/services/miniflux';
import { CategoriesPane } from './panes/CategoriesPane';
import { FeedsPane } from './panes/FeedsPane';
import { UsersPane } from './panes/UsersPane';
import { ApiTokenPane } from './panes/ApiTokenPane';
```

Update navigationItems import and definition (lines 35-56):
```typescript
import {
  InformationCircleIcon,
  Settings01Icon,
  ZapIcon,
  ColorsIcon,
  Folder01Icon,
  RssIcon,
  UserGroupIcon,
  Key01Icon,
} from '@hugeicons/core-free-icons';

const appSettingsItems = [
  {
    id: 'general' as const,
    label: msg`General`,
    icon: Settings01Icon,
  },
  {
    id: 'appearance' as const,
    label: msg`Appearance`,
    icon: ColorsIcon,
  },
  {
    id: 'advanced' as const,
    label: msg`Advanced`,
    icon: ZapIcon,
  },
  {
    id: 'about' as const,
    label: msg`About`,
    icon: InformationCircleIcon,
  },
] as const;

const serverSettingsItems = [
  {
    id: 'categories' as const,
    label: msg`Categories`,
    icon: Folder01Icon,
  },
  {
    id: 'feeds' as const,
    label: msg`Feeds`,
    icon: RssIcon,
  },
  {
    id: 'users' as const,
    label: msg`Users`,
    icon: UserGroupIcon,
  },
  {
    id: 'token' as const,
    label: msg`API token`,
    icon: Key01Icon,
  },
] as const;
```

**Step 2: Update component to use connection state**

Add hooks at start of component function (after line 60):
```typescript
const { data: isConnected } = useIsConnected();
const { data: currentUser } = useCurrentUser();
```

**Step 3: Update getPaneTitle function**

Replace getPaneTitle (lines 65-68) with:
```typescript
const getPaneTitle = (pane: PreferencesPane): string => {
  const allItems = [...appSettingsItems, ...serverSettingsItems];
  const item = allItems.find((i) => i.id === pane);
  return item ? _(item.label) : pane;
};
```

**Step 4: Update sidebar to show sections**

Replace the Sidebar section (lines 79-99) with:
```typescript
<Sidebar collapsible="none" className="hidden md:flex bg-background py-4">
  <SidebarContent>
    {/* App Settings Section */}
    <SidebarGroup>
      <SidebarGroupLabel>{_(msg`App Settings`)}</SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu className="gap-1">
          {appSettingsItems.map((item) => (
            <SidebarMenuItem key={item.id}>
              <SidebarMenuButton
                isActive={activePane === item.id}
                onClick={() => setPreferencesActivePane(item.id)}
              >
                <HugeiconsIcon icon={item.icon} />
                <span>{_(item.label)}</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>

    {/* Server Settings Section */}
    {isConnected && (
      <SidebarGroup>
        <SidebarGroupLabel>{_(msg`Server Settings`)}</SidebarGroupLabel>
        <SidebarGroupContent>
          <SidebarMenu className="gap-1">
            {serverSettingsItems
              .filter((item) => item.id !== 'users' || (currentUser?.is_admin ?? false))
              .map((item) => (
                <SidebarMenuItem key={item.id}>
                  <SidebarMenuButton
                    isActive={activePane === item.id}
                    onClick={() => setPreferencesActivePane(item.id)}
                  >
                    <HugeiconsIcon icon={item.icon} />
                    <span>{_(item.label)}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      )}
  </SidebarContent>
</Sidebar>
```

**Step 5: Add mobile sidebar buttons**

Replace mobile header section (lines 102-117) with:
```typescript
<header className="flex h-16 shrink-0 items-center gap-2 border-b md:hidden">
  <div className="flex flex-1 items-center gap-2 px-4">
    <Breadcrumb>
      <BreadcrumbList>
        <BreadcrumbItem>
          <BreadcrumbLink asChild>
            <span>{_(msg`Preferences`)}</span>
          </BreadcrumbLink>
        </BreadcrumbItem>
        <BreadcrumbSeparator />
        <BreadcrumbItem>
          <BreadcrumbPage>{getPaneTitle(activePane)}</BreadcrumbPage>
        </BreadcrumbItem>
      </BreadcrumbList>
    </Breadcrumb>
  </div>
</header>

<div className="border-b p-2 md:hidden">
  <div className="space-y-2">
    {/* App Settings */}
    <div class="text-xs font-semibold text-muted-foreground px-2">{_(msg`App Settings`)}</div>
    <div className="grid grid-cols-2 gap-1">
      {appSettingsItems.map((item) => (
        <Button
          key={item.id}
          size="sm"
          variant={activePane === item.id ? 'secondary' : 'ghost'}
          className="justify-start"
          onClick={() => setPreferencesActivePane(item.id)}
        >
          <HugeiconsIcon icon={item.icon} className="mr-1.5 size-4" />
          {_(item.label)}
        </Button>
      ))}
    </div>

    {/* Server Settings */}
    {isConnected && (
      <>
        <div class="text-xs font-semibold text-muted-foreground px-2 pt-2">{_(msg`Server Settings`)}</div>
        <div className="grid grid-cols-2 gap-1">
          {serverSettingsItems
            .filter((item) => item.id !== 'users' || (currentUser?.is_admin ?? false))
            .map((item) => (
              <Button
                key={item.id}
                size="sm"
                variant={activePane === item.id ? 'secondary' : 'ghost'}
                className="justify-start"
                onClick={() => setPreferencesActivePane(item.id)}
              >
                <HugeiconsIcon icon={item.icon} className="mr-1.5 size-4" />
                {_(item.label)}
              </Button>
            ))}
        </div>
      </>
    )}
  </div>
</div>
```

**Step 6: Update desktop header**

Replace desktop header (lines 118-127) with:
```typescript
<header className="hidden md:flex h-16 shrink-0 items-center gap-2 border-b px-4">
  <div className="flex items-center gap-2">
    <Breadcrumb>
      <BreadcrumbList>
        <BreadcrumbItem>
          <BreadcrumbLink asChild>
            <span>{_(msg`Preferences`)}</span>
          </BreadcrumbLink>
        </BreadcrumbItem>
        <BreadcrumbSeparator />
        <BreadcrumbItem>
          <BreadcrumbPage>{getPaneTitle(activePane)}</BreadcrumbPage>
        </BreadcrumbItem>
      </BreadcrumbList>
    </Breadcrumb>
  </div>
</header>
```

**Step 7: Add Miniflux panes to content area**

Update content area (lines 120-125) to include new panes:
```typescript
<div className="flex flex-1 flex-col gap-4 overflow-y-auto p-4 pt-0 max-h-[calc(600px-4rem)]">
  {/* App Settings */}
  {activePane === 'general' && <GeneralPane />}
  {activePane === 'appearance' && <AppearancePane />}
  {activePane === 'advanced' && <AdvancedPane />}
  {activePane === 'about' && <AboutPane />}

  {/* Server Settings - shown when connected, otherwise show message */}
  {activePane === 'categories' && (
    isConnected ? <CategoriesPane /> : <ConnectionStatePane />
  )}
  {activePane === 'feeds' && (
    isConnected ? <FeedsPane /> : <ConnectionStatePane />
  )}
  {activePane === 'users' && (
    isConnected ? <UsersPane /> : <ConnectionStatePane />
  )}
  {activePane === 'token' && (
    isConnected ? <ApiTokenPane /> : <ConnectionStatePane />
  )}
</div>
```

**Step 8: Add ConnectionStatePane helper component**

Add before main component:
```typescript
function ConnectionStatePane() {
  const { _ } = useLingui();
  return (
    <div className="flex items-center justify-center h-full">
      <p className="text-sm text-muted-foreground">{_(msg`Not connected to Miniflux server`)}</p>
    </div>
  );
}
```

**Step 9: Type check**

Run: `bun run typecheck`

Expected: PASS

**Step 10: Lint check**

Run: `bun run biome check --write src/components/preferences/PreferencesDialog.tsx`

Expected: PASS with no errors

**Step 11: Commit**

```bash
git add src/components/preferences/PreferencesDialog.tsx
git commit -m "feat: merge Miniflux settings into Preferences dialog

- Add Server Settings section that hides when not connected
- Add categories, feeds, users, API token panes
- Show App Settings and Server Settings as separate sections
- Filter Users pane for admin-only access
- Show connection state message when disconnected and on server pane"
```

---

## Task 4: Wrap PreferencesDialog with MinifluxSettingsDialogProvider

**Files:**
- Modify: `src/components/preferences/PreferencesDialog.tsx`
- Modify: `src/components/layout/App.tsx` or wherever PreferencesDialog is used

**Step 1: Add provider wrapper to PreferencesDialog**

Update PreferencesDialog to wrap content with provider:

Add import:
```typescript
import {
  MinifluxSettingsDialogProvider,
} from '@/components/miniflux/settings/store';
import { FeedCategoryDialogsHost } from '@/components/miniflux/settings/FeedCategoryDialogsHost';
import { UserFormDialog } from '@/components/miniflux/settings/UserFormDialog';
import { DeleteEntityDialog } from '@/components/miniflux/settings/DeleteEntityDialog';
```

Wrap the DialogContent return:
```typescript
export function PreferencesDialog() {
  // ... existing hooks

  return (
    <MinifluxSettingsDialogProvider>
      <Dialog open={preferencesOpen} onOpenChange={setPreferencesOpen}>
        <DialogContent className="overflow-hidden p-0 md:max-h-150 md:max-w-225 lg:max-w-250 font-sans rounded-xl">
          {/* ... existing content */}
        </DialogContent>

        {/* Nested dialogs for Miniflux entities */}
        <FeedCategoryDialogsHost />
        <UserFormDialog />
        <DeleteEntityDialog />
      </Dialog>
    </MinifluxSettingsDialogProvider>
  );
}
```

**Step 2: Type check**

Run: `bun run typecheck`

Expected: PASS

**Step 3: Commit**

```bash
git add src/components/preferences/PreferencesDialog.tsx
git commit -m "feat: add Miniflux dialog providers to Preferences

- Wrap PreferencesDialog with MinifluxSettingsDialogProvider
- Add FeedCategoryDialogsHost, UserFormDialog, DeleteEntityDialog
- Enables category/feed/user CRUD operations from preferences"
```

---

## Task 5: Update Miniflux Panes with Props

**Files:**
- Modify: `src/components/preferences/panes/CategoriesPane.tsx`
- Modify: `src/components/preferences/panes/FeedsPane.tsx`
- Modify: `src/components/preferences/panes/UsersPane.tsx`

**Context:** These panes need dialog state handlers from the MinifluxSettingsDialogStore. They currently get these from props in the old MinifluxSettingsDialog. Now the parent PreferencesDialog needs to provide them.

**Step 1: Read current pane implementations**

Read: `src/components/preferences/panes/CategoriesPane.tsx`
Read: `src/components/preferences/panes/FeedsPane.tsx`
Read: `src/components/preferences/panes/UsersPane.tsx`

Note the props they currently accept and how they use dialog state.

**Step 2: Create hooks for dialog state in PreferencesDialog**

In PreferencesDialog component, add:
```typescript
import { useMinifluxSettingsDialogStore } from '@/components/miniflux/settings/store';

// In component, add:
const setCategoryDialogState = useMinifluxSettingsDialogStore(
  (state) => state.setCategoryDialogState
);
const setFeedDialogState = useMinifluxSettingsDialogStore((state) => state.setFeedDialogState);
const setUserDialogState = React.useState<UserDialogState | null>(null);
const setDeleteDialogState = React.useState<DeleteDialogState | null>(null);
```

**Step 3: Update CategoriesPane usage**

Update how CategoriesPane is rendered:
```typescript
{activePane === 'categories' && isConnected && (
  <CategoriesPane
    categories={categories}
    filteredCategories={filteredCategories}
    searchQuery={categorySearchQuery}
    onSearchChange={setCategorySearchQuery}
    onAddCategory={() => setCategoryDialogState({ mode: 'create' })}
    onEditCategory={(category) => setCategoryDialogState({ mode: 'edit', category })}
    onDeleteCategory={(category) =>
      setDeleteDialogState({
        type: 'category',
        id: category.id,
        title: category.title,
      })
    }
  />
)}
```

**Step 4: Add data fetching hooks to PreferencesDialog**

Add necessary hooks for data:
```typescript
const { data: categories = [] } = useCategories(isConnected);
const { data: feeds = [] } = useFeeds(isConnected);
const { data: users = [], isError: usersError } = useMinifluxUsers(
  isConnected && (currentUser?.is_admin ?? false)
);
```

**Step 5: Add local state for search queries**

```typescript
const [categorySearchQuery, setCategorySearchQuery] = React.useState('');
const [feedSearchQuery, setFeedSearchQuery] = React.useState('');
```

**Step 6: Update FeedsPane and UsersPane similarly**

Follow the same pattern for FeedsPane and UsersPane with their respective props.

**Step 7: Type check**

Run: `bun run typecheck`

Expected: PASS

**Step 8: Commit**

```bash
git add src/components/preferences/PreferencesDialog.tsx
git commit -m "feat: wire up Miniflux pane handlers in PreferencesDialog

- Add dialog state handlers from MinifluxSettingsDialogStore
- Pass category/feed/user dialog handlers to panes
- Add data fetching hooks for Miniflux entities
- Add local state for search queries"
```

---

## Task 6: Update UserNav to Use Preferences Dialog

**Files:**
- Modify: `src/components/miniflux/UserNav.tsx`

**Step 1: Read UserNav component**

Read: `src/components/miniflux/UserNav.tsx`

Find the settingsOpen state and MinifluxSettingsDialog usage.

**Step 2: Remove MinifluxSettingsDialog import and usage**

Remove import (line 16):
```typescript
import { MinifluxSettingsDialog } from '@/components/miniflux/MinifluxSettingsDialog';
```

Remove local state (find and remove):
```typescript
const [settingsOpen, setSettingsOpen] = useState(false);
```

Remove dialog component (find and remove the component at end of file around line 218):
```typescript
<MinifluxSettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />
```

**Step 3: Add UI store import**

Add to imports:
```typescript
import { useUIStore } from '@/store/ui-store';
```

**Step 4: Update handleOpenSettings handler**

Find the settings menu item handler and update to use preferences:
```typescript
const handleOpenSettings = () => {
  setPreferencesActivePane('categories');
  setPreferencesOpen(true);
};
```

Or if it uses local state, update to:
```typescript
const setPreferencesOpen = useUIStore((state) => state.setPreferencesOpen);
const setPreferencesActivePane = useUIStore((state) => state.setPreferencesActivePane);

const handleOpenSettings = () => {
  setPreferencesActivePane('categories');
  setPreferencesOpen(true);
};
```

**Step 5: Type check**

Run: `bun run typecheck`

Expected: PASS

**Step 6: Commit**

```bash
git add src/components/miniflux/UserNav.tsx
git commit -m "refactor: update UserNav to open main Preferences dialog

- Remove MinifluxSettingsDialog usage
- Use UI store to open Preferences dialog to Categories pane
- Simplify settings access from user menu"
```

---

## Task 7: Delete Old MinifluxSettingsDialog

**Files:**
- Delete: `src/components/miniflux/MinifluxSettingsDialog.tsx`
- Delete: `src/components/miniflux/settings/dialog-state.ts`

**Step 1: Delete MinifluxSettingsDialog**

Run: `rm src/components/miniflux/MinifluxSettingsDialog.tsx`

**Step 2: Check if dialog-state.ts is still used**

Run: `grep -r "dialog-state" src/ --exclude-dir=node_modules`

If no results (except the file itself), delete it:
```bash
rm src/components/miniflux/settings/dialog-state.ts
```

If there are results, update those files to import types from a different location or define types inline.

**Step 3: Type check**

Run: `bun run typecheck`

Expected: PASS (if dialog-state types are moved/referenced correctly)

**Step 4: Commit**

```bash
git add -A
git commit -m "refactor: remove MinifluxSettingsDialog component

- Delete MinifluxSettingsDialog.tsx (functionality merged to Preferences)
- Delete dialog-state.ts (types moved or no longer needed)
- Clean up after dialog merge"
```

---

## Task 8: Fix Lefthook Glob Pattern

**Files:**
- Modify: `lefthook.yml:5`

**Context:** The glob pattern currently only matches root files. Needs to match files in subdirectories.

**Step 1: Update glob pattern**

Change line 5 from:
```yaml
glob: '*.{js,jsx,ts,tsx,json,css,md}'
```

To:
```yaml
glob: '**/*.{js,jsx,ts,tsx,json,css,md}'
```

**Step 2: Test lefthook**

Run: `git add lefthook.yml && git commit -m "test: verify lefthook glob fix"`

Expected: Should now check files in subdirectories like `docs/plans/`

If it works, amend the commit with proper message:
```bash
git commit --amend -m "fix: update lefthook glob pattern to match subdirectories

- Change glob from '*.{ext}' to '**/*.{ext}'
- Enables biome-check to process files in nested directories"
```

If it fails, revert and investigate:
```bash
git reset HEAD~1
```

**Step 3: Commit the design document**

Now that lefthook is fixed, commit the design document:
```bash
git add docs/plans/2026-02-17-merged-preferences-dialog-design.md
git commit -m "docs: add merged preferences dialog design"
```

---

## Task 9: Update Translations

**Files:**
- Modify: `src/locales/en/messages.po` (or whichever locale you use)
- Run: `bun run i18n:extract`

**Step 1: Extract new translatable strings**

Run: `bun run i18n:extract`

This will find all new `msg` strings used in the code (like "App Settings", "Server Settings", etc.).

**Step 2: Review extracted messages**

Check the generated .po file for any new messages that need translation.

**Step 3: Compile translations**

Run: `bun run i18n:compile`

**Step 4: Commit**

```bash
git add src/locales/
git commit -m "i18n: add translations for merged preferences dialog

- Add 'App Settings' and 'Server Settings' section labels
- Extract and compile new translatable strings"
```

---

## Task 10: Manual Testing

**Context:** No automated tests for UI components. Manual testing required.

**Test Checklist:**

**Connection State:**
- [ ] Open preferences when disconnected - only see App Settings
- [ ] Connect to Miniflux - Server Settings section appears
- [ ] Disconnect while viewing Server Settings pane - switches to General
- [ ] Reconnect - Server Settings section reappears

**Navigation:**
- [ ] Navigate between all panes
- [ ] Keyboard navigation works (tab through sidebar items)
- [ ] Active pane highlighting works
- [ ] Breadcrumbs show correct path

**Pane Functionality:**
- [ ] Categories pane: add, edit, delete categories
- [ ] Feeds pane: add, edit, delete, refresh feeds
- [ ] Users pane: add, edit, delete users (admin only)
- [ ] API Token pane: update token successfully
- [ ] Desktop app panes still work (General, Appearance, etc.)

**Admin Access:**
- [ ] Admin user sees Users menu item
- [ ] Non-admin user doesn't see Users menu item
- [ ] Admin loses access - Users item disappears

**Mobile:**
- [ ] Mobile view shows grouped buttons correctly
- [ ] Server Settings buttons hidden when disconnected

**Dialog State:**
- [ ] Open category/feed dialog from preferences
- [ ] Dialogs open and close correctly
- [ ] State persists across dialog closes

**Entry Points:**
- [ ] Keyboard shortcut opens to last-viewed pane
- [ ] User menu "Settings" opens to Categories pane
- [ ] (Future) Settings button opens to General pane

**Step 1: Run dev server**

Run: `bun run dev`

Expected: App starts without errors

**Step 2: Test each checklist item**

Go through the checklist above, testing each item.

**Step 3: Document any issues**

If issues found, create tasks to fix them. If all works, continue.

---

## Task 11: Update Documentation

**Files:**
- Create: `docs/developer/preferences-dialog.md` (if it doesn't exist)
- Update: `README.md` (if preferences/settings are documented)

**Step 1: Create preferences dialog documentation**

Create: `docs/developer/preferences-dialog.md`

```markdown
# Preferences Dialog

## Overview

The Preferences dialog is the unified settings interface for the application, combining desktop app settings and Miniflux server management.

## Structure

### App Settings Section

Always visible, contains desktop application settings:

- **General**: System tray behavior, close button, download paths
- **Appearance**: Theme and visual settings
- **Advanced**: Advanced application settings
- **About**: Application information

### Server Settings Section

Only visible when connected to Miniflux API, contains server management:

- **Categories**: Manage feed categories (CRUD operations)
- **Feeds**: Manage RSS feeds (CRUD, refresh)
- **Users**: Manage Miniflux users (admin only)
- **API Token**: Update current account's API token

## Access

- **Keyboard shortcut**: Opens to last-viewed pane (or General if none)
- **User menu**: "Settings" opens to Categories pane
- **Settings button**: (TODO) Opens to General pane

## Connection State

When not connected to Miniflux:
- Server Settings section is hidden
- If viewing a Server Settings pane when connection is lost, auto-switch to General
- Toast notification shown: "Disconnected from Miniflux server"

When connected:
- Server Settings section appears
- All server management panes accessible

## Adding New Settings

### App Settings

1. Add new pane to `src/components/preferences/panes/`
2. Add to `appSettingsItems` array in PreferencesDialog.tsx
3. Update PreferencesPane type in ui-store.ts
4. Add case in content area rendering

### Server Settings

1. Add new pane to `src/components/preferences/panes/`
2. Add to `serverSettingsItems` array in PreferencesDialog.tsx
3. Update PreferencesPane type in ui-store.ts
4. Add case in content area rendering
5. Ensure connection check before rendering

## Architecture

- **State**: UI store (preferencesOpen, preferencesActivePane)
- **Dialog State**: MinifluxSettingsDialogStore for entity CRUD dialogs
- **Data fetching**: TanStack Query hooks from services/miniflux
- **Providers**: MinifluxSettingsDialogProvider wraps PreferencesDialog
```

**Step 2: Update main README if needed**

Check if README.md has a "Settings" or "Preferences" section that needs updating.

**Step 3: Commit documentation**

```bash
git add docs/
git commit -m "docs: add Preferences dialog documentation

- Document unified preferences structure
- Explain App Settings vs Server Settings sections
- Describe connection state behavior
- Provide guide for adding new settings"
```

---

## Task 12: Final Verification

**Step 1: Run all checks**

Run: `bun run check:all`

This runs:
- typecheck
- biome check
- clippy
- cargo test
- cargo fmt check

Expected: All pass

**Step 2: Start dev server and verify**

Run: `bun run dev`

Expected:
- App starts successfully
- No console errors
- Can open Preferences dialog
- Can navigate between panes
- Miniflux functionality works when connected

**Step 3: Create summary commit**

If everything works:
```bash
git add -A
git commit -m "feat: complete Miniflux settings merge into Preferences dialog

BREAKING CHANGE: MinifluxSettingsDialog has been removed. All settings
are now accessed through the unified Preferences dialog.

- Desktop app and server settings in single dialog
- Clear separation with App Settings and Server Settings sections
- Server section hidden when not connected to Miniflux
- User menu 'Settings' now opens main Preferences dialog
- All existing functionality preserved
```

---

## Success Criteria

- [ ] Single Preferences dialog with App Settings and Server Settings sections
- [ ] Server Settings section hidden when not connected to Miniflux
- [ ] All Miniflux management features work (categories, feeds, users, token)
- [ ] Desktop app settings unchanged
- [ ] MinifluxSettingsDialog component removed
- [ ] All type checks and linting pass
- [ ] Manual testing checklist complete
- [ ] Documentation updated

## Notes

- The Miniflux settings panes were moved from `src/components/miniflux/settings/` to `src/components/preferences/panes/`
- The `MinifluxSettingsDialogStore` is preserved for managing category/feed/user dialog states
- Connection state is managed via `useIsConnected()` and `useCurrentUser()` hooks
- Admin-only features (Users pane) are conditionally rendered based on `currentUser?.is_admin`
- Mobile responsive design with grouped buttons for each section
