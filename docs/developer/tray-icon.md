# System Tray Icon

Comprehensive system tray icon implementation for Tauri v2 applications with cross-platform support.

## Overview

The tray icon feature provides:

- **Persistent tray icon** - Remains visible when main window is minimized or closed
- **Configurable close behavior** - Choose between quit or minimize-to-tray
- **Dynamic icon states** - Normal, notification badge, and alert states
- **Context menu** - Right-click menu with show/hide, quick actions, preferences, and quit
- **Left-click toggle** - Quick window visibility toggle
- **Cross-platform support** - Works on Windows, macOS, and Linux
- **Theme adaptation** - Template icons for macOS dark/light mode
- **Single-instance integration** - Toggle window on second instance launch

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Frontend (React)                        │
├─────────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐  │
│  │ Tray Service │  │ Preferences  │  │ Event Listeners  │  │
│  │  (hooks)     │  │   (settings) │  │  (open-prefs)    │  │
│  └──────┬───────┘  └──────┬───────┘  └────────┬─────────┘  │
└─────────┼─────────────────┼───────────────────┼────────────┘
          │                 │                   │
          └─────────────────┴───────────────────┘
                            │
                    ┌───────▼────────┐
                    │  Tauri Bridge  │
                    │  (tauri-specta)│
                    └───────┬────────┘
                            │
┌───────────────────────────▼─────────────────────────────────┐
│                   Backend (Rust)                            │
├─────────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐  │
│  │ Tray Commands│  │ Tray Module  │  │ Window Management│  │
│  │  (API)       │  │ (init/menu)  │  │  (show/hide)     │  │
│  └──────────────┘  └──────────────┘  └──────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

## Usage

### Frontend

#### Basic Tray Operations

```typescript
import {
  useShowWindow,
  useHideWindow,
  useToggleWindow,
  useSetTrayIconState,
  useSetTrayTooltip,
  useTrayEventListeners,
} from '@/services/tray';

function MyComponent() {
  const showWindow = useShowWindow();
  const hideWindow = useHideWindow();
  const toggleWindow = useToggleWindow();
  const setIconState = useSetTrayIconState();
  const setTooltip = useSetTrayTooltip();

  // Listen for tray events
  useTrayEventListeners(
    () => console.log('Open preferences from tray'),
    (action) => console.log('Quick action:', action)
  );

  return (
    <div>
      <button onClick={() => showWindow.mutate()}>Show Window</button>
      <button onClick={() => hideWindow.mutate()}>Hide Window</button>
      <button onClick={() => setIconState.mutate('notification')}>
        Set Notification Badge
      </button>
    </div>
  );
}
```

#### Tray Icon States

```typescript
import { useSetTrayIconState } from '@/services/tray';

const setIconState = useSetTrayIconState();

// Available states:
setIconState.mutate('normal');      // Default state
setIconState.mutate('notification'); // Red dot badge
setIconState.mutate('alert');       // Animated/pulsing alert
```

### Backend

#### Tray Commands

```rust
use crate::commands::tray;

// Show/hide window
tray::tray_show_window(app).await?;
tray::tray_hide_window(app).await?;
tray::tray_toggle_window(app).await?;

// Update icon state
tray::tray_set_icon_state(app, TrayIconState::Notification).await?;

// Update tooltip
tray::tray_set_tooltip(app, "3 unread messages".to_string()).await?;
```

#### Window Close Handling

```rust
use crate::commands::tray::handle_window_close_request;
use crate::types::CloseBehavior;

// In your window close handler:
fn on_window_close(app: &AppHandle, prefs: &AppPreferences) {
    match handle_window_close_request(app, &prefs.close_behavior) {
        Ok(true) => { /* Allow window close */ }
        Ok(false) => { /* Window hidden to tray */ }
        Err(e) => log::error!("Close handler error: {e}"),
    }
}
```

## Configuration

### Preferences

Tray settings are stored in [`AppPreferences`](src-tauri/src/types.rs):

```rust
pub struct AppPreferences {
    // ... other fields
    pub close_behavior: CloseBehavior,  // "quit" | "minimize_to_tray"
    pub show_tray_icon: bool,           // Show tray icon
    pub start_minimized: bool,          // Start minimized to tray
}
```

### UI Settings

The tray settings are available in **Preferences > General > System Tray**:

- **Close Button Behavior** - Choose what happens when closing the window
- **Show Tray Icon** - Enable/disable the tray icon (requires restart)
- **Start Minimized** - Start the app minimized to tray

## Tray Menu Structure

```
┌─────────────────────┐
│  Show Window        │  ← Hidden when visible
│  Hide Window        │  ← Hidden when hidden
├─────────────────────┤
│  Quick Action 1     │
│  Quick Action 2     │
├─────────────────────┤
│  Preferences...     │
├─────────────────────┤
│  Quit               │
└─────────────────────┘
```

### Menu Events

The tray emits events that the frontend can listen to:

```typescript
import { listen } from '@tauri-apps/api/event';

// Listen for preferences open request
listen('open-preferences', () => {
  // Open preferences dialog
});

// Listen for quick actions
listen<string>('tray-quick-action', (event) => {
  if (event.payload === 'action-1') {
    // Handle quick action 1
  }
});
```

## Icon States

| State | Description | Use Case |
|-------|-------------|----------|
| `normal` | Default app icon | Standard operation |
| `notification` | Badge/dot overlay | New messages/alerts |
| `alert` | Animated/pulsing | Urgent notifications |

## Platform Differences

### macOS

- Uses NSPanel for quick pane integration
- **Template icons adapt to dark/light mode** - Icons are automatically rendered in white (light mode) or black (dark mode)
- Menu appears on right-click (left-click toggles window)
- **Important**: Tray icons must be monochrome template icons for proper visibility
- Icons are automatically hidden by macOS if the menu bar is too crowded
- **Icon files**: The code looks for `32x32-template.png` first (monochrome), then falls back to `32x32.png` (colored)

### Windows

- Standard tray icon behavior
- Context menu on right-click
- Window state management via Win32 API

### Linux

- Uses system tray protocol
- May vary by desktop environment (GNOME, KDE, etc.)
- Tested on common distributions

## Implementation Details

### File Structure

```
src-tauri/src/
├── commands/
│   ├── mod.rs          # Command module exports
│   └── tray.rs         # Tray implementation
├── types.rs            # TrayIconState, CloseBehavior types
└── lib.rs              # Tray initialization

src/
├── services/
│   └── tray.ts         # Frontend tray hooks
├── components/preferences/panes/
│   └── GeneralPane.tsx # Tray settings UI
└── lib/
    └── tauri-bindings.ts # Type exports
```

### Key Types

```rust
// src-tauri/src/types.rs

#[derive(Debug, Clone, Serialize, Deserialize, Type, Default)]
#[serde(rename_all = "snake_case")]
pub enum TrayIconState {
    #[default]
    Normal,
    Notification,
    Alert,
}

#[derive(Debug, Clone, Serialize, Deserialize, Type, Default)]
#[serde(rename_all = "snake_case")]
pub enum CloseBehavior {
    Quit,
    #[default]
    MinimizeToTray,
}
```

### Commands

| Command | Description |
|---------|-------------|
| `tray_show_window` | Show and focus main window |
| `tray_hide_window` | Hide main window to tray |
| `tray_toggle_window` | Toggle window visibility |
| `tray_set_icon_state` | Update tray icon state |
| `tray_set_tooltip` | Update tray tooltip text |
| `tray_get_state` | Get current icon state |
| `tray_is_window_visible` | Check window visibility |

## Testing

Run Rust tests:

```bash
cd src-tauri && cargo test
```

Run TypeScript type check:

```bash
bun run typecheck
```

## Future Enhancements

- [ ] Custom icon sets per state
- [ ] Badge count overlay
- [ ] macOS template icon variants
- [ ] Animated GIF support for alert state
- [ ] Per-platform icon customization
- [ ] Tray menu i18n support

## Troubleshooting

### Tray Icon Not Visible on macOS

If the tray icon doesn't appear in the macOS menu bar:

1. **Check the logs**: Look for tray initialization messages in Console.app or terminal output
   ```bash
   # View recent logs
   log show --predicate 'process == "Minikyu"' --last 5m
   ```

2. **Verify icon file exists**:
   ```bash
   ls -la src-tauri/icons/32x32.png
   ```

3. **Check icon format**: The icon should be a PNG with alpha transparency
   ```bash
   file src-tauri/icons/32x32.png
   # Should show: PNG image data, 32 x 32, 8-bit/color RGBA
   ```

4. **Verify template icon setting**: The code sets `icon_as_template(true)` for macOS
   - Template icons are monochrome and adapt to system theme
   - If your icon is colored, it may not be visible
   - Consider creating a monochrome version of your icon

5. **Check menu bar space**: macOS automatically hides tray icons when the menu bar is crowded
   - Try hiding other menu bar items
   - Check if the icon appears after hiding other items

6. **Verify preferences**: Ensure `show_tray_icon` is `true` in preferences
   ```bash
   cat ~/Library/Application\ Support/com.minikyu.app/preferences.json
   ```

7. **Restart the app**: Sometimes macOS needs a restart to show the tray icon

### Common Issues

**Icon loads but is invisible**:
- The icon might be colored instead of monochrome
- macOS template icons should be black/white with transparency
- The code now looks for `32x32-template.png` first (monochrome version)
- Create a monochrome version using ImageMagick:
  ```bash
  magick src-tauri/icons/32x32.png -colorspace Gray -alpha on src-tauri/icons/32x32-template.png
  ```
- Or use the provided script:
  ```bash
  # Create template icon from existing icon
  magick src-tauri/icons/32x32.png -colorspace Gray -alpha on src-tauri/icons/32x32-template.png
  ```

**Icon path not found**:
- Check the logs for which paths were tried
- Verify `CARGO_MANIFEST_DIR` is set correctly
- In production, icons should be bundled with the app

**Tray icon disappears after app restart**:
- Check if `show_tray_icon` preference is being saved correctly
- Verify the tray initialization is called in `lib.rs` setup function

## References

- [Tauri Tray Icon Documentation](https://tauri.app/plugin/tray-icon/)
- [Tauri v2 Menu API](https://tauri.app/reference/javascript/api/namespacemenu/)
- [Project State Management](./state-management.md)
- [Project Preferences System](./data-persistence.md)
