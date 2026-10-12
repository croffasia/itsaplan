'use client';

import { useState, type ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import { AgentAnalyticsExtras } from '@/cloud';
import { useTeam, useTeamQuery } from '@/services/teams.service';
import { useTeamAgentAnalyticsQuery } from '@/services/agentAnalytics.service';
import { useWorkspacesQuery } from '@/services/workspaces.service';
import { workspacePath } from '@/utils/paths';
import SectionPageView from '@/components/common/page/SectionPageView';
import { Skeleton } from '@/components/ui/skeleton';
import AgentAnalyticsPanels from './components/AgentAnalyticsPanels';
import ProjectSelect from './components/ProjectSelect';
import RetentionHint from './components/RetentionHint';
import WindowSelect from './components/WindowSelect';

// What the team's agents spent. Its owner and managers read every project of the team;
// anyone else the projects where their role grants agent_usage, which the api
// narrows the figures to. Any one of those projects narrows the page further, picked
// in the header or from the breakdown by project.
export default function TeamAgentAnalyticsSection({ teamId }: { teamId: number }) {
  const t = useTranslations('teams.sections.analytics');
  const tCommon = useTranslations('common');
  const team = useTeam(teamId);
  const permissions = useTeamQuery(teamId).data?.permissions;
  const runsTeam = team?.role === 'owner' || team?.role === 'manager';
  // The prices are the workspace's, set by its owner and its admins.
  const workspace = useWorkspacesQuery().data?.find((entry) => entry.id === team?.workspaceId);
  const pricesHref = workspace?.role ? workspacePath(workspace.id, 'model-prices') : null;
  const canRead = runsTeam || permissions?.agent_usage.read === true;
  const [days, setDays] = useState(30);
  const [projectId, setProjectId] = useState<number | null>(null);
  const { data } = useTeamAgentAnalyticsQuery(canRead ? teamId : null, days, projectId);
  // One project to read is no choice to make.
  const projects = data && data.readableProjects.length > 1 ? data.readableProjects : null;

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
        <AgentAnalyticsPanels
          data={data}
          onSelectProject={projects && projectId == null ? setProjectId : undefined}
          pricesHref={pricesHref}
        />
        <AgentAnalyticsExtras scope={{ teamId, projectId }} days={days} />
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
      actions={
        canRead ? (
          <>
            {projects && (
              <ProjectSelect projects={projects} value={projectId} onChange={setProjectId} />
            )}
            <WindowSelect value={days} onChange={setDays} />
          </>
        ) : undefined
      }
    >
      {content}
    </SectionPageView>
  );
}
