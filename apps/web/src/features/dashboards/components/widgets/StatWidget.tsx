import { useMemo } from 'react';
import { useShell } from '@/context/shellContext';
import { EMPTY_FILTER_SET, applyFilters, type FilterSet } from '@/utils/filters';
import type { WidgetConfig } from '@/utils/dashboardWidgets';
import { Skeleton } from '@/components/ui/skeleton';

// A single number: the count of issues matching the widget's board filter. The
// filter is a configured setting (edited from the header settings popover, see
// StatWidgetSettings); the count is computed client-side over the project's loaded
// issues, so it stays in sync with the board. With no filter it counts every issue.
export default function StatWidget({ config }: { config: WidgetConfig }) {
  const { project } = useShell();
  const filters: FilterSet = config.filters ?? EMPTY_FILTER_SET;

  const count = useMemo(
    () => (project ? applyFilters(project.issues, filters, project).length : 0),
    [project, filters],
  );

  if (!project) return <Skeleton className="h-10 w-16" />;

  return <div className="text-4xl font-semibold tracking-tight tabular-nums">{count}</div>;
}
