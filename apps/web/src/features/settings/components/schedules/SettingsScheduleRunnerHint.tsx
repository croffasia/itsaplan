import { Terminal } from 'lucide-react';
import { AgentRunnerStatus } from '@/components/common/agent-chat/AgentRunnerStatus';
import { usePermissions } from '@/hooks/usePermissions';
import { useProjectAgents } from '@/hooks/useProjectAgents';
import { useTranslations } from 'next-intl';

// The state of an external agent's runner is part of its configuration, so only a reader of
// the agents gets it.
export function SettingsScheduleRunnerHint({ agentId }: { agentId: number }) {
  const t = useTranslations('settings.schedules');
  const { can } = usePermissions();
  const agents = useProjectAgents(can('ai_agents', 'read'));
  const agent = agents.data?.find((one) => one.id === agentId);
  if (!agent || agent.invocationUrl) return null;
  return (
    <div className="flex items-start gap-2.5 rounded-md border border-border/60 bg-muted/30 px-3 py-2.5">
      <Terminal className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
      <div className="min-w-0 flex-1 space-y-1">
        <p className="text-xs text-muted-foreground">{t('externalAgentHint')}</p>
        <AgentRunnerStatus agent={agent} />
      </div>
    </div>
  );
}
