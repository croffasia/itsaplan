'use client';

import Link from 'next/link';
import { Bot } from 'lucide-react';
import { useShell } from '@/context/shellContext';
import { usePermissions } from '@/hooks/usePermissions';
import { aiAgentsPath } from '@/utils/paths';
import { Button } from '@/components/ui/button';
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty';
import { AiChatAgentRail } from './components/page/AiChatAgentRail';
import { AiChatThreadRail } from './components/page/AiChatThreadRail';
import { AiChatConversation } from './components/page/AiChatConversation';
import { useAiChatSelection } from './hooks/useAiChatSelection';

// The AI Chat page (/project/:projectKey/ai-team/chat): a full-page chat with the
// project's internal agents.
export default function AiChatPage() {
  const { project } = useShell();
  const { can } = usePermissions();
  const {
    agents,
    isLoading,
    providerLabel,
    selected,
    selectedThreadId,
    newChatNonce,
    selectAgent,
    selectThread,
    startNewChat,
    handleThreadCreated,
  } = useAiChatSelection(project?.project.key ?? null);

  if (!project) return null;

  if (!can('ai_agents', 'read')) {
    return (
      <div className="flex h-full items-center justify-center px-4 text-center text-sm text-muted-foreground">
        You do not have access to AI agents in this project.
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
        Loading…
      </div>
    );
  }

  if (agents.length === 0) {
    return (
      <div className="flex h-full items-center justify-center p-6">
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Bot />
            </EmptyMedia>
            <EmptyTitle>No agents to chat with</EmptyTitle>
            <EmptyDescription>
              Add an internal agent run by the built-in runtime, then come back here to chat with it
              in test mode.
            </EmptyDescription>
          </EmptyHeader>
          {can('ai_agents', 'edit') && (
            <EmptyContent>
              <Button asChild size="sm">
                <Link href={aiAgentsPath(project.project.key)}>Manage agents</Link>
              </Button>
            </EmptyContent>
          )}
        </Empty>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0">
      <AiChatAgentRail
        agents={agents}
        selectedId={selected?.id ?? null}
        onSelect={selectAgent}
        providerLabel={providerLabel}
      />
      {selected && (
        <>
          <AiChatThreadRail
            key={selected.id}
            projectKey={project.project.key}
            agentId={selected.id}
            selectedThreadId={selectedThreadId}
            onSelect={selectThread}
            onNewChat={startNewChat}
          />
          <div className="flex min-h-0 flex-1 flex-col">
            <AiChatConversation
              key={`${selected.id}:${newChatNonce}`}
              projectKey={project.project.key}
              agent={selected}
              providerLabel={providerLabel}
              threadId={selectedThreadId}
              onThreadCreated={handleThreadCreated}
            />
          </div>
        </>
      )}
    </div>
  );
}
