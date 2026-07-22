import { useShell } from '@/context/shellContext';
import { EMPTY_FILTER_SET, type FilterSet } from '@/utils/filters';
import type { WidgetConfig } from '@/utils/dashboardWidgets';
import FilterBar from '@/components/layout/FilterBar';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ACTION_FILTER } from './ActivityFeedWidget';
import LimitSelect from './LimitSelect';

// The action-kind filter, the row count and the board filter set.
export default function ActivityFeedWidgetSettings({
  config,
  onConfigChange,
}: {
  config: WidgetConfig;
  onConfigChange: (config: WidgetConfig) => void;
}) {
  const { project, customFields } = useShell();
  const filters: FilterSet = config.filters ?? EMPTY_FILTER_SET;
  const action = config.action ?? null;
  const limit = config.limit ?? 20;
  if (!project) return null;
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Select
        value={action ?? 'all'}
        onValueChange={(v) => onConfigChange({ action: v === 'all' ? null : v })}
      >
        <SelectTrigger size="sm" className="w-[150px]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {ACTION_FILTER.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <LimitSelect value={limit} onChange={(next) => onConfigChange({ limit: next })} />
      <FilterBar
        filters={filters}
        onChange={(next) => onConfigChange({ filters: next })}
        project={project}
        customFields={customFields}
      />
    </div>
  );
}
