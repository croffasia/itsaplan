import { useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { ArrowUpRight } from 'lucide-react';
import { useShell } from '@/context/shellContext';
import { usePermissions } from '@/hooks/usePermissions';
import { EMPTY_FILTER_SET, applyFilters, type FilterSet } from '@/utils/filters';
import type { WidgetConfig } from '@/utils/dashboardWidgets';
import { Skeleton } from '@/components/ui/skeleton';

// A single number: the count of issues matching the widget's board filter. The
// filter is a configured setting (edited from the header settings popover, see
// StatWidgetSettings); the count is computed client-side over the project's loaded
// issues, so it stays in sync with the board. With no filter it counts every issue.
export default function StatWidget({
  config,
  title,
  editing,
}: {
  config: WidgetConfig;
  title?: string;
  editing: boolean;
}) {
  const t = useTranslations('dashboards');
  const { project, filterContext, editor } = useShell();
  const { can } = usePermissions();
  const filters: FilterSet = config.filters ?? EMPTY_FILTER_SET;

  const count = useMemo(
    () => (project ? applyFilters(project.issues, filters, project, filterContext).length : 0),
    [project, filters, filterContext],
  );

  if (!project) return <Skeleton className="h-10 w-16" />;

  const value = <span className="text-4xl font-semibold tracking-tight tabular-nums">{count}</span>;
  if (editing || !can('work_items', 'read')) return <div>{value}</div>;

  const label = t('widgets.stat.viewIssues', { title: title || t('widgets.stat.label'), count });
  return (
    <button
      type="button"
      onClick={() => editor.openFilteredIssues(filters)}
      aria-label={label}
      title={label}
      className="group flex min-h-11 w-full cursor-pointer items-center justify-between gap-3 rounded-md text-start transition-colors outline-none hover:text-primary focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
    >
      {value}
      <ArrowUpRight
        aria-hidden="true"
        className="size-4 shrink-0 text-muted-foreground group-hover:text-primary rtl:-scale-x-100"
      />
    </button>
  );
}
