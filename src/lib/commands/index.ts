// Command system exports

export * from '../../hooks/use-command-context';
export * from './registry';

import { navigationCommands } from './navigation-commands';
import { notificationCommands } from './notification-commands';
import { registerCommands } from './registry';
import { windowCommands } from './window-commands';

/**
 * Initialize the command system by registering all commands.
 * This should be called once during app initialization.
 */
export function initializeCommandSystem(): void {
  registerCommands(navigationCommands);
  registerCommands(windowCommands);
  registerCommands(notificationCommands);
  // Future command groups will be registered here

  if (import.meta.env.DEV) {
    console.log('Command system initialized');
  }
}

export { navigationCommands, windowCommands, notificationCommands };
