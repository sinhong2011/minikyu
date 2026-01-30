import { msg } from '@lingui/core/macro';
import { useLingui } from '@lingui/react';
import { useEffect, useState } from 'react';
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandShortcut,
} from '@/components/ui/command';
import { useCommandContext } from '@/hooks/use-command-context';
import { executeCommand, getAllCommands } from '@/lib/commands';
import { useUIStore } from '@/store/ui-store';

export function CommandPalette() {
  const { _ } = useLingui();
  const commandPaletteOpen = useUIStore((state) => state.commandPaletteOpen);
  const setCommandPaletteOpen = useUIStore((state) => state.setCommandPaletteOpen);
  const toggleCommandPalette = useUIStore((state) => state.toggleCommandPalette);
  const commandContext = useCommandContext();
  const [search, setSearch] = useState('');

  const commands = getAllCommands(commandContext, search, _);
  const commandGroups = commands.reduce(
    (groups, command) => {
      const group = command.group || 'other';
      if (!groups[group]) {
        groups[group] = [];
      }
      groups[group].push(command);
      return groups;
    },
    {} as Record<string, typeof commands>
  );

  const handleCommandSelect = async (commandId: string) => {
    setCommandPaletteOpen(false);
    setSearch('');

    const result = await executeCommand(commandId, commandContext);

    if (!result.success && result.error) {
      commandContext.showToast(result.error, 'error');
    }
  };

  const handleOpenChange = (open: boolean) => {
    setCommandPaletteOpen(open);
    if (!open) {
      setSearch('');
    }
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        toggleCommandPalette();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [toggleCommandPalette]);

  const getGroupLabel = (groupName: string): string => {
    switch (groupName) {
      case 'navigation':
        return _(msg`Navigation`);
      case 'debug':
        return _(msg`Debug`);
      case 'settings':
        return _(msg`Settings`);
      case 'window':
        return _(msg`Window`);
      case 'other':
        return _(/* i18n: Command palette group label for miscellaneous commands */ msg`Others`);
      default:
        return groupName.charAt(0).toUpperCase() + groupName.slice(1);
    }
  };

  return (
    <CommandDialog
      open={commandPaletteOpen}
      onOpenChange={handleOpenChange}
      title={_(msg`Command Palette`)}
      description={_(msg`Type a command or search...`)}
    >
      <CommandInput
        placeholder={_(msg`Type a command or search...`)}
        value={search}
        onValueChange={setSearch}
      />
      <CommandList>
        <CommandEmpty>{_(msg`No results found.`)}</CommandEmpty>

        {Object.entries(commandGroups).map(([groupName, groupCommands]) => (
          <CommandGroup key={groupName} heading={getGroupLabel(groupName)}>
            {groupCommands.map((command) => (
              <CommandItem
                key={command.id}
                value={command.id}
                onSelect={() => handleCommandSelect(command.id)}
              >
                {command.icon && <command.icon className="mr-2 h-4 w-4" />}
                <span>{_(command.label)}</span>
                {command.description && (
                  <span className="ml-auto text-xs text-muted-foreground">
                    {_(command.description)}
                  </span>
                )}
                {command.shortcut && <CommandShortcut>{command.shortcut}</CommandShortcut>}
              </CommandItem>
            ))}
          </CommandGroup>
        ))}
      </CommandList>
    </CommandDialog>
  );
}

export default CommandPalette;
