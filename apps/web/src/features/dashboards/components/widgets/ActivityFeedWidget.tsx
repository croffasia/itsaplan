import { useMemo } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { formatDateTime } from '@/utils/dates';
import type { ProjectDetail } from '@/lib/api';
import { issuePath } from '@/utils/paths';
import { EMPTY_FILTER_SET, applyFilters, isActiveFilterSet, type FilterSet } from '@/utils/filters';
import type { WidgetConfig } from '@/utils/dashboardWidgets';
import { Skeleton } from '@/components/ui/skeleton';
import { useActivityFeedQuery } from '../../services/analytics.service';

// The actions that get their own verb phrase, as messages under
// `dashboards.activityFeed.verbs`. Each phrase ends where the issue link follows,
// so a row reads "Ann changed the status of IAP-12". Enough to read the feed at a
// glance; the full change detail lives on the issue page. Anything else falls back
// to `verbs.other`.
const VERB_ACTIONS = [
  'created',
  'title',
  'description',
  'status',
  'assignee',
  'priority',
  'type',
  'start_date',
  'due_date',
  'label_add',
  'label_remove',
  'field',
] as const;

// The action kinds the feed can be narrowed to. Their labels are messages under
// `dashboards.activityFeed.actions`.
export const ACTION_FILTER = ['all', 'status', 'assignee', 'priority', 'created'] as const;

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
  const t = useTranslations('dashboards.activityFeed');
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

  const selected = ACTION_FILTER.find((o) => o === (action ?? 'all')) ?? 'all';
  const caption = [
    t(`actions.${selected}`),
    isActiveFilterSet(filters) ? t('filterCount', { count: filters.conditions.length }) : null,
  ]
    .filter(Boolean)
    .join(' · ');

  // A comment carries no action; an action outside the listed ones reads as a
  // generic update.
  function verb(kind: string, action: string | null) {
    if (kind === 'comment') return t('verbs.comment');
    return t(`verbs.${VERB_ACTIONS.find((v) => v === action) ?? 'other'}`);
  }

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
      return <p className="py-6 text-center text-sm text-muted-foreground">{t('empty')}</p>;
    }
    return (
      <ul className="space-y-2">
        {items.map((a) => (
          <li key={a.id} className="flex items-start gap-2 text-sm">
            <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-muted-foreground/40" />
            <div className="min-w-0 flex-1">
              <span className="text-foreground/80">{a.actorName ?? t('someone')}</span>{' '}
              <span className="text-muted-foreground">{verb(a.kind, a.action)}</span>{' '}
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
