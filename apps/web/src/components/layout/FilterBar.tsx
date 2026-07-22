import { useMemo, useState } from 'react';
import { Plus } from 'lucide-react';
import type { ProjectDetail, CustomField } from '@/lib/api';
import type { FilterCondition, FilterSet } from '@/utils/filters';
import { buildFieldSpecs, newCondition, type FieldSpec } from '@/utils/filterFields';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import FilterConditionPill from '@/components/layout/FilterConditionPill';

// The row of filter condition pills plus an add-condition button. Filters apply
// to whichever layout is active; empty/half-built conditions are ignored.
export default function FilterBar({
  filters,
  onChange,
  project,
  customFields,
}: {
  filters: FilterSet;
  onChange: (filters: FilterSet) => void;
  project: ProjectDetail;
  customFields: CustomField[];
}) {
  const [addOpen, setAddOpen] = useState(false);
  const specs = useMemo(() => buildFieldSpecs(project, customFields), [project, customFields]);
  const specByField = useMemo(() => new Map(specs.map((s) => [s.field, s])), [specs]);

  const update = (id: string, patch: Partial<FilterCondition>) =>
    onChange({ conditions: filters.conditions.map((c) => (c.id === id ? { ...c, ...patch } : c)) });

  const remove = (id: string) =>
    onChange({ conditions: filters.conditions.filter((c) => c.id !== id) });

  const add = (spec: FieldSpec) => {
    onChange({ conditions: [...filters.conditions, newCondition(spec)] });
    setAddOpen(false);
  };

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {filters.conditions.map((cond) => {
        const spec = specByField.get(cond.field);
        if (!spec) return null; // a field that no longer exists (deleted custom field / column)
        return (
          <FilterConditionPill
            key={cond.id}
            spec={spec}
            cond={cond}
            project={project}
            onOperatorChange={(op) => update(cond.id, { op })}
            onValuesChange={(values) => update(cond.id, { values })}
            onRemove={() => remove(cond.id)}
          />
        );
      })}

      <Popover open={addOpen} onOpenChange={setAddOpen}>
        <PopoverTrigger asChild>
          <Button variant="ghost" size="icon" className="size-6" title="Add filter">
            <Plus className="size-3.5" />
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="max-h-80 w-52 overflow-auto p-1">
          {specs.map((spec) => (
            <button
              key={spec.field}
              type="button"
              onClick={() => add(spec)}
              className="w-full truncate rounded px-2 py-1 text-left text-sm hover:bg-accent"
            >
              {spec.label}
            </button>
          ))}
        </PopoverContent>
      </Popover>
    </div>
  );
}
