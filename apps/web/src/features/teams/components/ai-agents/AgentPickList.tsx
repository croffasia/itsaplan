import { useState, type ReactNode } from 'react';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { groupInOrder } from '../../utils/agentForm';
import { AgentPicker } from './AgentPicker';
import { AgentPickRow } from './AgentPickRow';

// One thing a section of the agent editor turns on for the agent: a tool, a skill, a project.
export interface AgentPickItem {
  id: number;
  name: string;
  // The heading it sits under in the picker.
  group?: string;
  // What its row says beside the name.
  note?: string;
  // The square in front of it, at the size the class sets.
  icon?: (className: string) => ReactNode;
  description?: string | null;
  // More text the search matches, beside the name, group, note and description.
  search?: string;
  // Why it does not work, shown in place of the note.
  warning?: string;
}

// What a section has turned on, kept together by group under a heading, and the picker that
// turns the rest on and off. `footer` is given a way to close the picker, so an action in it
// can open its own dialog.
export function AgentPickList({
  items,
  selected,
  onToggle,
  heading,
  chooseLabel,
  noneText,
  searchPlaceholder,
  removeLabel,
  footer,
}: {
  items: AgentPickItem[];
  selected: number[];
  onToggle: (ids: number[], on: boolean) => void;
  heading: string;
  chooseLabel: string;
  noneText: string;
  searchPlaceholder: string;
  removeLabel: (name: string) => string;
  footer?: (close: () => void) => ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const picked = groupInOrder(
    items.filter((item) => selected.includes(item.id)),
    (item) => item.group ?? '',
  ).flatMap(([, members]) => members);

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-3 border-b border-border/60 ps-2 pb-4">
        <h3 className="flex-1 text-sm font-medium">
          {heading}
          <span className="ms-1.5 text-xs font-normal text-muted-foreground tabular-nums">
            {picked.length}
          </span>
        </h3>
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button type="button" size="sm" variant="secondary" className="h-8 gap-1.5">
              <Plus className="size-3.5" />
              {chooseLabel}
            </Button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-96 max-w-[calc(100vw-2rem)] p-0">
            <AgentPicker
              items={items}
              selected={selected}
              onToggle={onToggle}
              searchPlaceholder={searchPlaceholder}
              footer={footer?.(() => setOpen(false))}
            />
          </PopoverContent>
        </Popover>
      </div>
      {picked.length === 0 ? (
        <p className="ps-2 text-xs text-muted-foreground">{noneText}</p>
      ) : (
        <div>
          {picked.map((item) => (
            <AgentPickRow
              key={item.id}
              item={item}
              removeLabel={removeLabel(item.name)}
              onRemove={() => onToggle([item.id], false)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
