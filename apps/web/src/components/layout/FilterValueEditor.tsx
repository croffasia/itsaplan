import { useState } from 'react';
import { useTranslations } from 'next-intl';
import type { ProjectDetail } from '@/lib/api/endpoints/projects';
import type { FilterCondition, FilterValue } from '@/utils/filters';
import type { FieldSpec } from '@/utils/filterFields';
import { useFilterCounts } from '@/hooks/useFilterCounts';
import { useFilterFields } from '@/hooks/useFilterFields';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import DatePill from '@/components/common/fields/DatePill';
import FilterValuesMenu from '@/components/layout/FilterValuesMenu';
import FilterValuesSummary from '@/components/layout/FilterValuesSummary';

const SEGMENT =
  "flex max-w-56 min-w-0 items-center gap-1.5 border-s border-background px-2 hover:bg-accent focus-visible:bg-accent focus-visible:outline-none [&_svg:not([class*='size-'])]:size-3.5";

// The value part of a condition chip, chosen by field kind: the values of a list
// field open the same list the filter menu shows. Presence operators (is_set and
// is_not_set) need no value.
export default function FilterValueEditor({
  spec,
  cond,
  onChange,
  project,
}: {
  spec: FieldSpec;
  cond: FilterCondition;
  onChange: (values: FilterValue[]) => void;
  project: ProjectDetail;
}) {
  const t = useTranslations('filters');
  const { valuesLabel } = useFilterFields();
  const countOf = useFilterCounts(project);
  const [open, setOpen] = useState(false);

  if (cond.op === 'is_set' || cond.op === 'is_not_set') return null;

  const trigger = (
    <button type="button" className={SEGMENT}>
      {cond.values.length === 0 ? (
        <span className="text-muted-foreground">{t('valuePlaceholder')}</span>
      ) : (
        <FilterValuesSummary spec={spec} cond={cond} label={valuesLabel(spec, cond)} />
      )}
    </button>
  );

  if (spec.kind === 'date') {
    const current = typeof cond.values[0] === 'string' ? (cond.values[0] as string) : null;
    return <DatePill value={current} onChange={(v) => onChange(v ? [v] : [])} trigger={trigger} />;
  }

  if (spec.kind === 'text' || spec.kind === 'number') {
    const current = cond.values[0] == null ? '' : String(cond.values[0]);
    return (
      <span className={SEGMENT}>
        <Input
          type={spec.kind === 'number' ? 'number' : 'text'}
          value={current}
          placeholder={t('valuePlaceholder')}
          aria-label={spec.label}
          onChange={(e) => {
            const raw = e.target.value;
            if (raw === '') onChange([]);
            else onChange([spec.kind === 'number' ? Number(raw) : raw]);
          }}
          className="h-6 w-28 border-0 bg-transparent px-0 py-0 text-sm shadow-none focus-visible:ring-0 dark:bg-transparent"
        />
      </span>
    );
  }

  const toggle = (value: FilterValue) =>
    onChange(
      cond.values.includes(value)
        ? cond.values.filter((v) => v !== value)
        : [...cond.values, value],
    );
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent align="start" className="w-72 p-0">
        <FilterValuesMenu spec={spec} selected={cond.values} countOf={countOf} onToggle={toggle} />
      </PopoverContent>
    </Popover>
  );
}
