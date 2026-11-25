import { useState } from 'react';
import type { CustomField } from '@/lib/api/endpoints/customFields';
import type { ProjectDetail } from '@/lib/api/endpoints/projects';
import {
  fieldCondition,
  toggleConditionValue,
  withFieldValue,
  type FilterSet,
  type FilterValue,
} from '@/utils/filters';
import type { FieldSpec } from '@/utils/filterFields';
import { useFilterCounts } from '@/hooks/useFilterCounts';
import { newCondition, useFilterFields } from '@/hooks/useFilterFields';
import FilterMenuDate from '@/components/layout/FilterMenuDate';
import FilterMenuFields from '@/components/layout/FilterMenuFields';
import FilterMenuTyped from '@/components/layout/FilterMenuTyped';
import FilterValuesMenu from '@/components/layout/FilterValuesMenu';

// The filter menu behind the filter button and the add button of the filter row. It
// opens on the fields; picking one shows its values in place, a calendar for a date
// or a field to type in. Values ticked there join the field's first "is" condition,
// or start one. A value picked from the search over every field, a day or a typed
// value adds its condition and closes the menu.
export default function FilterCommandMenu({
  filters,
  onChange,
  project,
  customFields,
  onClose,
}: {
  filters: FilterSet;
  onChange: (filters: FilterSet) => void;
  project: ProjectDetail;
  customFields: CustomField[];
  onClose: () => void;
}) {
  const { fieldSpecs } = useFilterFields(project.project.ref);
  const countOf = useFilterCounts(project);
  const specs = fieldSpecs(project, customFields);
  const [fieldKey, setFieldKey] = useState<string | null>(null);
  const [targetId, setTargetId] = useState<string | null>(null);
  const spec = specs.find((s) => s.field === fieldKey);
  const target = filters.conditions.find((c) => c.id === targetId);
  const back = () => setFieldKey(null);

  const add = (next: FilterSet) => {
    onChange(next);
    onClose();
  };
  const addValue = (field: FieldSpec, value: FilterValue) =>
    add({ conditions: [...filters.conditions, { ...newCondition(field), values: [value] }] });

  const toggle = (field: FieldSpec, value: FilterValue) => {
    if (target) {
      onChange(toggleConditionValue(filters, target.id, value));
      return;
    }
    const added = withFieldValue(filters, field.field, value);
    onChange(added.filters);
    setTargetId(added.id);
  };

  if (!spec) {
    return (
      <FilterMenuFields
        specs={specs}
        countOf={countOf}
        onField={(field) => {
          setFieldKey(field.field);
          setTargetId(fieldCondition(filters, field.field)?.id ?? null);
        }}
        onValue={(field, value) => add(withFieldValue(filters, field.field, value).filters)}
      />
    );
  }
  if (spec.options) {
    return (
      <FilterValuesMenu
        spec={spec}
        selected={target?.values ?? []}
        countOf={countOf}
        onToggle={(value) => toggle(spec, value)}
        onBack={back}
      />
    );
  }
  if (spec.kind === 'date') {
    return <FilterMenuDate spec={spec} onAdd={(day) => addValue(spec, day)} onBack={back} />;
  }
  return <FilterMenuTyped spec={spec} onAdd={(value) => addValue(spec, value)} onBack={back} />;
}
