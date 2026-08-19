import { useState } from 'react';
import { Check, CircleDashed, Target } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useInitiativeOptionsQuery } from '@/services/initiatives.service';
import { colorDot } from '@/components/common/fields/colorDot';
import { STATUS_META } from '@/utils/initiativeMeta';
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
  const t = useTranslations('initiatives.select');
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  // The linked initiative is asked for by id alongside the search, so it labels the
  // trigger and stays listed even once it is closed.
  const { data } = useInitiativeOptionsQuery(projectKey, {
    search: query.trim() || undefined,
    include: value ?? undefined,
  });
  const options = data ?? [];
  const current = options.find((it) => it.id === value) ?? null;

  const select = (id: number | null) => {
    onChange(id);
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
          <span className="truncate">{current?.title ?? t('label')}</span>
        </Pill>
      </PopoverTrigger>
      <PopoverContent className="w-56 p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput placeholder={t('search')} value={query} onValueChange={setQuery} />
          <CommandList>
            <CommandEmpty>{t('empty')}</CommandEmpty>
            <CommandGroup>
              {!query && (
                <CommandItem value={t('none')} onSelect={() => select(null)}>
                  <CircleDashed />
                  <span className="flex-1">{t('none')}</span>
                  {value == null && <Check className="ml-auto" />}
                </CommandItem>
              )}
              {options.map((it) => (
                <CommandItem key={it.id} value={it.title} onSelect={() => select(it.id)}>
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
