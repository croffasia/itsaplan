import { useState } from 'react';
import { Check, CircleDashed, RefreshCw } from 'lucide-react';
import type { CycleRef } from '@/lib/api';
import { useCycleOptionsQuery } from '@/services/cycles.service';
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
import { useTranslations } from 'next-intl';

// A Pill trigger opening the cycles an issue can be planned into: the ones that have
// not finished. A completed cycle is not offered — it records what it delivered — but
// the one the issue already sits on stays listed, so it can be read and unplanned.
export default function CycleSelect({
  projectKey,
  value,
  onChange,
}: {
  projectKey: string;
  value: CycleRef | null;
  onChange: (cycle: CycleRef | null) => void;
}) {
  const t = useTranslations('issue.cycleSelect');
  const [open, setOpen] = useState(false);
  const { data } = useCycleOptionsQuery(projectKey);
  const planned = data ?? [];
  const cycles =
    value && !planned.some((c) => c.id === value.id)
      ? [{ ...value, status: 'completed' as const }, ...planned]
      : planned;

  const select = (cycle: CycleRef | null) => {
    onChange(cycle);
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Pill active={value != null}>
          {value != null ? <RefreshCw /> : <CircleDashed />}
          <span className="truncate">{value?.name ?? t('label')}</span>
        </Pill>
      </PopoverTrigger>
      <PopoverContent className="w-56 p-0" align="start">
        <Command>
          <CommandInput placeholder={t('search')} />
          <CommandList>
            <CommandEmpty>{t('empty')}</CommandEmpty>
            <CommandGroup>
              <CommandItem value={t('none')} onSelect={() => select(null)}>
                <CircleDashed />
                <span className="flex-1">{t('none')}</span>
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
