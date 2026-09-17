import type { ProjectScaffold } from '@/lib/api/endpoints/projects';
import type { View } from '@/lib/api/endpoints/views';
import { BUILTIN_FILTER_FIELDS, OPERATORS_BY_KIND } from '@/utils/filterFields';
import { isEffectiveCondition, type FilterOperator } from '@/utils/filters';

export type PreviewFilter = {
  field: string;
  label?: string;
  op: FilterOperator;
  values: string[];
  remainingValues: number;
};

const operators = new Set(Object.values(OPERATORS_BY_KIND).flat());

export function viewPreviewFilters(view: View, project: ProjectScaffold): PreviewFilter[] {
  const conditions = Array.isArray(view.filters?.conditions) ? view.filters.conditions : [];
  return conditions
    .filter(
      (condition) =>
        condition &&
        typeof condition.field === 'string' &&
        operators.has(condition.op) &&
        isEffectiveCondition(condition),
    )
    .slice(0, 3)
    .map((condition) => {
      const field = condition.field;
      const custom = project.customFields.find((item) => `cf:${item.id}` === field);
      const known = BUILTIN_FILTER_FIELDS.some((item) => item === field);
      const values = (Array.isArray(condition.values) ? condition.values : [])
        .slice(0, 3)
        .map((value) => {
          if (value === null) return '—';
          if (field === 'status') return project.columns.find((item) => item.id === value)?.name;
          if (field === 'type') return project.issueTypes.find((item) => item.id === value)?.name;
          if (field === 'labels') return project.labels.find((item) => item.id === value)?.name;
          if (field === 'assignee' || field === 'delegate')
            return project.assignees.find((item) => item.userId === value)?.name;
          if (custom?.fieldType === 'select' || custom?.fieldType === 'multi_select')
            return custom.options.find((option) => option.id === value)?.value;
          if (custom?.fieldType === 'member')
            return project.assignees.find((item) => item.userId === value)?.name;
          if (custom?.fieldType === 'number' && typeof value === 'number') return String(value);
          if (typeof value !== 'string' && typeof value !== 'boolean') return undefined;
          return String(value)
            .replace(/^status:/, '')
            .slice(0, 80);
        })
        .filter((value): value is string => value !== undefined);
      return {
        field: known ? field : 'custom',
        label: custom?.name,
        op: condition.op,
        values,
        remainingValues: Math.max(0, (condition.values?.length ?? 0) - values.length),
      };
    });
}
