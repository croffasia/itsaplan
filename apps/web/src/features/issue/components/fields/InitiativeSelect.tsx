import { useState } from 'react';
import { Check, CircleDashed, Target } from 'lucide-react';
import { useInitiativesQuery } from '@/services/initiatives.service';
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

// A Pill trigger opening the project's initiatives, for linking an issue to one.
// Lives in the shared layer so the issue detail can use it without depending on
// the initiatives feature. Value is the initiative id or null.
export default function InitiativeSelect({
  projectKey,
  value,
  onChange,
}: {
  projectKey: string;
  value: number | null;
  onChange: (id: number | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const { data: initiatives = [] } = useInitiativesQuery(projectKey);
  const current = initiatives.find((i) => i.id === value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Pill active={!!current}>
          {current ? <Target /> : <CircleDashed />}
          {current?.title ?? 'Initiative'}
        </Pill>
      </PopoverTrigger>
      <PopoverContent className="w-56 p-0" align="start">
        <Command>
          <CommandInput placeholder="Link to initiative…" />
          <CommandList>
            <CommandEmpty>No initiatives.</CommandEmpty>
            <CommandGroup>
              <CommandItem
                value="No initiative"
                onSelect={() => {
                  onChange(null);
                  setOpen(false);
                }}
              >
                <CircleDashed />
                <span className="flex-1">No initiative</span>
                {value == null && <Check className="ml-auto" />}
              </CommandItem>
              {initiatives.map((it) => (
                <CommandItem
                  key={it.id}
                  value={it.title}
                  onSelect={() => {
                    onChange(it.id);
                    setOpen(false);
                  }}
                >
                  <Target />
                  <span className="flex-1 truncate">{it.title}</span>
                  {it.id === value && <Check className="ml-auto" />}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
