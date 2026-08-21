/**
 * Thrown when the PWA build reaches a command that only the Tauri backend can
 * serve. Reaching one is a bug in the calling UI: it should have been gated on
 * a flag from `@/lib/platform` first.
 */
export class UnsupportedInWebError extends Error {
  readonly command: string;

  constructor(command: string) {
    super(
      `"${command}" is not available in the web build. ` +
        'Gate this UI on a capability from "@/lib/platform" before calling it.'
    );
    this.name = 'UnsupportedInWebError';
    this.command = command;
  }
}

/**
 * Builds a command stub that throws when invoked. Used for the whole
 * desktop-only surface so failures name the command instead of blowing up as
 * `undefined is not a function`.
 */
export function unsupported(command: string): (...args: unknown[]) => never {
  return () => {
    throw new UnsupportedInWebError(command);
  };
}
