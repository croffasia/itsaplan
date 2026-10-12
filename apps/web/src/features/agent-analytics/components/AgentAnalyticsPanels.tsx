import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';
import type { AgentAnalytics } from '@/lib/api/endpoints/agentAnalytics';
import StatCards from './StatCards';
import TokensOverTime from './TokensOverTime';
import ModelUsage from './ModelUsage';
import UsageBreakdown from './UsageBreakdown';

// The panels of one window of the dashboard. With `onSelectProject` a project of the
// breakdown narrows the dashboard to it; `byTeam` compares the teams, for a dashboard
// over several. `pricesHref` is where the reader sets the prices of the models the cost
// leaves out, for one who may.
export default function AgentAnalyticsPanels({
  data,
  onSelectProject,
  byTeam = false,
  pricesHref,
}: {
  data: AgentAnalytics;
  onSelectProject?: (projectId: number) => void;
  byTeam?: boolean;
  pricesHref?: string | null;
}) {
  const t = useTranslations('agentAnalytics');

  return (
    <div className="space-y-6">
      <StatCards data={data} pricesHref={pricesHref} />
      <div className="grid gap-4 xl:grid-cols-2">
        <TokensOverTime data={data} />
        <ModelUsage data={data} />
      </div>
      <div className={cn('grid gap-4', byTeam ? 'xl:grid-cols-3' : 'xl:grid-cols-2')}>
        {byTeam && (
          <UsageBreakdown
            title={t('byTeam.title')}
            description={t('byTeam.description')}
            empty={t('byTeam.empty')}
            items={data.teams.map((team) => ({
              ...team,
              key: String(team.teamId),
              label: team.name,
            }))}
            total={data.totals}
          />
        )}
        <UsageBreakdown
          title={t('byAgent.title')}
          description={t('byAgent.description')}
          empty={t('byAgent.empty')}
          items={data.agents.map((agent) => ({
            ...agent,
            key: String(agent.agentId),
            label: agent.name || t('deletedAgent'),
          }))}
          total={data.totals}
        />
        <UsageBreakdown
          title={t('byProject.title')}
          description={t('byProject.description')}
          empty={t('byProject.empty')}
          items={data.projects.map((project) => ({
            ...project,
            key: String(project.projectId),
            label: project.name || t('deletedProject'),
          }))}
          total={data.totals}
          onSelect={onSelectProject && ((key) => onSelectProject(Number(key)))}
        />
      </div>
    </div>
  );
}
