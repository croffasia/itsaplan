import { BookOpen, Sparkles, Wrench, Zap } from 'lucide-react';
import type { AiAgent } from '@/lib/api/endpoints/agents';
import { AgentMetaChip } from './AgentMetaChip';
import { useTranslations } from 'next-intl';

// The configuration chips for an internal agent: its model and provider, and the counts
// of granted actions, configured tools, and enabled skills. `providerLabel` maps the
// provider key to a readable label from the integration catalog.
export function AgentMetaRow({
  agent,
  providerLabel,
}: {
  agent: AiAgent;
  providerLabel: (key: string) => string;
}) {
  const t = useTranslations('teams.agents');
  const model = agent.model
    ? `${agent.model}${agent.modelProvider ? ` · ${providerLabel(agent.modelProvider)}` : ''}`
    : t('noModel');

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <AgentMetaChip icon={Sparkles}>{model}</AgentMetaChip>
      <AgentMetaChip icon={Zap} label={t('actionCount', { count: agent.actionCount })}>
        {agent.actionCount}
      </AgentMetaChip>
      <AgentMetaChip icon={Wrench} label={t('toolCount', { count: agent.toolCount })}>
        {agent.toolCount}
      </AgentMetaChip>
      <AgentMetaChip icon={BookOpen} label={t('skillCount', { count: agent.skillCount })}>
        {agent.skillCount}
      </AgentMetaChip>
    </div>
  );
}
