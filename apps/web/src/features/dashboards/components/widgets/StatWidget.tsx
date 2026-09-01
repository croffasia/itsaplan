import { useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useShell } from '@/context/shellContext';
import { EMPTY_FILTER_SET, applyFilters, type FilterSet } from '@/utils/filters';
import type { WidgetConfig } from '@/utils/dashboardWidgets';
import { Skeleton } from '@/components/ui/skeleton';
import { projectPath } from '@/utils/paths';

// A single number: the count of issues matching the widget's board filter. The
// filter is a configured setting (edited from the header settings popover, see
// StatWidgetSettings); the count is computed client-side over the project's loaded
// issues, so it stays in sync with the board. With no filter it counts every issue.
export default function StatWidget({
  projectKey,
  config,
}: {
  projectKey: string;
  config: WidgetConfig;
}) {
  const t = useTranslations('dashboards');
  const router = useRouter();
  const { project, filterContext, editor } = useShell();
  const filters: FilterSet = config.filters ?? EMPTY_FILTER_SET;

  const count = useMemo(
    () => (project ? applyFilters(project.issues, filters, project, filterContext).length : 0),
    [project, filters, filterContext],
  );

  if (!project) return <Skeleton className="h-10 w-16" />;

  return (
    <button
      type="button"
      aria-label={t('openFilteredIssues', { count })}
      onClick={() => {
        editor.applyTransientFilters(filters);
        router.push(projectPath(projectKey));
      }}
      className="flex h-full w-full cursor-pointer items-start rounded-md text-start text-4xl font-semibold tracking-tight tabular-nums hover:text-primary focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
    >
      {count}
    </button>
  );
}
