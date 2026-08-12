import { useState } from 'react';
import { Check } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { InitiativeStatus } from '@/lib/api';
import { Command, CommandGroup, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { colorDot } from '@/components/common/fields/colorDot';
import { Pill } from '@/components/common/fields/Pill';
import { STATUS_META, STATUS_ORDER } from '@/utils/initiativeMeta';

// A Pill trigger opening the fixed initiative status lifecycle. Mirrors the issue
// field selects (Pill + Popover + Command) but over a static enum.
export default function InitiativeStatusSelect({
  value,
  onChange,
}: {
  value: InitiativeStatus;
  onChange: (status: InitiativeStatus) => void;
}) {
  const t = useTranslations('initiatives.status');
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Pill active>
          {colorDot(STATUS_META[value].color)}
          {t(value)}
        </Pill>
      </PopoverTrigger>
      <PopoverContent className="w-48 p-0" align="start">
        <Command>
          <CommandList>
            <CommandGroup>
              {STATUS_ORDER.map((s) => (
                <CommandItem
                  key={s}
                  value={t(s)}
                  onSelect={() => {
                    onChange(s);
                    setOpen(false);
                  }}
                >
                  {colorDot(STATUS_META[s].color)}
                  <span className="flex-1">{t(s)}</span>
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
