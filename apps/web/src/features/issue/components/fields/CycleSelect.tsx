import { useState } from 'react';
import { Check, CircleDashed, RefreshCw } from 'lucide-react';
import type { Cycle } from '@/lib/api';
import { usePlannedCyclesQuery } from '@/services/cycles.service';
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

export type CycleOption = Pick<Cycle, 'id' | 'name'>;

// A Pill trigger opening the cycles an issue can be planned into: the ones that have
// not finished. A completed cycle is not offered — it records what it delivered — but
// the one the issue already sits on stays listed, so it can be read and unplanned.
export default function CycleSelect({
  projectKey,
  value,
  onChange,
}: {
  projectKey: string;
  value: CycleOption | null;
  onChange: (cycle: CycleOption | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const { data } = usePlannedCyclesQuery(projectKey);
  const planned = data ?? [];
  const cycles =
    value && !planned.some((c) => c.id === value.id)
      ? [{ ...value, status: 'completed' as const }, ...planned]
      : planned;

  const select = (cycle: CycleOption | null) => {
    onChange(cycle);
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Pill active={value != null}>
          {value != null ? <RefreshCw /> : <CircleDashed />}
          {value?.name ?? 'Cycle'}
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
                <CommandItem key={cycle.id} value={cycle.name} onSelect={() => select(cycle)}>
                  {colorDot(CYCLE_STATUS_META[cycle.status].color)}
                  <span className="flex-1 truncate">{cycle.name}</span>
                  {cycle.id === value?.id && <Check className="ml-auto" />}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
