import { X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { clearedSection, sectionInUse, type FilterSection } from './FilterMenu';

// The filters in force, one chip per section, each removed on its own or all at once.
export default function FilterChips({
  sections,
  onChange,
}: {
  sections: FilterSection[];
  onChange: (key: string, selected: string[]) => void;
}) {
  const t = useTranslations('common');
  const active = sections.filter(sectionInUse);
  if (active.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg bg-muted/40 px-3 py-2">
      <span className="text-sm text-muted-foreground">{t('shownFilters')}</span>
      {active.map((section) => (
        <span
          key={section.key}
          className="inline-flex h-7 max-w-full items-center gap-1.5 rounded-md bg-muted ps-2.5 pe-0.5 text-sm"
        >
          <span className="shrink-0 text-muted-foreground">{section.label}</span>
          <span className="truncate">
            {section.selected
              .map((value) => section.options.find((o) => o.value === value)?.label ?? value)
              .join(', ')}
          </span>
          <button
            type="button"
            onClick={() => onChange(section.key, clearedSection(section))}
            aria-label={t('removeFilter', { filter: section.label })}
            className="flex size-6 shrink-0 items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            <X className="size-3.5" />
          </button>
        </span>
      ))}
      {active.length > 1 && (
        <Button
          variant="ghost"
          size="sm"
          className="ms-auto h-7 text-muted-foreground"
          onClick={() =>
            active.forEach((section) => onChange(section.key, clearedSection(section)))
          }
        >
          {t('clearFilters')}
        </Button>
      )}
    </div>
  );
}
