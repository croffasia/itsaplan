'use client';

import { useCallback } from 'react';
import { MessageSquareOff } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { AiAgent } from '@/lib/api';
import { AgentContextSize } from '@/components/common/agent-chat/AgentContextSize';
import { InputGroupButton } from '@/components/ui/input-group';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { AiChatSessionBadge } from '../shared/AiChatSessionBadge';
import { AiChatThread } from '../shared/AiChatThread';
import { ChatPanelAgentSwitcher } from './ChatPanelAgentSwitcher';
import { ChatPanelHistory } from './ChatPanelHistory';
import { useShownThread } from '../../hooks/useShownThread';
import type { ChatSession, ChatSessionState } from '../../hooks/useChatSessions';

// One open session of the chat panel. Every session is mounted, and the ones that are
// not shown are hidden rather than dropped: that is what keeps their transcript and
// their composer, and lets a reply run to the end while another session is on screen.
//
// The thread is keyed by the agent, so picking a different agent for a session starts a
// fresh conversation with it.
export function ChatPanelSession({
  projectKey,
  agents,
  agent,
  session,
  active,
  providerLabel,
  onThreadCreated,
  onStateChange,
  onSelectAgent,
  onSelectThread,
  onThreadDeleted,
}: {
  projectKey: string;
  agents: AiAgent[];
  agent: AiAgent;
  session: ChatSession;
  active: boolean;
  providerLabel: (key: string) => string;
  onThreadCreated: (sessionId: string, threadId: string) => void;
  onStateChange: (sessionId: string, state: ChatSessionState) => void;
  onSelectAgent: (session: ChatSession, agentId: number) => void;
  onSelectThread: (agentId: number, threadId: string) => void;
  onThreadDeleted: (threadId: string) => void;
}) {
  const handleThreadCreated = useCallback(
    (threadId: string) => onThreadCreated(session.id, threadId),
    [session.id, onThreadCreated],
  );
  const handleStateChange = useCallback(
    (state: ChatSessionState) => onStateChange(session.id, state),
    [session.id, onStateChange],
  );
  const thread = useShownThread(projectKey, agent.id, session.threadId);
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
        onStateChange={handleStateChange}
        composerStart={
          <>
            <ChatPanelAgentSwitcher
              agents={agents}
              selected={agent}
              providerLabel={providerLabel}
              disabled={session.running}
              onSelect={(agentId) => onSelectAgent(session, agentId)}
            />
            {keepsHistory ? (
              <ChatPanelHistory
                projectKey={projectKey}
                agentId={agent.id}
                agentName={agent.name}
                selectedThreadId={session.threadId}
                onSelect={(threadId) => onSelectThread(agent.id, threadId)}
                onDeleted={onThreadDeleted}
              />
            ) : (
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
          thread?.contextTokens !== undefined && <AgentContextSize tokens={thread.contextTokens} />
        }
      />
    </div>
  );
}
