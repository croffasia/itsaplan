'use client';

import { ListFilter } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import FilterOptions from './FilterOptions';

export interface FilterOption {
  value: string;
  label: string;
  detail?: string;
  count?: number;
  // A person's value shows their avatar before the label.
  avatar?: { name: string; image?: string | null };
}

export interface FilterSection {
  key: string;
  label: string;
  options: FilterOption[];
  selected: string[];
  // Set on a section that always holds one value, such as a period: its values are a
  // choice of one, and it is in use only while it holds another value.
  defaultValue?: string;
}

export const sectionInUse = (section: FilterSection) =>
  section.defaultValue === undefined
    ? section.selected.length > 0
    : section.selected[0] !== section.defaultValue;

// What a section holds once its filter is removed.
export const clearedSection = (section: FilterSection) =>
  section.defaultValue === undefined ? [] : [section.defaultValue];

// The filter of a list or a dashboard. A section narrows it to the values ticked in it and
// leaves it whole while none is; sections narrow it together.
export default function FilterMenu({
  sections,
  onChange,
}: {
  sections: FilterSection[];
  onChange: (key: string, selected: string[]) => void;
}) {
  const t = useTranslations('common');
  const shown = sections.filter((section) => section.options.length > 0);
  const active = shown.filter(sectionInUse).length;
  if (shown.length === 0) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant={active > 0 ? 'secondary' : 'ghost'}
          size="sm"
          className="h-9 gap-1.5 text-muted-foreground"
        >
          <ListFilter className="size-4" />
          {t('filter')}
          {active > 0 && (
            <span className="flex h-4.5 min-w-4.5 items-center justify-center rounded-full bg-primary px-1 text-[11px] font-semibold text-primary-foreground tabular-nums">
              {active}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        {shown.length === 1 ? (
          <>
            <DropdownMenuLabel>{shown[0].label}</DropdownMenuLabel>
            <FilterOptions
              section={shown[0]}
              onChange={(selected) => onChange(shown[0].key, selected)}
            />
          </>
        ) : (
          <>
            <DropdownMenuLabel>{t('filterBy')}</DropdownMenuLabel>
            {shown.map((section) => (
              <DropdownMenuSub key={section.key}>
                <DropdownMenuSubTrigger>
                  <span className="flex-1 truncate">{section.label}</span>
                  {sectionInUse(section) && (
                    <span className="text-xs text-muted-foreground tabular-nums">
                      {section.defaultValue === undefined
                        ? section.selected.length
                        : section.options.find((o) => o.value === section.selected[0])?.label}
                    </span>
                  )}
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent className="w-64">
                  <FilterOptions
                    section={section}
                    onChange={(selected) => onChange(section.key, selected)}
                  />
                </DropdownMenuSubContent>
              </DropdownMenuSub>
            ))}
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
