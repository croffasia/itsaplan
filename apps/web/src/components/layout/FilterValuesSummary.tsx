import type { FilterCondition } from '@/utils/filters';
import type { FieldSpec } from '@/utils/filterFields';
import { cn } from '@/lib/utils';

// The values of a condition as its chip shows them: the icon of each, up to three
// stacked, before `label`, the short text the filter vocabulary gives them.
export default function FilterValuesSummary({
  spec,
  cond,
  label,
}: {
  spec: FieldSpec;
  cond: FilterCondition;
  label: string;
}) {
  const icons = cond.values
    .map((value) => spec.options?.find((o) => o.value === value)?.icon)
    .filter(Boolean)
    .slice(0, 3);
  const stacked = icons.length > 1;
  return (
    <>
      {icons.length > 0 && (
        <span className="flex shrink-0 items-center [&>*+*]:-ms-1">
          {icons.map((icon, i) => (
            <span key={i} className={cn('flex rounded-full', stacked && 'ring-2 ring-muted')}>
              {icon}
            </span>
          ))}
        </span>
      )}
      <span className="truncate">{label}</span>
    </>
  );
}
