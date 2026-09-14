'use client';

import { useEffect, useMemo, useState } from 'react';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import SectionPageView from '@/components/common/page/SectionPageView';
import PageDateStamp from '@/components/common/page/PageDateStamp';
import { usePermissions } from '@/hooks/usePermissions';
import { useShell } from '@/context/shellContext';
import type { Competitor } from '@/lib/api';
import CompetitorAlertsCard from './components/CompetitorAlertsCard';
import CompetitorFilters from './components/CompetitorFilters';
import CompetitorList from './components/CompetitorList';
import CompetitorProvidersNotice from './components/CompetitorProvidersNotice';
import CompetitorSummaryCards from './components/CompetitorSummaryCards';
import CompetitorTrackDialog from './components/CompetitorTrackDialog';
import { filterCompetitors, type CompetitorFilter } from './utils/competitors';
import {
  useCheckCompetitor,
  useCompetitorEventsQuery,
  useCompetitorOverviewQuery,
  useCompetitorsQuery,
  useMarkCompetitorEventsRead,
  useTrackCompetitor,
  useUntrackCompetitor,
  useUpdateCompetitor,
} from './services/competitors.service';

const EMPTY_OVERVIEW = {
  tracked: 0,
  active: 0,
  byPlatform: [],
  alertsToday: 0,
  unread: 0,
  newPosts24h: 0,
  failing: 0,
  lastSyncAt: null,
  providers: [],
};

export default function CompetitorsPage() {
  const { project } = useShell();
  const { can } = usePermissions();
  const projectKey = project?.project.key ?? '';

  const [filter, setFilter] = useState<CompetitorFilter>({ type: 'all' });
  const [search, setSearch] = useState('');
  const [tracking, setTracking] = useState(false);
  const [checkingId, setCheckingId] = useState<number | null>(null);

  const overviewQuery = useCompetitorOverviewQuery(projectKey);
  const competitorsQuery = useCompetitorsQuery(projectKey);
  const eventsQuery = useCompetitorEventsQuery(projectKey);
  const track = useTrackCompetitor(projectKey);
  const update = useUpdateCompetitor(projectKey);
  const untrack = useUntrackCompetitor(projectKey);
  const check = useCheckCompetitor(projectKey);
  const markRead = useMarkCompetitorEventsRead(projectKey);

  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const items = useMemo(() => competitorsQuery.data ?? [], [competitorsQuery.data]);
  const visible = useMemo(() => filterCompetitors(items, filter, search), [items, filter, search]);

  if (!project || competitorsQuery.isLoading || overviewQuery.isLoading) {
    return <Skeleton className="m-6 flex-1" />;
  }
  if (!can('competitors', 'read')) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
        You do not have access to Competitors.
      </div>
    );
  }

  const overview = overviewQuery.data ?? EMPTY_OVERVIEW;
  const canEdit = can('competitors', 'edit');

  const runCheck = (item: Competitor) => {
    setCheckingId(item.id);
    check.mutate(item.id, { onSettled: () => setCheckingId(null) });
  };

  return (
    <SectionPageView
      wide
      title="Competitors"
      description="The rival accounts you watch. Every one is checked on a schedule, and you are told when it posts, changes its profile, or its following moves."
      actions={
        <div className="flex items-center gap-3">
          <PageDateStamp
            updatedAt={
              mounted && competitorsQuery.dataUpdatedAt
                ? new Date(competitorsQuery.dataUpdatedAt)
                : null
            }
          />
          {can('competitors', 'create') && (
            <Button type="button" size="sm" onClick={() => setTracking(true)}>
              <Plus className="size-4" />
              Track account
            </Button>
          )}
        </div>
      }
    >
      <div className="space-y-6">
        <CompetitorSummaryCards overview={overview} />
        <CompetitorProvidersNotice providers={overview.providers} projectKey={projectKey} />

        <CompetitorFilters
          items={items}
          filter={filter}
          onFilterChange={setFilter}
          search={search}
          onSearchChange={setSearch}
        />

        <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
          <CompetitorList
            items={visible}
            hasAny={items.length > 0}
            canEdit={canEdit}
            canDelete={can('competitors', 'delete')}
            checkingId={checkingId}
            onCheck={runCheck}
            onToggleActive={(item) =>
              update.mutate({ competitorId: item.id, patch: { active: !item.active } })
            }
            onUntrack={(item) => untrack.mutate(item.id)}
          />

          <CompetitorAlertsCard
            events={eventsQuery.data ?? []}
            unread={overview.unread}
            canEdit={canEdit}
            onMarkRead={() => markRead.mutate()}
          />
        </div>
      </div>

      <CompetitorTrackDialog
        open={tracking}
        onOpenChange={setTracking}
        saving={track.isPending}
        providers={overview.providers}
        onSubmit={(input) => {
          track.mutate(input, { onSuccess: () => setTracking(false) });
        }}
      />
    </SectionPageView>
  );
}
