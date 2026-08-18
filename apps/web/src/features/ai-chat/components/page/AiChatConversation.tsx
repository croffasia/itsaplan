'use client';

import { Bot } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { AiAgent } from '@/lib/api';
import { Badge } from '@/components/ui/badge';
import { AgentRunnerStatus } from '@/components/common/agent-chat/AgentRunnerStatus';
import { AiChatThread } from '../shared/AiChatThread';
import { AiChatSessionBadge } from '../shared/AiChatSessionBadge';
import { useThreadSessionId } from '../../hooks/useThreadSessionId';
import { agentModelLabel } from '../../utils/agentModelLabel';

// One agent's conversation on the AI Chat page: a header identifying the agent, and the
// transcript plus composer below it.
export function AiChatConversation({
  projectKey,
  agent,
  providerLabel,
  threadId,
  onThreadCreated,
}: {
  projectKey: string;
  agent: AiAgent;
  providerLabel: (key: string) => string;
  threadId: string | null;
  onThreadCreated: (threadId: string) => void;
}) {
  const t = useTranslations('aiChat');
  const sessionId = useThreadSessionId(projectKey, agent.id, threadId);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center gap-3 border-b px-5 py-3">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Bot className="size-4.5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate text-sm font-medium">{agent.name}</span>
            {/* Memory is a setting of the built-in runtime. An external agent's memory is
                its runner's session, whose id the header shows instead. */}
            {agent.kind === 'internal' && !agent.memoryEnabled && (
              <Badge variant="secondary" className="shrink-0">
                {t('memoryOff')}
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-1.5 truncate text-xs text-muted-foreground">
            <span className="truncate">@{agent.username}</span>
            <span aria-hidden>·</span>
            {agent.kind === 'external' ? (
              <AgentRunnerStatus agent={agent} compact />
            ) : (
              <span className="truncate">
                {agentModelLabel(agent, providerLabel, t('noModel'))}
              </span>
            )}
          </div>
        </div>
        {sessionId && <AiChatSessionBadge sessionId={sessionId} />}
      </div>

      <div className="min-h-0 flex-1">
        <AiChatThread
          projectKey={projectKey}
          agent={agent}
          threadId={threadId}
          onThreadCreated={onThreadCreated}
        />
      </div>
    </div>
  );
}
