import { X } from 'lucide-react';
import type { ProjectDetail } from '@/lib/api';
import type { FilterCondition, FilterOperator, FilterValue } from '@/utils/filters';
import { OPERATOR_LABELS, OPERATORS_BY_KIND, type FieldSpec } from '@/utils/filterFields';
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
  return (
    <div className="flex items-center gap-1 rounded-md border bg-muted/60 py-0.5 pr-0.5 pl-2 text-xs">
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
              {OPERATOR_LABELS[op]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <FilterValueEditor spec={spec} cond={cond} onChange={onValuesChange} project={project} />
      <button
        type="button"
        onClick={onRemove}
        title="Remove filter"
        className="rounded p-0.5 hover:bg-accent"
      >
        <X className="size-3.5" />
      </button>
    </div>
  );
}
