import { useState, type ReactNode } from 'react';
import { Check } from 'lucide-react';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

export interface PickItem {
  key: string;
  // What cmdk filters the row against as the user types.
  search: string;
  icon: ReactNode;
  label: string;
  selected: boolean;
  onSelect: () => void;
}

// A named set of PickItems rendered under a heading. An empty group is skipped so
// no bare heading shows.
export interface PickGroup {
  heading: string;
  items: PickItem[];
}

// A Pill trigger opening a searchable list of PickItems in a popover. Closes on
// select unless `closeOnSelect` is false (labels toggle and stay open). `items`
// renders as one flat group without a heading (the default). `groups` renders one
// headed group each, after the flat items — pass either or both.
export default function PopoverPick({
  trigger,
  inputPlaceholder,
  emptyText,
  items,
  groups,
  closeOnSelect = true,
}: {
  trigger: ReactNode;
  inputPlaceholder: string;
  emptyText?: string;
  items?: PickItem[];
  groups?: PickGroup[];
  closeOnSelect?: boolean;
}) {
  const [open, setOpen] = useState(false);

  const renderItem = (it: PickItem) => (
    <CommandItem
      key={it.key}
      value={it.search}
      onSelect={() => {
        it.onSelect();
        if (closeOnSelect) setOpen(false);
      }}
    >
      {it.icon}
      <span className="flex-1">{it.label}</span>
      {it.selected && <Check className="ml-auto" />}
    </CommandItem>
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent className="w-56 p-0" align="start">
        <Command>
          <CommandInput placeholder={inputPlaceholder} />
          <CommandList>
            {emptyText && <CommandEmpty>{emptyText}</CommandEmpty>}
            {items && items.length > 0 && <CommandGroup>{items.map(renderItem)}</CommandGroup>}
            {groups?.map(
              (group) =>
                group.items.length > 0 && (
                  <CommandGroup key={group.heading} heading={group.heading}>
                    {group.items.map(renderItem)}
                  </CommandGroup>
                ),
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
