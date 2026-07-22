import { cn } from '@/lib/utils';
import { useShell } from '@/context/shellContext';
import { EMPTY_FILTER_SET, type FilterSet } from '@/utils/filters';
import type { WidgetConfig } from '@/utils/dashboardWidgets';
import FilterBar from '@/components/layout/FilterBar';
import LimitSelect from './LimitSelect';

const SORTS: { value: 'created' | 'updated'; label: string }[] = [
  { value: 'created', label: 'Newest' },
  { value: 'updated', label: 'Updated' },
];

// The sort order, the row count and the board filter set.
export default function RecentIssuesWidgetSettings({
  config,
  onConfigChange,
}: {
  config: WidgetConfig;
  onConfigChange: (config: WidgetConfig) => void;
}) {
  const { project, customFields } = useShell();
  const sort = config.sort ?? 'created';
  const limit = config.limit ?? 10;
  const filters: FilterSet = config.filters ?? EMPTY_FILTER_SET;
  if (!project) return null;
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <div className="flex gap-1">
          {SORTS.map((s) => (
            <button
              key={s.value}
              type="button"
              onClick={() => onConfigChange({ sort: s.value })}
              className={cn(
                'rounded-md px-2 py-0.5 text-xs transition-colors',
                sort === s.value
                  ? 'bg-secondary font-medium text-foreground'
                  : 'text-muted-foreground hover:bg-accent hover:text-foreground',
              )}
            >
              {s.label}
            </button>
          ))}
        </div>
        <LimitSelect value={limit} onChange={(next) => onConfigChange({ limit: next })} />
      </div>
      <FilterBar
        filters={filters}
        onChange={(next) => onConfigChange({ filters: next })}
        project={project}
        customFields={customFields}
      />
    </div>
  );
}
