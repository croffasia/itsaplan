import { useState } from 'react';
import { Check, CircleDashed, RefreshCw } from 'lucide-react';
import { useCyclesQuery } from '@/services/cycles.service';
import { colorDot } from '@/components/common/fields/colorDot';
import { CYCLE_STATUS_META } from '@/utils/cycleMeta';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Pill } from '@/components/common/fields/Pill';

// A Pill trigger opening the project's cycles, for planning an issue into one. The
// list is short enough to load whole and filter in the dropdown. Completed cycles
// are offered too, so an issue can be attributed to the cycle it was finished in.
export default function CycleSelect({
  projectKey,
  value,
  onChange,
}: {
  projectKey: string;
  value: number | null;
  onChange: (id: number | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const { data } = useCyclesQuery(projectKey);
  const cycles = data ?? [];
  const current = cycles.find((c) => c.id === value);

  const select = (id: number | null) => {
    onChange(id);
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Pill active={value != null}>
          {value != null ? <RefreshCw /> : <CircleDashed />}
          {current?.name ?? 'Cycle'}
        </Pill>
      </PopoverTrigger>
      <PopoverContent className="w-56 p-0" align="start">
        <Command>
          <CommandInput placeholder="Plan into cycle…" />
          <CommandList>
            <CommandEmpty>No cycles.</CommandEmpty>
            <CommandGroup>
              <CommandItem value="No cycle" onSelect={() => select(null)}>
                <CircleDashed />
                <span className="flex-1">No cycle</span>
                {value == null && <Check className="ml-auto" />}
              </CommandItem>
              {cycles.map((cycle) => (
                <CommandItem key={cycle.id} value={cycle.name} onSelect={() => select(cycle.id)}>
                  {colorDot(CYCLE_STATUS_META[cycle.status].color)}
                  <span className="flex-1 truncate">{cycle.name}</span>
                  {cycle.id === value && <Check className="ml-auto" />}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
