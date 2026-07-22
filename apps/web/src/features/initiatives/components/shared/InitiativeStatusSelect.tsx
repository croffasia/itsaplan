import { useState } from 'react';
import { Check } from 'lucide-react';
import type { InitiativeStatus } from '@/lib/api';
import { Command, CommandGroup, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { colorDot } from '@/components/common/fields/colorDot';
import { Pill } from '@/components/common/fields/Pill';
import { STATUS_META, STATUS_ORDER } from './initiativeMeta';

// A Pill trigger opening the fixed initiative status lifecycle. Mirrors the issue
// field selects (Pill + Popover + Command) but over a static enum.
export default function InitiativeStatusSelect({
  value,
  onChange,
}: {
  value: InitiativeStatus;
  onChange: (status: InitiativeStatus) => void;
}) {
  const [open, setOpen] = useState(false);
  const meta = STATUS_META[value];
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Pill active>
          {colorDot(meta.color)}
          {meta.label}
        </Pill>
      </PopoverTrigger>
      <PopoverContent className="w-48 p-0" align="start">
        <Command>
          <CommandList>
            <CommandGroup>
              {STATUS_ORDER.map((s) => (
                <CommandItem
                  key={s}
                  value={STATUS_META[s].label}
                  onSelect={() => {
                    onChange(s);
                    setOpen(false);
                  }}
                >
                  {colorDot(STATUS_META[s].color)}
                  <span className="flex-1">{STATUS_META[s].label}</span>
                  {s === value && <Check className="ml-auto" />}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
