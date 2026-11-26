import { useState } from 'react';
import { useTranslations } from 'next-intl';
import type { FilterValue } from '@/utils/filters';
import { matchWords, type FieldSpec } from '@/utils/filterFields';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import FilterMenuRow from '@/components/layout/FilterMenuRow';

// The first step of the filter menu: the fields, and while the user types, the
// values of every field that match, under the field's name, so one pick adds a
// whole condition.
export default function FilterMenuFields({
  specs,
  countOf,
  onField,
  onValue,
}: {
  specs: FieldSpec[];
  countOf: (field: string, value: FilterValue) => number | undefined;
  onField: (spec: FieldSpec) => void;
  onValue: (spec: FieldSpec, value: FilterValue) => void;
}) {
  const t = useTranslations('filters');
  const tCommon = useTranslations('common');
  const [search, setSearch] = useState('');
  return (
    <Command filter={matchWords}>
      <CommandInput
        autoFocus
        value={search}
        onValueChange={setSearch}
        placeholder={t('menuPlaceholder')}
        aria-label={t('menuPlaceholder')}
      />
      <CommandList>
        <CommandEmpty>{tCommon('nothingFound')}</CommandEmpty>
        <CommandGroup>
          {specs.map((spec) => (
            <CommandItem
              key={spec.field}
              value={`field:${spec.field}`}
              keywords={[spec.label]}
              onSelect={() => onField(spec)}
            >
              {spec.icon}
              <span className="flex-1 truncate">{spec.label}</span>
            </CommandItem>
          ))}
        </CommandGroup>
        {search.trim() !== '' &&
          specs.map(
            (spec) =>
              spec.options && (
                <CommandGroup key={spec.field} heading={spec.label}>
                  {spec.options.map((option) => (
                    <FilterMenuRow
                      key={String(option.value)}
                      id={`${spec.field}:${String(option.value)}`}
                      option={option}
                      count={countOf(spec.field, option.value)}
                      onSelect={() => onValue(spec, option.value)}
                    />
                  ))}
                </CommandGroup>
              ),
          )}
      </CommandList>
    </Command>
  );
}
