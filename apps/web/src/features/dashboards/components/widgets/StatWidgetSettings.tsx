import { useShell } from '@/context/shellContext';
import { EMPTY_FILTER_SET, type FilterSet } from '@/utils/filters';
import type { WidgetConfig } from '@/utils/dashboardWidgets';
import FilterBar from '@/components/layout/FilterBar';

// The board filter that selects which issues are counted.
export default function StatWidgetSettings({
  config,
  onConfigChange,
}: {
  config: WidgetConfig;
  onConfigChange: (config: WidgetConfig) => void;
}) {
  const { project, customFields } = useShell();
  const filters: FilterSet = config.filters ?? EMPTY_FILTER_SET;
  if (!project) return null;
  return (
    <FilterBar
      filters={filters}
      onChange={(next) => onConfigChange({ filters: next })}
      project={project}
      customFields={customFields}
    />
  );
}
