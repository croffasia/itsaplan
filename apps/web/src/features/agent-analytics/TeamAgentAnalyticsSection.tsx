'use client';

import { useState, type ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import { AgentAnalyticsExtras } from '@/cloud';
import { useTeam, useTeamQuery } from '@/services/teams.service';
import { useTeamAgentAnalyticsQuery } from '@/services/agentAnalytics.service';
import { useWorkspacesQuery } from '@/services/workspaces.service';
import { workspacePath } from '@/utils/paths';
import SectionPageView from '@/components/common/page/SectionPageView';
import FilterChips from '@/components/common/filters/FilterChips';
import FilterMenu, { type FilterSection } from '@/components/common/filters/FilterMenu';
import { Skeleton } from '@/components/ui/skeleton';
import AgentAnalyticsPanels from './components/AgentAnalyticsPanels';
import RetentionHint from './components/RetentionHint';
import { DEFAULT_DAYS, usePeriodFilter } from './hooks/usePeriodFilter';

// What the team's agents spent. Its owner and managers read every project of the team;
// anyone else the projects where their role grants agent_usage, which the api
// narrows the figures to. Some of those projects narrow the page further, ticked in the
// filter or picked from the breakdown by project.
export default function TeamAgentAnalyticsSection({ teamId }: { teamId: number }) {
  const t = useTranslations('teams.sections.analytics');
  const tAnalytics = useTranslations('agentAnalytics');
  const tCommon = useTranslations('common');
  const team = useTeam(teamId);
  const permissions = useTeamQuery(teamId).data?.permissions;
  const runsTeam = team?.role === 'owner' || team?.role === 'manager';
  // The prices are the workspace's, set by its owner and its admins.
  const workspace = useWorkspacesQuery().data?.find((entry) => entry.id === team?.workspaceId);
  const pricesHref = workspace?.role ? workspacePath(workspace.id, 'model-prices') : null;
  const canRead = runsTeam || permissions?.agent_usage.read === true;
  const [days, setDays] = useState(DEFAULT_DAYS);
  const [projectIds, setProjectIds] = useState<number[]>([]);
  const { data } = useTeamAgentAnalyticsQuery(canRead ? teamId : null, days, projectIds);
  // One project to read is no choice to make.
  const projects = data && data.readableProjects.length > 1 ? data.readableProjects : null;
  const period = usePeriodFilter(days);
  const filters: FilterSection[] = projects
    ? [
        period,
        {
          key: 'projects',
          label: tAnalytics('projects'),
          options: projects.map((p) => ({ value: String(p.projectId), label: p.name })),
          selected: projectIds.map(String),
        },
      ]
    : [period];
  const onFilterChange = (key: string, selected: string[]) =>
    key === period.key ? setDays(Number(selected[0])) : setProjectIds(selected.map(Number));

  let content: ReactNode;
  if (!team || (!runsTeam && !permissions)) {
    content = <Skeleton className="h-72 w-full" />;
  } else if (!canRead) {
    content = <p className="text-sm text-muted-foreground">{tCommon('noSectionAccess')}</p>;
  } else if (!data) {
    content = (
      <div className="space-y-6">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  } else {
    content = (
      <div className="space-y-6">
        <FilterChips sections={filters} onChange={onFilterChange} />
        <AgentAnalyticsPanels
          data={data}
          onSelectProject={
            projects && projectIds.length === 0 ? (id) => setProjectIds([id]) : undefined
          }
          pricesHref={pricesHref}
        />
        <AgentAnalyticsExtras scope={{ teamId, projectIds }} days={days} />
      </div>
    );
  }

  return (
    <SectionPageView
      title={t('title')}
      description={
        <>
          {t('description')} <RetentionHint />
        </>
      }
      wide
      actions={canRead ? <FilterMenu sections={filters} onChange={onFilterChange} /> : undefined}
    >
      {content}
    </SectionPageView>
  );
}
