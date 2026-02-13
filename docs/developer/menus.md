# Native Menu System

Cross-platform native menu system built with JavaScript for i18n support, integrating with keyboard shortcuts and the command system.

## Overview

This app builds menus from **JavaScript** using Tauri's JS Menu API (`@tauri-apps/api/menu`). This enables:

- Runtime translation via Lingui
- Dynamic menu rebuilding when language changes
- Direct integration with React state (Zustand)

## Current Menu Structure

```
App Name
├── About App Name
├── ────────────────────
├── Check for Updates...
├── ────────────────────
├── Preferences...           (Cmd+,)
├── ────────────────────
├── Hide App Name            (Cmd+H)
├── Hide Others              (Cmd+Alt+H)
├── Show All
├── ────────────────────
└── Quit App Name            (Cmd+Q)

View
├── Toggle Left Sidebar      (Cmd+1)
└── Toggle Right Sidebar     (Cmd+2)
```

## Architecture

### Menu Builder (`src/lib/menu.ts`)

Menus are built using translated labels and direct action handlers:

```typescript
import { msg } from '@lingui/core/macro';
import {
  Menu,
  MenuItem,
  Submenu,
  PredefinedMenuItem,
} from '@tauri-apps/api/menu';
import { i18n } from '@lingui/core';
import { useUIStore } from '@/store/ui-store';

export async function buildAppMenu(): Promise<Menu> {
  const _ = i18n._.bind(i18n);

  const appSubmenu = await Submenu.new({
    text: APP_NAME,
    items: [
      await MenuItem.new({
        id: 'preferences',
        text: _(msg`Preferences...`),
        accelerator: 'CmdOrCtrl+,',
        action: handleOpenPreferences,
      }),
      // ... more items
    ],
  });

  const menu = await Menu.new({
    items: [appSubmenu, viewSubmenu],
  });

  await menu.setAsAppMenu();
  return menu;
}

function handleOpenPreferences(): void {
  useUIStore.getState().setPreferencesActivePane('general');
  useUIStore.getState().setPreferencesOpen(true);
}

function handleAbout(): void {
  useUIStore.getState().setPreferencesActivePane('about');
  useUIStore.getState().setPreferencesOpen(true);
}
```

### Language Change Handling

Menus are automatically rebuilt when the language changes:

```typescript
export function setupMenuLanguageListener(): () => void {
  const handler = async () => {
    await buildAppMenu();
  };

  const unsubscribe = i18n.on('change', handler);
  return () => {
    if (unsubscribe) unsubscribe();
  };
}
```

## Menu Item Types

### Custom Menu Items

```typescript
await MenuItem.new({
  id: 'my-action',
  text: _(msg`My Action`),
  accelerator: 'CmdOrCtrl+M',
  action: handleMyAction,
});
```

### Predefined Items

Tauri provides common system menu items:

```typescript
await PredefinedMenuItem.new({ item: 'Separator' });
await PredefinedMenuItem.new({ item: 'Hide', text: _(msg`Hide`) });
await PredefinedMenuItem.new({ item: 'Quit', text: _(msg`Quit`) });
await PredefinedMenuItem.new({ item: 'Copy' });
await PredefinedMenuItem.new({ item: 'Paste' });
```

### Submenus

```typescript
const viewSubmenu = await Submenu.new({
  text: _(msg`View`),
  items: [
    await MenuItem.new({ id: 'toggle-sidebar', text: _(msg`Toggle Sidebar`), ... }),
  ],
});
```

## Adding New Menu Items

### Step 1: Add to Menu Builder

```typescript
// src/lib/menu.ts
await MenuItem.new({
  id: 'my-new-action',
  text: _(msg`My New Action`),
  accelerator: 'CmdOrCtrl+N',
  action: handleMyNewAction,
});

function handleMyNewAction(): void {
  // Use getState() for current store values
  const { someValue } = useUIStore.getState();
  // Perform action
}
```

### Step 2: Extract and Compile Translations

```bash
bun run i18n:extract
bun run i18n:compile
```

### Step 3: Translate

Translate the new strings in all language PO files in `/src/locales/{locale}/messages.po`.

## Action Handlers

Menu actions use Zustand's `getState()` pattern for accessing current state:

```typescript
function handleToggleLeftSidebar(): void {
  const store = useUIStore.getState();
  store.setLeftSidebarVisible(!store.leftSidebarVisible);
}
```

This ensures handlers always have access to current state values.

## Platform Differences

| Platform      | Menu Location    | Modifier Key |
| ------------- | ---------------- | ------------ |
| macOS         | System menu bar  | Cmd          |
| Windows/Linux | Window title bar | Ctrl         |

The `CmdOrCtrl` accelerator automatically uses the correct modifier per platform.

## Troubleshooting

| Issue                     | Solution                                                    |
| ------------------------- | ----------------------------------------------------------- |
| Menu not appearing        | Ensure `buildAppMenu()` is called during app initialization |
| Translations not updating | Verify `setupMenuLanguageListener()` is called              |
| Action not working        | Check handler uses `getState()` for current values          |
| Accelerator conflicts     | Verify shortcut isn't used elsewhere in the app             |
