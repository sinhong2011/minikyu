/**
 * Target-safe text file export/import.
 *
 * The desktop shell can open a native save/open dialog and read or write the
 * chosen path through `@tauri-apps/plugin-dialog` + `@tauri-apps/plugin-fs`.
 * Neither plugin exists in the PWA build — calling them throws because there
 * is no Tauri IPC behind them.
 *
 * Import `saveTextFile`/`pickTextFile` from here instead of reaching for the
 * plugins directly. On web they fall back to a download link and a hidden
 * `<input type="file">`, which is as close as a browser gets. Both code paths
 * report "the user cancelled" the same way, so call sites stay identical.
 *
 * Because `capabilities.nativeFileDialogs` is a build-time constant, the
 * bundler drops the unused branch from each target's bundle.
 */

import { capabilities } from './platform';

export interface FileFilter {
  /** Human-readable group name shown in the native dialog. */
  name: string;
  /** Extensions without a leading dot, e.g. `['json']`. */
  extensions: string[];
}

interface SaveTextFileOptions {
  /** Native dialog title. Unused on web — browsers have no save dialog. */
  title: string;
  /** Suggested file name, including its extension. */
  defaultFileName: string;
  contents: string;
  filters?: FileFilter[];
  /** MIME type for the browser download. Defaults to `text/plain`. */
  mimeType?: string;
}

interface PickTextFileOptions {
  title: string;
  filters?: FileFilter[];
}

/** Turns filters into the `accept` attribute a file input understands. */
function toAcceptAttribute(filters: FileFilter[] | undefined): string {
  if (!filters?.length) return '';
  return filters
    .flatMap((f) => f.extensions)
    .filter((extension) => extension !== '*')
    .map((extension) => `.${extension}`)
    .join(',');
}

/**
 * Writes `contents` to a file the user chooses.
 *
 * @returns `true` once written, `false` if the user cancelled the dialog.
 *   Web always returns `true` — a browser download cannot be observed.
 */
export async function saveTextFile({
  title,
  defaultFileName,
  contents,
  filters,
  mimeType = 'text/plain',
}: SaveTextFileOptions): Promise<boolean> {
  if (capabilities.nativeFileDialogs) {
    const [{ save }, { writeTextFile }] = await Promise.all([
      import('@tauri-apps/plugin-dialog'),
      import('@tauri-apps/plugin-fs'),
    ]);

    const filePath = await save({ title, defaultPath: defaultFileName, filters });
    if (!filePath) return false;

    await writeTextFile(filePath, contents);
    return true;
  }

  const url = URL.createObjectURL(new Blob([contents], { type: mimeType }));
  try {
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = defaultFileName;
    anchor.click();
  } finally {
    // Give the browser a tick to start the download before releasing the blob.
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }
  return true;
}

/**
 * Asks the user for a text file and reads it.
 *
 * @returns the file contents, or `null` if the user cancelled.
 */
export async function pickTextFile({
  title,
  filters,
}: PickTextFileOptions): Promise<string | null> {
  if (capabilities.nativeFileDialogs) {
    const [{ open }, { readTextFile }] = await Promise.all([
      import('@tauri-apps/plugin-dialog'),
      import('@tauri-apps/plugin-fs'),
    ]);

    const filePath = await open({ title, multiple: false, filters });
    if (!filePath) return null;

    return readTextFile(filePath);
  }

  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    const accept = toAcceptAttribute(filters);
    if (accept) input.accept = accept;

    // A file input fires either `change` or `cancel`, never both — guard so a
    // browser that fires both does not resolve twice.
    let settled = false;
    const settle = (value: string | null) => {
      if (settled) return;
      settled = true;
      resolve(value);
    };

    input.addEventListener('change', () => {
      const file = input.files?.[0];
      if (!file) {
        settle(null);
        return;
      }
      file.text().then(settle, () => settle(null));
    });
    input.addEventListener('cancel', () => settle(null));

    input.click();
  });
}
