import { useMemo } from 'react';
import Link from 'next/link';
import { formatDateTime } from '@/utils/dates';
import type { ProjectDetail } from '@/lib/api';
import { issuePath } from '@/utils/paths';
import { EMPTY_FILTER_SET, applyFilters, isActiveFilterSet, type FilterSet } from '@/utils/filters';
import type { WidgetConfig } from '@/utils/dashboardWidgets';
import { Skeleton } from '@/components/ui/skeleton';
import { useActivityFeedQuery } from '../../services/analytics.service';

// Short verb per activity action, plus comment. Each phrase ends where the issue
// link follows, so a row reads "Ann changed the status of IAP-12". Enough to read
// the feed at a glance; the full change detail lives on the issue page.
const VERB: Record<string, string> = {
  created: 'created',
  title: 'renamed',
  description: 'updated the description of',
  status: 'changed the status of',
  assignee: 'changed the assignee of',
  priority: 'changed the priority of',
  type: 'changed the type of',
  start_date: 'changed the start date of',
  due_date: 'changed the due date of',
  label_add: 'added a label to',
  label_remove: 'removed a label from',
  field: 'updated a field on',
};

export const ACTION_FILTER: { value: string; label: string }[] = [
  { value: 'all', label: 'All activity' },
  { value: 'status', label: 'Status changes' },
  { value: 'assignee', label: 'Assignments' },
  { value: 'priority', label: 'Priority' },
  { value: 'created', label: 'Created' },
];

// The resolved issue ids travel in the request's query string, so a broad filter on
// a large project would build a URL past what proxies accept. Scope the feed to the
// most recently updated matches — the feed is newest-first, so older issues would
// not reach the visible rows anyway.
const MAX_SCOPED_ISSUES = 500;

// Project-wide activity feed, configured (not switched live) by an action-kind
// filter and the same board filter set the recent-issues widget uses. Both are
// edited from the header settings popover (see ActivityFeedWidgetSettings). The board
// filter selects issues client-side over the project's loaded issues; their ids
// scope the feed server-side, so "activity on urgent issues" reads only those.
export default function ActivityFeedWidget({
  projectKey,
  project,
  config,
}: {
  projectKey: string;
  project: ProjectDetail;
  config: WidgetConfig;
}) {
  const filters: FilterSet = config.filters ?? EMPTY_FILTER_SET;
  const action = config.action ?? null;
  const limit = config.limit ?? 20;

  // Resolve the board filter to issue ids client-side. null = no issue scope
  // (show every issue's activity); an empty array = filter matched nothing.
  const issueIds = useMemo(() => {
    if (!isActiveFilterSet(filters)) return null;
    const matched = applyFilters(project.issues, filters, project);
    if (matched.length <= MAX_SCOPED_ISSUES) return matched.map((i) => i.id);
    return [...matched]
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
      .slice(0, MAX_SCOPED_ISSUES)
      .map((i) => i.id);
  }, [filters, project]);

  const { data, isLoading } = useActivityFeedQuery(projectKey, { action, issueIds, limit });
  const items = data?.items ?? [];

  const actionLabel =
    ACTION_FILTER.find((o) => o.value === (action ?? 'all'))?.label ?? 'All activity';
  const filterCount = filters.conditions.length;
  const caption = [
    actionLabel,
    isActiveFilterSet(filters) ? `${filterCount} filter${filterCount === 1 ? '' : 's'}` : null,
  ]
    .filter(Boolean)
    .join(' · ');

  function feed() {
    if (isLoading) {
      return (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-8 w-full" />
          ))}
        </div>
      );
    }
    if (items.length === 0) {
      return (
        <p className="py-6 text-center text-sm text-muted-foreground">
          No activity matches this filter.
        </p>
      );
    }
    return (
      <ul className="space-y-2">
        {items.map((a) => (
          <li key={a.id} className="flex items-start gap-2 text-sm">
            <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-muted-foreground/40" />
            <div className="min-w-0 flex-1">
              <span className="text-foreground/80">{a.actorName ?? 'Someone'}</span>{' '}
              <span className="text-muted-foreground">
                {a.kind === 'comment' ? 'commented on' : (VERB[a.action ?? ''] ?? 'updated')}
              </span>{' '}
              <Link href={issuePath(projectKey, a.issueSequence)} className="hover:underline">
                {projectKey}-{a.issueSequence}
              </Link>
              <span className="ml-1 text-xs text-muted-foreground/70">
                {formatDateTime(a.createdAt)}
              </span>
            </div>
          </li>
        ))}
      </ul>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">{caption}</p>
      {feed()}
    </div>
  );
}
