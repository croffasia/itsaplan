'use client';

import { useCallback } from 'react';
import type { AiAgent } from '@/lib/api';
import { cn } from '@/lib/utils';
import { AiChatThread } from '../shared/AiChatThread';
import { ChatPanelAgentSwitcher } from './ChatPanelAgentSwitcher';
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
}) {
  const handleThreadCreated = useCallback(
    (threadId: string) => onThreadCreated(session.id, threadId),
    [session.id, onThreadCreated],
  );
  const handleStateChange = useCallback(
    (state: ChatSessionState) => onStateChange(session.id, state),
    [session.id, onStateChange],
  );

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
          <ChatPanelAgentSwitcher
            agents={agents}
            selected={agent}
            providerLabel={providerLabel}
            disabled={session.running}
            onSelect={(agentId) => onSelectAgent(session, agentId)}
          />
        }
      />
    </div>
  );
}
