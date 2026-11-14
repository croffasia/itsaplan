'use client';

import { ListFilter } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

// The filter beside a list's search box: which groups of the list it shows. Every group
// is shown until the reader hides it. The last shown group cannot be hidden, so the list
// never asks for nothing.
export default function ShowFilterMenu<T extends string>({
  heading,
  options,
  hidden,
  onChange,
}: {
  heading: string;
  options: { value: T; label: string }[];
  hidden: T[];
  onChange: (hidden: T[]) => void;
}) {
  const t = useTranslations('common');
  const shownCount = options.filter((option) => !hidden.includes(option.value)).length;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant={hidden.length > 0 ? 'secondary' : 'ghost'}
          size="sm"
          className="h-9 gap-1.5 text-muted-foreground"
        >
          <ListFilter className="size-4" />
          {t('filter')}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        <DropdownMenuLabel>{heading}</DropdownMenuLabel>
        {options.map(({ value, label }) => {
          const shown = !hidden.includes(value);
          return (
            <DropdownMenuCheckboxItem
              key={value}
              checked={shown}
              disabled={shown && shownCount === 1}
              onCheckedChange={() =>
                onChange(shown ? [...hidden, value] : hidden.filter((v) => v !== value))
              }
              onSelect={(e) => e.preventDefault()}
            >
              {label}
            </DropdownMenuCheckboxItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
