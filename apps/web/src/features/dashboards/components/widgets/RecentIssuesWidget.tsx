import { useMemo } from 'react';
import Link from 'next/link';
import { useShell } from '@/context/shellContext';
import { issuePath } from '@/utils/paths';
import { formatShortDate } from '@/utils/dates';
import { priorityLabel } from '@/utils/fieldOptions';
import { EMPTY_FILTER_SET, applyFilters, isActiveFilterSet, type FilterSet } from '@/utils/filters';
import type { WidgetConfig } from '@/utils/dashboardWidgets';
import { Skeleton } from '@/components/ui/skeleton';

// Recent issues filtered by the same board filter set (status, assignee, priority,
// labels, dates, custom fields) and sorted by created or updated time. Both the
// filter and the sort are configured settings (edited from the header settings
// popover, see RecentIssuesWidgetSettings) — the view is static. Filtering runs
// client-side over the project's already-loaded issues, so it stays in sync with
// the board.
export default function RecentIssuesWidget({
  projectKey,
  config,
}: {
  projectKey: string;
  config: WidgetConfig;
}) {
  const { project } = useShell();
  const sort = config.sort ?? 'created';
  const limit = config.limit ?? 10;
  const filters: FilterSet = config.filters ?? EMPTY_FILTER_SET;

  const issues = useMemo(() => {
    if (!project) return [];
    const filtered = applyFilters(project.issues, filters, project);
    const sorted = [...filtered].sort((a, b) =>
      sort === 'updated'
        ? b.updatedAt.localeCompare(a.updatedAt)
        : b.createdAt.localeCompare(a.createdAt),
    );
    return sorted.slice(0, limit);
  }, [project, filters, sort, limit]);

  const columnById = useMemo(
    () => new Map((project?.columns ?? []).map((c) => [c.id, c])),
    [project],
  );

  if (!project) return <Skeleton className="h-40 w-full" />;

  const filterCount = filters.conditions.length;
  const caption = [
    sort === 'updated' ? 'Recently updated' : 'Newest first',
    isActiveFilterSet(filters) ? `${filterCount} filter${filterCount === 1 ? '' : 's'}` : null,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">{caption}</p>

      {issues.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">
          No issues match this filter.
        </p>
      ) : (
        <ul className="space-y-0.5">
          {issues.map((issue) => {
            const column = columnById.get(issue.columnId);
            return (
              <li key={issue.id}>
                <Link
                  href={issuePath(projectKey, issue.sequenceNumber)}
                  className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-accent"
                >
                  <span
                    className="size-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: column?.color ?? '#6b7280' }}
                    title={column?.name}
                  />
                  <span className="shrink-0 text-muted-foreground tabular-nums">
                    {issue.identifier}
                  </span>
                  <span className="min-w-0 flex-1 truncate">{issue.title}</span>
                  {issue.priority && (
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {priorityLabel(issue.priority)}
                    </span>
                  )}
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {formatShortDate(sort === 'updated' ? issue.updatedAt : issue.createdAt)}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
