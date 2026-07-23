import { useState } from 'react';
import { Check, CircleDashed, Target } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { useInitiativeQuery, useInitiativesQuery } from '@/services/initiatives.service';
import type { Initiative } from '@/lib/api';
import { qk } from '@/services/queryKeys';
import { colorDot } from '@/components/common/fields/colorDot';
import { LINKABLE_STATUSES, STATUS_META } from '@/utils/initiativeMeta';
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

// The dropdown shows at most this many initiatives at once; the rest are reached by
// typing, which the server matches by title.
const PAGE_SIZE = 15;

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
  const [query, setQuery] = useState('');
  const qc = useQueryClient();

  // The linked initiative may fall outside the first page, so fetch it directly to
  // label the trigger. The list query only runs while the dropdown is open.
  const current = useInitiativeQuery(value).data;
  const { data } = useInitiativesQuery(open ? projectKey : null, {
    statuses: LINKABLE_STATUSES,
    search: query.trim() || undefined,
    pageSize: PAGE_SIZE,
  });
  const options = data?.items ?? [];

  // Seed the single-initiative cache on pick so the trigger labels immediately,
  // without waiting for its own fetch.
  const select = (initiative: Initiative | null) => {
    if (initiative) qc.setQueryData(qk.initiative(initiative.id), initiative);
    onChange(initiative?.id ?? null);
    setOpen(false);
  };

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setQuery('');
      }}
    >
      <PopoverTrigger asChild>
        <Pill active={value != null}>
          {value != null ? <Target /> : <CircleDashed />}
          {current?.title ?? 'Initiative'}
        </Pill>
      </PopoverTrigger>
      <PopoverContent className="w-56 p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput placeholder="Link to initiative…" value={query} onValueChange={setQuery} />
          <CommandList>
            <CommandEmpty>No initiatives.</CommandEmpty>
            <CommandGroup>
              {!query && (
                <CommandItem value="No initiative" onSelect={() => select(null)}>
                  <CircleDashed />
                  <span className="flex-1">No initiative</span>
                  {value == null && <Check className="ml-auto" />}
                </CommandItem>
              )}
              {options.map((it) => (
                <CommandItem key={it.id} value={it.title} onSelect={() => select(it)}>
                  {colorDot(STATUS_META[it.status].color)}
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
