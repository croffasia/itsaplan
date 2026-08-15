import { X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { ProjectDetail } from '@/lib/api';
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

// One condition in the filter bar: the field label, its operator, the value
// editor for its kind, and a remove button.
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
  const { operatorLabel } = useFilterFields();
  return (
    <div className="flex items-center gap-1 rounded-md border bg-muted/60 py-0.5 ps-2 pe-0.5 text-xs">
      <span className="font-medium text-foreground">{spec.label}</span>
      <Select value={cond.op} onValueChange={(v) => onOperatorChange(v as FilterOperator)}>
        <SelectTrigger
          size="sm"
          className="h-6 gap-1 border-0 bg-transparent px-1 text-muted-foreground shadow-none"
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {OPERATORS_BY_KIND[spec.kind].map((op) => (
            <SelectItem key={op} value={op}>
              {operatorLabel(op)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <FilterValueEditor spec={spec} cond={cond} onChange={onValuesChange} project={project} />
      <button
        type="button"
        onClick={onRemove}
        title={t('remove')}
        className="rounded p-0.5 hover:bg-accent"
      >
        <X className="size-3.5" />
      </button>
    </div>
  );
}
