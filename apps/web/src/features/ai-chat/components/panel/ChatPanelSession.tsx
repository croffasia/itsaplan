'use client';

import { useCallback } from 'react';
import { MessageSquareOff } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { AiAgent } from '@/lib/api/endpoints/agents';
import { AgentContextSize } from '@/components/common/agent-chat/AgentContextSize';
import { InputGroupButton } from '@/components/ui/input-group';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { AiChatSessionBadge } from '../shared/AiChatSessionBadge';
import { AiChatThread } from '../shared/AiChatThread';
import { ChatPanelAgentSwitcher } from './ChatPanelAgentSwitcher';
import { ChatPanelNewChat } from './ChatPanelNewChat';
import { useShownThread } from '../../hooks/useShownThread';
import { useProviderLabel } from '../../hooks/useProviderLabel';
import type { ChatSession, ChatSessionState } from '../../hooks/useChatSessions';

// One session of the chat. Every session is mounted, and the ones that are not shown are
// hidden rather than dropped: that is what keeps their transcript and their composer, and
// lets a reply run to the end while another session is on screen.
//
// The thread is keyed by the agent, so picking a different agent for a session starts a
// fresh conversation with it.
export function ChatPanelSession({
  projectKey,
  agents,
  agent,
  session,
  active,
  onThreadCreated,
  onThreadMissing,
  onStateChange,
  onSelectAgent,
}: {
  projectKey: string;
  // The agents offered by the switcher: chat-enabled only, so `agent` (the session's
  // own, possibly chat-disabled) need not be among them.
  agents: AiAgent[];
  agent: AiAgent;
  session: ChatSession;
  active: boolean;
  onThreadCreated: (sessionId: string, threadId: string) => void;
  onThreadMissing: (threadId: string) => void;
  onStateChange: (sessionId: string, state: ChatSessionState) => void;
  onSelectAgent: (session: ChatSession, agentId: number) => void;
}) {
  const handleThreadCreated = useCallback(
    (threadId: string) => onThreadCreated(session.id, threadId),
    [session.id, onThreadCreated],
  );
  const handleStateChange = useCallback(
    (state: ChatSessionState) => onStateChange(session.id, state),
    [session.id, onStateChange],
  );
  const thread = useShownThread(projectKey, session.threadId);
  const providerLabel = useProviderLabel();
  const t = useTranslations('aiChat');
  // An internal agent with memory off stores no thread and no message, so it has no
  // history to list and its conversation ends with the page.
  const keepsHistory = agent.kind === 'external' || agent.memoryEnabled;

  return (
    <div className={cn('absolute inset-0', !active && 'hidden')}>
      <AiChatThread
        key={agent.id}
        projectKey={projectKey}
        agent={agent}
        threadId={session.threadId}
        onThreadCreated={handleThreadCreated}
        onThreadMissing={onThreadMissing}
        onStateChange={handleStateChange}
        empty={
          <ChatPanelNewChat
            agents={agents}
            selected={agent}
            onSelect={(agentId) => onSelectAgent(session, agentId)}
          />
        }
        composerStart={
          <>
            <ChatPanelAgentSwitcher
              agents={agents}
              selected={agent}
              providerLabel={providerLabel}
              disabled={session.running}
              onSelect={(agentId) => onSelectAgent(session, agentId)}
            />
            {!keepsHistory && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <InputGroupButton
                    type="button"
                    variant="ghost"
                    size="icon-xs"
                    className="rounded-md text-muted-foreground"
                  >
                    <MessageSquareOff />
                    <span className="sr-only">{t('noHistory')}</span>
                  </InputGroupButton>
                </TooltipTrigger>
                <TooltipContent className="max-w-56">{t('noHistory')}</TooltipContent>
              </Tooltip>
            )}
            {thread?.cliSessionId && <AiChatSessionBadge sessionId={thread.cliSessionId} />}
          </>
        }
        composerEnd={
          thread?.contextTokens !== undefined && (
            <span className="px-1.5">
              <AgentContextSize tokens={thread.contextTokens} withUnit />
            </span>
          )
        }
      />
    </div>
  );
}
