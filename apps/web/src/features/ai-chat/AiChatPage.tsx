'use client';

import Link from 'next/link';
import { MessageSquarePlus, Settings2 } from 'lucide-react';
import { useShell } from '@/context/shellContext';
import { usePermissions } from '@/hooks/usePermissions';
import { aiAgentsPath } from '@/utils/paths';
import { useChatDashboardSummaryQuery } from '@/services/aiAgents.service';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import SectionPageView from '@/components/common/page/SectionPageView';
import { EmptyState } from '@/components/common/page/EmptyState';
import { AiChatDashboardSummary } from './components/page/AiChatDashboardSummary';
import { AiChatInboxPanel } from './components/page/AiChatInboxPanel';
import { AiChatSelectedConversation } from './components/page/AiChatSelectedConversation';
import { useHermesChatSelection } from './hooks/useHermesChatSelection';

export default function AiChatPage() {
  const { project } = useShell();
  const { can } = usePermissions();
  const projectKey = project?.project.key ?? null;
  const summaryQuery = useChatDashboardSummaryQuery(projectKey);
  const chat = useHermesChatSelection(projectKey);

  if (!project) return null;

  if (!can('ai_agents', 'read')) {
    return (
      <div className="flex h-full items-center justify-center px-4 text-center text-sm text-muted-foreground">
        You do not have access to AI agents in this project.
      </div>
    );
  }

  if (chat.isLoading) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
        Loading…
      </div>
    );
  }

  if (chat.agents.length === 0) {
    return (
      <div className="flex h-full">
        <EmptyState
          title="Bob is not connected"
          description="Configure the approved Bob agent and the server-side Hermes connection."
        >
          {can('ai_agents', 'edit') && (
            <Button asChild size="sm">
              <Link href={aiAgentsPath(project.project.key)}>Create an agent</Link>
            </Button>
          )}
        </EmptyState>
      </div>
    );
  }

  let summary = <Skeleton className="h-[21rem] rounded-2xl" />;
  if (summaryQuery.data) {
    summary = <AiChatDashboardSummary summary={summaryQuery.data} agents={chat.hermesAgents} />;
  } else if (summaryQuery.isError) {
    summary = (
      <div className="flex h-[21rem] flex-col items-center justify-center gap-3 rounded-2xl border bg-card text-center">
        <p className="text-sm font-medium">Chat activity could not be loaded.</p>
        <Button size="sm" variant="outline" onClick={() => summaryQuery.refetch()}>
          Try again
        </Button>
      </div>
    );
  }

  return (
    <SectionPageView
      title="Chats"
      description="Your assistant conversations, response activity, and connected clients in one inbox."
      actions={
        <>
          <Button asChild size="sm" variant="outline">
            <Link href={aiAgentsPath(project.project.key)}>
              <Settings2 />
              Manage agents
            </Link>
          </Button>
          <Button
            size="sm"
            disabled={chat.selected == null || chat.selectedStatus !== 'ready' || chat.isCreating}
            onClick={() => void chat.startNewChat()}
          >
            <MessageSquarePlus />
            New chat
          </Button>
        </>
      }
      wide
    >
      <div className="space-y-5 pb-4">
        {summary}

        <div className="grid min-h-[38rem] gap-4 lg:grid-cols-[20rem_minmax(0,1fr)]">
          <AiChatInboxPanel
            projectKey={project.project.key}
            agents={chat.agents}
            selected={chat.selected}
            selectedThreadId={chat.selectedConversationId}
            onSelectAgent={chat.selectAgent}
            onSelectThread={chat.selectConversation}
            onDeleted={chat.clearConversation}
            hermesAgents={chat.hermesAgents}
            conversations={chat.conversations}
            conversationsLoading={chat.conversationsLoading}
          />

          <AiChatSelectedConversation
            projectKey={project.project.key}
            agent={chat.selected}
            conversationId={chat.selectedConversationId}
          />
        </div>
      </div>
    </SectionPageView>
  );
}
