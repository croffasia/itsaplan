'use client';

import { memo, useEffect } from 'react';
import { Plus } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useProjectAgents } from '@/hooks/useProjectAgents';
import ListColumn from '@/components/common/page/ListColumn';
import { Button } from '@/components/ui/button';
import { AiChatThreadSkeleton } from '../shared/AiChatThreadSkeleton';
import { ChatPanelEmpty } from './ChatPanelEmpty';
import { ChatPanelList } from './ChatPanelList';
import { ChatPanelSession } from './ChatPanelSession';
import { ChatPanelTitle } from './ChatPanelTitle';
import { useChatSessions } from '../../hooks/useChatSessions';

// The chat of the side panel: the row that says which conversation is open, and that
// conversation. In full screen the conversations stand in a column beside it. Memoised
// because resizing the panel re-renders it on every pointer move, and a render here
// reaches every transcript.
export const ChatPanelBody = memo(function ChatPanelBody({
  projectKey,
  wide,
  newChatAgentId,
  onNewChatHandled,
}: {
  projectKey: string;
  wide: boolean;
  newChatAgentId: number | null;
  onNewChatHandled: () => void;
}) {
  const t = useTranslations('aiChat');
  const agentsQuery = useProjectAgents();
  const agents = agentsQuery.data ?? [];
  // Only these are offered; `agents` stays whole so a session already open on a disabled
  // one keeps its transcript.
  const chatAgents = agents.filter((agent) => agent.chatEnabled);
  const chats = useChatSessions(
    projectKey,
    chatAgents.map((agent) => agent.id),
  );
  const { sessions, active, newChat } = chats;
  const works = (agentId: number) => agents.some((agent) => agent.id === agentId);

  // A page asked for a chat with one agent. The agents come after the page, so it is kept
  // until they are there.
  useEffect(() => {
    if (newChatAgentId == null || agentsQuery.isLoading) return;
    newChat(newChatAgentId);
    onNewChatHandled();
    // Once per request: newChat changes with every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [newChatAgentId, agentsQuery.isLoading, onNewChatHandled]);

  // The kept conversation may be with an agent that has left the project since.
  const lost = agentsQuery.isSuccess && active != null && !works(active.agentId);
  useEffect(() => {
    if (lost) newChat();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lost]);

  if (agentsQuery.isLoading) {
    return (
      <div className="min-h-0 flex-1">
        <AiChatThreadSkeleton />
      </div>
    );
  }

  // Nothing to chat with: no agent works here at all, or every one of them has chat
  // turned off and there is no already-open session left to show instead.
  if (chatAgents.length === 0 && !sessions.some((session) => works(session.agentId))) {
    return (
      <div className="min-h-0 flex-1">
        <ChatPanelEmpty projectKey={projectKey} />
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1">
      {wide && (
        <ListColumn
          storageKey="aiChat:list:width"
          minWidth={360}
          resizeLabel={t('resizeList')}
          className="bg-rail"
        >
          <ChatPanelList projectKey={projectKey} agents={agents} chats={chats}>
            <Button variant="secondary" onClick={() => newChat()}>
              <Plus />
              {t('newChat')}
            </Button>
          </ChatPanelList>
        </ListColumn>
      )}

      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        {active && (
          <ChatPanelTitle
            projectKey={projectKey}
            agents={agents}
            chats={chats}
            active={active}
            wide={wide}
          />
        )}
        <div className="relative min-h-0 flex-1">
          {sessions.map((session) => {
            const agent = agents.find((candidate) => candidate.id === session.agentId);
            if (!agent) return null;
            return (
              <ChatPanelSession
                key={session.id}
                projectKey={projectKey}
                agents={chatAgents}
                agent={agent}
                session={session}
                active={session.id === active?.id}
                onThreadCreated={chats.setThread}
                onThreadMissing={chats.dropThread}
                onStateChange={chats.setState}
                onSelectAgent={chats.pickAgent}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
});
