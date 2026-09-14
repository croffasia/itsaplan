'use client';

import { Bot } from 'lucide-react';
import type { AiAgent } from '@/lib/api';
import { Badge } from '@/components/ui/badge';
import { AgentChatPanel } from '@/components/common/agent-chat/AgentChatPanel';
import { AiChatThreadSkeleton } from '../shared/AiChatThreadSkeleton';
import { useHermesChat } from '../../hooks/useHermesChat';

export function HermesChatConversation({
  projectKey,
  agent,
  conversationId,
}: {
  projectKey: string;
  agent: AiAgent;
  conversationId: string;
}) {
  const chat = useHermesChat(projectKey, agent.id, conversationId);
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center gap-3 border-b px-5 py-3">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Bot className="size-4.5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate text-sm font-medium">{agent.name}</span>
            <Badge variant="secondary">Hermes</Badge>
          </div>
          <div className="truncate text-xs text-muted-foreground">
            @{agent.username} · Separate Hermes session
          </div>
        </div>
      </div>
      <div className="min-h-0 flex-1">
        {chat.isLoading ? (
          <AiChatThreadSkeleton />
        ) : (
          <AgentChatPanel
            agent={agent}
            messages={chat.messages}
            status={chat.status}
            activeTool={chat.activeTool}
            onSend={chat.send}
          />
        )}
      </div>
    </div>
  );
}
