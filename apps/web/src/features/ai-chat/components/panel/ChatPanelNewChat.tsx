import { Check } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { AiAgent } from '@/lib/api/endpoints/agents';
import { cn } from '@/lib/utils';
import AgentTile from '@/components/common/agent-chat/AgentTile';
import { AgentRunnerStatus } from '@/components/common/agent-chat/AgentRunnerStatus';
import { useProviderLabel } from '../../hooks/useProviderLabel';
import { agentModelLabel } from '../../utils/agentModelLabel';

// What stands over the composer of a chat nothing was said in: the agent it is with, and
// the others to pick from.
export function ChatPanelNewChat({
  agents,
  selected,
  onSelect,
}: {
  agents: AiAgent[];
  selected: AiAgent;
  onSelect: (agentId: number) => void;
}) {
  const t = useTranslations('aiChat');
  const tChat = useTranslations('common.agentChat');
  const providerLabel = useProviderLabel();

  return (
    <div className="flex h-full flex-col overflow-y-auto">
      <div className="mx-auto mt-auto w-full max-w-3xl px-5 py-6">
        <h3 className="text-xl font-semibold text-balance">
          {tChat('title', { agent: selected.name })}
        </h3>
        {agents.length > 1 && (
          <>
            <p className="mt-2 text-sm text-muted-foreground">{t('newChatHint')}</p>
            <div className="-mx-2 mt-4 flex flex-col gap-1">
              {agents.map((agent) => {
                const picked = agent.id === selected.id;
                return (
                  <button
                    key={agent.id}
                    type="button"
                    aria-pressed={picked}
                    onClick={() => onSelect(agent.id)}
                    className={cn(
                      'flex w-full items-center gap-3 rounded-lg p-2 text-start transition-colors',
                      picked ? 'bg-accent' : 'hover:bg-accent/60',
                    )}
                  >
                    <AgentTile size="lg" className={cn(picked && 'bg-background')} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{agent.name}</span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {agent.kind === 'external' ? (
                          <AgentRunnerStatus agent={agent} compact />
                        ) : (
                          agentModelLabel(agent, providerLabel, t('noModel'))
                        )}
                      </span>
                    </span>
                    {picked && <Check className="size-4 shrink-0" />}
                  </button>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
