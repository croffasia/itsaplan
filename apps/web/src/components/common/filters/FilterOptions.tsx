import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { DropdownMenuCheckboxItem } from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import type { FilterSection } from './FilterMenu';

// A section with this many values or more gets a search box over them.
const SEARCH_FROM = 9;

// The values of one filter section, each ticked on or off. The menu stays open, so
// several can be ticked in a row. A section with a default value is a choice of one: a
// value replaces the one ticked, and the menu closes.
export default function FilterOptions({
  section,
  onChange,
}: {
  section: FilterSection;
  onChange: (selected: string[]) => void;
}) {
  const t = useTranslations('common');
  const [query, setQuery] = useState('');

  if (section.defaultValue !== undefined) {
    return section.options.map((option) => (
      <DropdownMenuCheckboxItem
        key={option.value}
        checked={section.selected[0] === option.value}
        onCheckedChange={() => onChange([option.value])}
      >
        {option.label}
      </DropdownMenuCheckboxItem>
    ));
  }

  const q = query.trim().toLowerCase();
  const options = q
    ? section.options.filter((option) =>
        `${option.label} ${option.detail ?? ''}`.toLowerCase().includes(q),
      )
    : section.options;

  return (
    <>
      {section.options.length >= SEARCH_FROM && (
        <div className="p-1">
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            // The menu reads typed letters as a jump to an item; Escape still closes it.
            onKeyDown={(e) => e.key !== 'Escape' && e.stopPropagation()}
            placeholder={t('search')}
            aria-label={t('search')}
            className="h-8"
          />
        </div>
      )}
      <div className="max-h-72 overflow-y-auto">
        {options.map((option) => {
          const checked = section.selected.includes(option.value);
          return (
            <DropdownMenuCheckboxItem
              key={option.value}
              checked={checked}
              onCheckedChange={() =>
                onChange(
                  checked
                    ? section.selected.filter((v) => v !== option.value)
                    : [...section.selected, option.value],
                )
              }
              onSelect={(e) => e.preventDefault()}
            >
              <span className="shrink-0 truncate">{option.label}</span>
              {option.detail && (
                <span className="min-w-0 truncate text-muted-foreground">{option.detail}</span>
              )}
              {option.count !== undefined && (
                <span className="ms-auto text-xs text-muted-foreground tabular-nums">
                  {option.count}
                </span>
              )}
            </DropdownMenuCheckboxItem>
          );
        })}
        {options.length === 0 && (
          <p className="px-2 py-1.5 text-sm text-muted-foreground">{t('nothingFound')}</p>
        )}
      </div>
    </>
  );
}
