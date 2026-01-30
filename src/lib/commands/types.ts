import type { MessageDescriptor } from '@lingui/core';
import type { LucideIcon } from 'lucide-react';

export interface AppCommand {
  id: string;
  label: MessageDescriptor;
  description?: MessageDescriptor;
  icon?: LucideIcon;
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
