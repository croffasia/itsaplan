'use client';

import { useCallback } from 'react';
import type { AiAgent } from '@/lib/api';
import { cn } from '@/lib/utils';
import { AiChatThread } from '../shared/AiChatThread';
import type { ChatSession } from '../../hooks/useChatSessions';

// One open session of the chat panel. Every session is mounted, and the ones that are
// not shown are hidden rather than dropped: that is what keeps their transcript and
// their composer, and lets a reply run to the end while another session is on screen.
//
// The thread is keyed by the agent, so picking a different agent for a session starts a
// fresh conversation with it.
export function ChatPanelSession({
  projectKey,
  agent,
  session,
  active,
  onThreadCreated,
  onRunningChange,
}: {
  projectKey: string;
  agent: AiAgent;
  session: ChatSession;
  active: boolean;
  onThreadCreated: (sessionId: string, threadId: string) => void;
  onRunningChange: (sessionId: string, running: boolean) => void;
}) {
  const handleThreadCreated = useCallback(
    (threadId: string) => onThreadCreated(session.id, threadId),
    [session.id, onThreadCreated],
  );
  const handleRunningChange = useCallback(
    (running: boolean) => onRunningChange(session.id, running),
    [session.id, onRunningChange],
  );

  return (
    <div className={cn('absolute inset-0', !active && 'hidden')}>
      <AiChatThread
        key={agent.id}
        projectKey={projectKey}
        agent={agent}
        threadId={session.threadId}
        onThreadCreated={handleThreadCreated}
        onRunningChange={handleRunningChange}
      />
    </div>
  );
}
