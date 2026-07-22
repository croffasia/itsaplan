import { useState } from 'react';
import { Check, ChevronDown, Layers, Plus } from 'lucide-react';
import type { View } from '@/lib/api';
import { cn } from '@/lib/utils';
import { ViewIcon } from '@/utils/viewIcons';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

// Mobile view picker: the tab strip collapses into a dropdown showing the active
// view, listing All + saved views (searchable) and a New view action. Item values
// are ids, not names — two views may share a name — and the name is passed as a
// search keyword.
export default function MobileViewSwitcher({
  views,
  activeViewId,
  canCreate,
  onSelect,
  onNewView,
}: {
  views: View[];
  activeViewId: number | null;
  canCreate: boolean;
  onSelect: (id: number | null) => void;
  onNewView: () => void;
}) {
  const [open, setOpen] = useState(false);
  const active = activeViewId != null ? (views.find((v) => v.id === activeViewId) ?? null) : null;
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          title="Switch view"
          className="flex h-8 min-w-0 items-center gap-1.5 rounded-md border px-3 text-sm whitespace-nowrap transition-colors hover:bg-accent"
        >
          {active ? (
            <ViewIcon name={active.icon} className="size-4 shrink-0" />
          ) : (
            <Layers className="size-4 shrink-0" />
          )}
          <span className="truncate font-medium">{active ? active.name : 'All'}</span>
          <ChevronDown className="size-4 shrink-0 text-muted-foreground" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-56 p-0">
        <Command>
          <CommandInput placeholder="Search views…" />
          <CommandList>
            <CommandEmpty>No views found.</CommandEmpty>
            <CommandGroup>
              <CommandItem
                value="__all__"
                keywords={['All']}
                onSelect={() => {
                  onSelect(null);
                  setOpen(false);
                }}
                className={cn(activeViewId === null && 'bg-accent/50')}
              >
                <Layers className="size-4" />
                <span className="min-w-0 flex-1 truncate">All</span>
                {activeViewId === null && <Check className="size-4 shrink-0" />}
              </CommandItem>
              {views.map((v) => (
                <CommandItem
                  key={v.id}
                  value={String(v.id)}
                  keywords={[v.name]}
                  onSelect={() => {
                    onSelect(v.id);
                    setOpen(false);
                  }}
                  className={cn(activeViewId === v.id && 'bg-accent/50')}
                >
                  <ViewIcon name={v.icon} className="size-4" />
                  <span className="min-w-0 flex-1 truncate">{v.name}</span>
                  {activeViewId === v.id && <Check className="size-4 shrink-0" />}
                </CommandItem>
              ))}
            </CommandGroup>
            {canCreate && (
              <CommandGroup>
                <CommandItem
                  value="New view"
                  onSelect={() => {
                    onNewView();
                    setOpen(false);
                  }}
                >
                  <Plus className="size-4" />
                  New view
                </CommandItem>
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
