'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { AgentAnalyticsExtras } from '@/cloud';
import { useWorkspaceAgentAnalyticsQuery } from '@/services/agentAnalytics.service';
import { workspacePath } from '@/utils/paths';
import SectionPageView from '@/components/common/page/SectionPageView';
import { Skeleton } from '@/components/ui/skeleton';
import AgentAnalyticsPanels from './components/AgentAnalyticsPanels';
import RetentionHint from './components/RetentionHint';
import WindowSelect from './components/WindowSelect';

// What the agents of every team of the workspace spent, with the teams compared. Its
// owner and its admins read it, over every project.
export default function WorkspaceAgentAnalyticsSection({ workspaceId }: { workspaceId: number }) {
  const t = useTranslations('teams.workspace.agentUsage');
  const [days, setDays] = useState(30);
  const { data } = useWorkspaceAgentAnalyticsQuery(workspaceId, days);

  return (
    <SectionPageView
      title={t('title')}
      description={
        <>
          {t('description')} <RetentionHint />
        </>
      }
      wide
      actions={<WindowSelect value={days} onChange={setDays} />}
    >
      {data ? (
        <div className="space-y-6">
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
