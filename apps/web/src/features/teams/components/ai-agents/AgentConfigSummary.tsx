import { useTranslations } from 'next-intl';
import type { AiAgent } from '@/lib/api/endpoints/agents';
import { AgentRunnerStatus } from '@/components/common/agent-chat/AgentRunnerStatus';

// What an agent runs on, in two lines: an internal agent's model and what it can use, an
// external agent's connection and the start of its key.
export function AgentConfigSummary({
  agent,
  providerLabel,
}: {
  agent: AiAgent;
  providerLabel: (key: string) => string;
}) {
  const t = useTranslations('teams.agents');

  if (agent.kind === 'external') {
    return (
      <div className="flex min-w-0 flex-col items-start gap-1">
        <AgentRunnerStatus agent={agent} />
        {agent.apiKeyStart && (
          <span className="truncate text-xs text-muted-foreground">
            {t('apiKeyValue', { start: agent.apiKeyStart })}
          </span>
        )}
      </div>
    );
  }

  return (
    <div className="flex min-w-0 flex-col gap-0.5">
      <span className="truncate text-sm">
        {agent.model ? (
          <span dir="ltr">{agent.model}</span>
        ) : (
          <span className="text-muted-foreground">{t('noModel')}</span>
        )}
        {agent.modelProvider && (
          <span className="text-muted-foreground"> · {providerLabel(agent.modelProvider)}</span>
        )}
      </span>
      <span className="truncate text-xs text-muted-foreground">
        {t('actionCount', { count: agent.actionCount })} ·{' '}
        {t('toolCount', { count: agent.toolCount })} ·{' '}
        {t('skillCount', { count: agent.skillCount })}
      </span>
    </div>
  );
}
