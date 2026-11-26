import { X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { ProjectDetail } from '@/lib/api/endpoints/projects';
import type { FilterCondition, FilterOperator, FilterValue } from '@/utils/filters';
import { OPERATORS_BY_KIND, type FieldSpec } from '@/utils/filterFields';
import { useFilterFields } from '@/hooks/useFilterFields';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import FilterValueEditor from '@/components/layout/FilterValueEditor';

// One condition in the filter bar, as a chip of parts: the field's icon and name,
// the operator, the values, and a remove button.
export default function FilterConditionPill({
  spec,
  cond,
  project,
  onOperatorChange,
  onValuesChange,
  onRemove,
}: {
  spec: FieldSpec;
  cond: FilterCondition;
  project: ProjectDetail;
  onOperatorChange: (op: FilterOperator) => void;
  onValuesChange: (values: FilterValue[]) => void;
  onRemove: () => void;
}) {
  const t = useTranslations('filters');
  const tCommon = useTranslations('common');
  const { operatorLabel } = useFilterFields();
  const opLabel = (op: FilterOperator) => operatorLabel(op, cond.values.length);
  return (
    <div className="flex h-7 max-w-full items-stretch rounded-md bg-muted text-sm">
      <span className="flex shrink-0 items-center gap-1.5 ps-2 pe-2 font-medium text-foreground [&_svg]:size-3.5 [&_svg]:text-muted-foreground">
        {spec.icon}
        {spec.label}
      </span>
      <Select value={cond.op} onValueChange={(v) => onOperatorChange(v as FilterOperator)}>
        <SelectTrigger
          size="sm"
          className="gap-1 rounded-none border-0 border-s border-background bg-transparent px-2 py-0 text-sm text-muted-foreground shadow-none hover:bg-accent focus-visible:ring-inset data-[size=sm]:h-auto dark:bg-transparent dark:hover:bg-accent [&_svg]:hidden"
        >
          <SelectValue>{opLabel(cond.op)}</SelectValue>
        </SelectTrigger>
        <SelectContent>
          {OPERATORS_BY_KIND[spec.kind].map((op) => (
            <SelectItem key={op} value={op}>
              {opLabel(op)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <FilterValueEditor spec={spec} cond={cond} onChange={onValuesChange} project={project} />
      <button
        type="button"
        onClick={onRemove}
        title={t('remove')}
        aria-label={tCommon('removeFilter', { filter: spec.label })}
        className="flex items-center rounded-e-md border-s border-background px-1.5 text-muted-foreground hover:bg-accent hover:text-foreground focus-visible:bg-accent focus-visible:outline-none"
      >
        <X className="size-3.5" />
      </button>
    </div>
  );
}
