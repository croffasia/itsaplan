import { Fragment, useState, type KeyboardEvent } from 'react';
import { useTranslations } from 'next-intl';
import type { FilterValue } from '@/utils/filters';
import { matchWords, type FieldSpec } from '@/utils/filterFields';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command';
import FilterMenuRow from '@/components/layout/FilterMenuRow';

// The values of one field, each ticked on or off, with a search over them. Ticked
// values combine: an issue that holds any of them matches. `onBack` is set where the
// menu started at the fields; Backspace in the empty search goes back to them.
export default function FilterValuesMenu({
  spec,
  selected,
  countOf,
  onToggle,
  onBack,
}: {
  spec: FieldSpec;
  selected: FilterValue[];
  countOf: (field: string, value: FilterValue) => number | undefined;
  onToggle: (value: FilterValue) => void;
  onBack?: () => void;
}) {
  const t = useTranslations('filters');
  const tCommon = useTranslations('common');
  const [search, setSearch] = useState('');
  const placeholder = t('fieldPlaceholder', { field: spec.label });
  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Backspace' && search === '' && onBack) {
      e.preventDefault();
      onBack();
    }
  };
  return (
    <Command filter={matchWords}>
      <CommandInput
        autoFocus
        value={search}
        onValueChange={setSearch}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        aria-label={placeholder}
      />
      <CommandList>
        <CommandEmpty>
          {spec.options?.length ? tCommon('nothingFound') : t('noOptions')}
        </CommandEmpty>
        <CommandGroup>
          {(spec.options ?? []).map((option) => (
            <Fragment key={String(option.value)}>
              {option.dividerBefore && <CommandSeparator className="my-1" />}
              <FilterMenuRow
                id={`${spec.field}:${String(option.value)}`}
                option={option}
                count={countOf(spec.field, option.value)}
                checked={selected.includes(option.value)}
                onSelect={() => onToggle(option.value)}
              />
            </Fragment>
          ))}
        </CommandGroup>
      </CommandList>
    </Command>
  );
}
