import type { IconSvgElement } from '@hugeicons/react';
import type { MessageDescriptor } from '@lingui/core';

export interface AppCommand {
  id: string;
  label: MessageDescriptor;
  description?: MessageDescriptor;
  icon?: IconSvgElement;
  group?: string;
  keywords?: string[];
  execute: (context: CommandContext) => void | Promise<void>;
  isAvailable?: (context: CommandContext) => boolean;
  shortcut?: string;
}

export interface CommandGroup {
  id: string;
  label: string;
  commands: AppCommand[];
}

export interface CommandContext {
  openPreferences: () => void;
  showToast: (message: string, type?: 'success' | 'error' | 'info') => void;
}
