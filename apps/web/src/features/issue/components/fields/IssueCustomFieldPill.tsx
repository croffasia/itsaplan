import { useState } from 'react';
import { Check } from 'lucide-react';
import { type Assignee, type CustomField, type IssueFieldValueInput } from '@/lib/api';
import { cn } from '@/lib/utils';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { colorDot } from '@/components/common/fields/colorDot';
import DatePill from '@/components/common/fields/DatePill';
import DateTimePill from '@/components/common/fields/DateTimePill';
import { Pill } from '@/components/common/fields/Pill';
import MemberSelect from './MemberSelect';
import { useTranslations } from 'next-intl';

// A pill + popover editor for a single non-markdown custom field, used in the
// new-issue modal where the value is collected before the issue exists.
export default function IssueCustomFieldPill({
  def,
  value,
  assignees,
  onChange,
  defaultOpen = false,
}: {
  def: CustomField;
  value: IssueFieldValueInput | undefined;
  assignees: Assignee[];
  onChange: (v: IssueFieldValueInput) => void;
  defaultOpen?: boolean;
}) {
  const t = useTranslations('issue.customFields');
  const [open, setOpen] = useState(defaultOpen);

  if (def.fieldType === 'member') {
    return (
      <MemberSelect
        assignees={assignees}
        scope={def.memberScope ?? 'all'}
        value={(value?.value as string | null) ?? null}
        placeholder={def.name}
        onChange={(userId) => onChange({ value: userId })}
      />
    );
  }

  if (def.fieldType === 'boolean') {
    const on = value?.value === true;
    return (
      <Pill active={on} onClick={() => onChange({ value: !on })}>
        <span
          className={cn(
            'size-3 rounded-[3px] border border-input',
            on && 'border-primary bg-primary',
          )}
        />
        <span className="truncate">{def.name}</span>
      </Pill>
    );
  }

  if (def.fieldType === 'select' || def.fieldType === 'multi_select') {
    const selected = value?.optionIds ?? [];
    let label = def.name;
    if (def.fieldType === 'select')
      label = def.options.find((o) => o.id === selected[0])?.value ?? def.name;
    else if (selected.length > 0) label = `${def.name}: ${selected.length}`;
    return (
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Pill active={selected.length > 0}>
            <span className="truncate">{label}</span>
          </Pill>
        </PopoverTrigger>
        <PopoverContent className="w-56 p-0" align="start">
          <Command>
            <CommandList>
              <CommandEmpty>{t('noOptions')}</CommandEmpty>
              <CommandGroup>
                {def.fieldType === 'select' && (
                  <CommandItem
                    value="(none)"
                    onSelect={() => {
                      onChange({ optionIds: [] });
                      setOpen(false);
                    }}
                  >
                    <span className="flex-1">(none)</span>
                    {selected.length === 0 && <Check className="ml-auto" />}
                  </CommandItem>
                )}
                {def.options.map((o) => {
                  const isOn = selected.includes(o.id);
                  return (
                    <CommandItem
                      key={o.id}
                      value={o.value}
                      onSelect={() => {
                        if (def.fieldType === 'select') {
                          onChange({ optionIds: [o.id] });
                          setOpen(false);
                        } else {
                          onChange({
                            optionIds: isOn
                              ? selected.filter((x) => x !== o.id)
                              : [...selected, o.id],
                          });
                        }
                      }}
                    >
                      {colorDot(o.color)}
                      <span className="flex-1">{o.value}</span>
                      {isOn && <Check className="ml-auto" />}
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    );
  }

  if (def.fieldType === 'date') {
    return (
      <DatePill
        value={(value?.value as string | null) ?? null}
        placeholder={def.name}
        onChange={(v) => onChange({ value: v })}
      />
    );
  }

  if (def.fieldType === 'datetime' || def.fieldType === 'datetime_range') {
    return (
      <DateTimePill
        value={(value?.value as string | null) ?? null}
        valueEnd={value?.valueEnd ?? null}
        range={def.fieldType === 'datetime_range'}
        placeholder={def.name}
        onChange={(v, valueEnd) => onChange({ value: v, valueEnd })}
      />
    );
  }

  // text / number / url
  const raw = value?.value;
  const hasValue = raw != null && raw !== '';
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Pill active={hasValue}>
          <span className="max-w-[160px] truncate">{hasValue ? String(raw) : def.name}</span>
        </Pill>
      </PopoverTrigger>
      <PopoverContent className="w-56 p-2" align="start">
        <Input
          type={def.fieldType}
          autoFocus
          value={raw != null ? String(raw) : ''}
          onChange={(e) => {
            const s = e.target.value;
            if (s === '') onChange({ value: null });
            else onChange({ value: def.fieldType === 'number' ? Number(s) : s });
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === 'Escape') setOpen(false);
          }}
        />
      </PopoverContent>
    </Popover>
  );
}
