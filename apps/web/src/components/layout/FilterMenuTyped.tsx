import { useState, type KeyboardEvent } from 'react';
import { useTranslations } from 'next-intl';
import type { FilterValue } from '@/utils/filters';
import { OPERATORS_BY_KIND, type FieldSpec } from '@/utils/filterFields';
import { useFilterFields } from '@/hooks/useFilterFields';
import {
  Command,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';

// The step of a text or number field: what the user types is the value, and Enter
// adds the condition with it. Backspace in the empty field goes back to the fields.
export default function FilterMenuTyped({
  spec,
  onAdd,
  onBack,
}: {
  spec: FieldSpec;
  onAdd: (value: FilterValue) => void;
  onBack: () => void;
}) {
  const t = useTranslations('filters');
  const { operatorLabel } = useFilterFields();
  const [typed, setTyped] = useState('');
  const text = typed.trim();
  const value = spec.kind === 'number' ? Number(text) : text;
  const valid = text !== '' && (spec.kind !== 'number' || Number.isFinite(value));
  const placeholder = t('fieldPlaceholder', { field: spec.label });
  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Backspace' && typed === '') {
      e.preventDefault();
      onBack();
    }
  };
  return (
    <Command shouldFilter={false}>
      <CommandInput
        autoFocus
        value={typed}
        onValueChange={setTyped}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        aria-label={placeholder}
      />
      <CommandList>
        <CommandGroup>
          <CommandItem value="typed" disabled={!valid} onSelect={() => onAdd(value)}>
            {spec.icon}
            <span className="truncate">
              {spec.label} {operatorLabel(OPERATORS_BY_KIND[spec.kind][0])}{' '}
              {valid ? (
                <span className="font-medium">{text}</span>
              ) : (
                <span className="text-muted-foreground">{t('valuePlaceholder')}</span>
              )}
            </span>
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </Command>
  );
}
