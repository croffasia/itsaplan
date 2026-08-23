'use client';

import { useState } from 'react';
import { useAiAgentsQuery } from '@/services/aiAgents.service';
import { AiChatHistory } from '../shared/AiChatHistory';
import { AiChatThreadSkeleton } from '../shared/AiChatThreadSkeleton';
import { ChatPanelEmpty } from './ChatPanelEmpty';
import { ChatPanelSession } from './ChatPanelSession';
import { ChatPanelTabs } from './ChatPanelTabs';
import { useChatSessions, type ChatSession } from '../../hooks/useChatSessions';
import { useProviderLabel } from '../../hooks/useProviderLabel';

// What the chat panel holds under its header: the open sessions, the tab row over them,
// and the history of the session in front.
export function ChatPanelBody({ projectKey }: { projectKey: string }) {
  const agentsQuery = useAiAgentsQuery(projectKey);
  const agents = agentsQuery.data ?? [];
  const providerLabel = useProviderLabel(projectKey);
  const {
    sessions,
    active,
    setActive,
    newTab,
    openTab,
    openThread,
    closeSession,
    setThread,
    setAgent,
    setState,
  } = useChatSessions(projectKey, agents[0]?.id ?? null);
  const [historyOpen, setHistoryOpen] = useState(false);

  // A session that has said nothing changes its agent in place; one with a transcript
  // keeps it, and the other agent is chatted with in a tab of its own.
  const selectAgent = (session: ChatSession, agentId: number) => {
    if (agentId === session.agentId) return;
    if (session.hasMessages) openTab(agentId);
    else setAgent(session.id, agentId);
  };

  // A conversation that is deleted from the history cannot be shown any more.
  const handleThreadDeleted = (threadId: string) => {
    const session = sessions.find((candidate) => candidate.threadId === threadId);
    if (session) closeSession(session.id);
  };

  if (agentsQuery.isLoading) {
    return (
      <div className="min-h-0 flex-1">
        <AiChatThreadSkeleton />
      </div>
    );
  }

  if (agents.length === 0) {
    return (
      <div className="min-h-0 flex-1">
        <ChatPanelEmpty projectKey={projectKey} />
      </div>
    );
  }

  return (
    <>
      <ChatPanelTabs
        projectKey={projectKey}
        sessions={sessions}
        activeId={active?.id ?? null}
        onSelect={setActive}
        onClose={closeSession}
        onNewTab={newTab}
        onShowHistory={() => setHistoryOpen(true)}
      />

      <div className="relative min-h-0 flex-1">
        {sessions.map((session) => {
          const agent = agents.find((candidate) => candidate.id === session.agentId);
          if (!agent) return null;
          return (
            <ChatPanelSession
              key={session.id}
              projectKey={projectKey}
              agents={agents}
              agent={agent}
              session={session}
              active={session.id === active?.id}
              providerLabel={providerLabel}
              onThreadCreated={setThread}
              onStateChange={setState}
              onSelectAgent={selectAgent}
            />
          );
        })}

        {historyOpen && active && (
          <div className="absolute inset-0 z-10 bg-background">
            <AiChatHistory
              projectKey={projectKey}
              agentId={active.agentId}
              selectedThreadId={active.threadId}
              onSelect={(threadId) => {
                openThread(active.agentId, threadId);
                setHistoryOpen(false);
              }}
              onDeleted={handleThreadDeleted}
              onBack={() => setHistoryOpen(false)}
            />
          </div>
        )}
      </div>
    </>
  );
}
