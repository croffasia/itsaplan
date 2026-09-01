import { useMemo } from 'react';
import { ArrowUpRight } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useShell } from '@/context/shellContext';
import { EMPTY_FILTER_SET, applyFilters, type FilterSet } from '@/utils/filters';
import type { StatTone, WidgetConfig } from '@/utils/dashboardWidgets';
import { Skeleton } from '@/components/ui/skeleton';
import { projectPath } from '@/utils/paths';
import { cn } from '@/lib/utils';

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

  const toneClasses: Record<StatTone, string> = {
    neutral: 'text-foreground',
    blue: 'text-blue-700 dark:text-blue-300',
    violet: 'text-violet-700 dark:text-violet-300',
    rose: 'text-rose-700 dark:text-rose-300',
    amber: 'text-amber-700 dark:text-amber-300',
  };
  const tone = config.tone;

  return (
    <button
      type="button"
      aria-label={t('openFilteredIssues', { count })}
      onClick={() => {
        editor.applyTransientFilters(filters);
        router.push(projectPath(projectKey));
      }}
      className={cn(
        'group flex h-full w-full cursor-pointer justify-between rounded-md text-start font-semibold tracking-tight tabular-nums focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none',
        tone
          ? `items-end text-5xl ${toneClasses[tone]}`
          : 'items-start text-4xl hover:text-primary',
      )}
    >
      <span>{count}</span>
      {tone && (
        <span className="mb-1 grid size-8 place-items-center rounded-full bg-background/60 text-current opacity-55 transition group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:opacity-100">
          <ArrowUpRight className="size-4" />
        </span>
      )}
    </button>
  );
}
