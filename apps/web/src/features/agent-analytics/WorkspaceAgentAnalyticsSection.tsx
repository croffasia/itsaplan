'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { AgentAnalyticsExtras } from '@/cloud';
import { useWorkspaceAgentAnalyticsQuery } from '@/services/agentAnalytics.service';
import { workspacePath } from '@/utils/paths';
import SectionPageView from '@/components/common/page/SectionPageView';
import FilterChips from '@/components/common/filters/FilterChips';
import FilterMenu from '@/components/common/filters/FilterMenu';
import { Skeleton } from '@/components/ui/skeleton';
import AgentAnalyticsPanels from './components/AgentAnalyticsPanels';
import RetentionHint from './components/RetentionHint';
import { DEFAULT_DAYS, usePeriodFilter } from './hooks/usePeriodFilter';

// What the agents of every team of the workspace spent, with the teams compared. Its
// owner and its admins read it, over every project.
export default function WorkspaceAgentAnalyticsSection({ workspaceId }: { workspaceId: number }) {
  const t = useTranslations('teams.workspace.agentUsage');
  const [days, setDays] = useState(DEFAULT_DAYS);
  const { data } = useWorkspaceAgentAnalyticsQuery(workspaceId, days);
  const filters = [usePeriodFilter(days)];
  const onFilterChange = (_key: string, selected: string[]) => setDays(Number(selected[0]));

  return (
    <SectionPageView
      title={t('title')}
      description={
        <>
          {t('description')} <RetentionHint />
        </>
      }
      wide
      actions={<FilterMenu sections={filters} onChange={onFilterChange} />}
    >
      {data ? (
        <div className="space-y-6">
          <FilterChips sections={filters} onChange={onFilterChange} />
          <AgentAnalyticsPanels
            data={data}
            byTeam
            pricesHref={workspacePath(workspaceId, 'model-prices')}
          />
          <AgentAnalyticsExtras scope={{ workspaceId }} days={days} />
        </div>
      ) : (
        <div className="space-y-6">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      )}
    </SectionPageView>
  );
}
