/**
 * Build-target and capability detection.
 *
 * The app ships two targets from one codebase:
 *
 * - `tauri` — the desktop shell, where a Rust backend owns the local SQLite
 *   mirror, the OS keychain, sync, translation, downloads and the extra windows.
 * - `web`   — an installable, **online-only** PWA that talks to the Miniflux
 *   REST API directly. It has no local mirror and no offline sync.
 *
 * Anything the web target cannot do is listed in `capabilities` so the UI can
 * hide it, rather than calling a command that would throw at runtime. Always
 * gate on a capability instead of on `isTauri` directly — that keeps the reason
 * for the check visible at the call site.
 */

/** True when running inside the Tauri desktop shell. */
export const isTauri: boolean = __APP_TARGET__ === 'tauri';

/** True when running as the browser PWA. */
export const isWeb: boolean = !isTauri;

export interface Capabilities {
  /** Download manager backed by the Rust downloader + local disk. */
  downloads: boolean;
  /** Detached podcast player window. */
  podcastWindow: boolean;
  /** Quick-pane and tray-popover windows. */
  auxiliaryWindows: boolean;
  /** System tray icon and menu. */
  tray: boolean;
  /** Native OS notifications. */
  nativeNotifications: boolean;
  /** Native application menu bar. */
  nativeMenu: boolean;
  /**
   * Native window chrome — the macOS traffic lights / Windows caption buttons,
   * and the rounded window corners that go with them. A browser tab has none.
   */
  nativeWindowControls: boolean;
  /** Embedded in-app browser webview. */
  inAppBrowser: boolean;
  /** Trackpad/mouse gesture bindings, handled by the desktop shell. */
  gestures: boolean;
  /**
   * Custom background image. Desktop-only: the image is downloaded to disk by
   * Rust and read back as a data URL, neither of which a browser can do.
   */
  backgroundImage: boolean;
  /** Enumerating installed system fonts — a Rust call with no browser equivalent. */
  systemFonts: boolean;
  /** Immersive reader translation (Rust translation router + provider keys). */
  translation: boolean;
  /** AI article summaries (streamed from the Rust side). */
  summaries: boolean;
  /** WebDAV / cloud settings sync. */
  cloudSync: boolean;
  /**
   * Native open/save file dialogs plus disk read/write. The browser has no
   * equivalent, so web falls back to a download link / hidden file input.
   */
  nativeFileDialogs: boolean;
  /**
   * Inspection and wholesale reset of the Rust-owned app-data directory —
   * the storage breakdown and the factory reset. A browser has no such
   * directory to measure or delete.
   */
  appDataManagement: boolean;
  /** In-app updater. */
  updater: boolean;
  /** Local-first background sync into SQLite. */
  offlineSync: boolean;
  /**
   * Whether the user picks which Miniflux instance to talk to. On web the
   * deployment's `/miniflux-api` proxy fixes the target (Miniflux sends no CORS
   * headers), so the URL is not the user's to choose — only the token is.
   */
  configurableServerUrl: boolean;
  /** Multiple stored Miniflux accounts. */
  multiAccount: boolean;
  /** Credentials held in the OS keychain rather than localStorage. */
  secureCredentialStorage: boolean;
}

/**
 * Everything the Rust backend provides is desktop-only. The PWA is deliberately
 * scoped to the core reading loop: connect, browse feeds and categories, read
 * entries, mark read/starred.
 */
export const capabilities: Capabilities = {
  downloads: isTauri,
  podcastWindow: isTauri,
  auxiliaryWindows: isTauri,
  tray: isTauri,
  nativeNotifications: isTauri,
  nativeMenu: isTauri,
  nativeWindowControls: isTauri,
  inAppBrowser: isTauri,
  gestures: isTauri,
  systemFonts: isTauri,
  backgroundImage: isTauri,
  translation: isTauri,
  summaries: isTauri,
  cloudSync: isTauri,
  nativeFileDialogs: isTauri,
  appDataManagement: isTauri,
  updater: isTauri,
  offlineSync: isTauri,
  configurableServerUrl: isTauri,
  multiAccount: isTauri,
  secureCredentialStorage: isTauri,
};
