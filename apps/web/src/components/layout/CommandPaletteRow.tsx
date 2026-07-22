import { Check, ChevronRight } from 'lucide-react';
import type { Command } from '@/utils/commands';
import { CommandItem, CommandShortcut } from '@/components/ui/command';

// One command row in the palette. The value is what cmdk matches on: the id, the
// label and the command's extra keywords.
export default function CommandPaletteRow({
  command,
  onRun,
}: {
  command: Command;
  onRun: (command: Command) => void;
}) {
  return (
    <CommandItem
      value={`${command.id} ${command.label} ${command.keywords ?? ''}`}
      onSelect={() => onRun(command)}
      className={
        command.destructive ? 'text-destructive data-[selected=true]:text-destructive' : undefined
      }
    >
      {command.icon}
      <span className="flex-1 truncate">{command.label}</span>
      {command.checked && <Check className="size-4" />}
      {command.submenu && <ChevronRight className="size-4 text-muted-foreground" />}
      {command.shortcut && <CommandShortcut>{command.shortcut}</CommandShortcut>}
    </CommandItem>
  );
}
