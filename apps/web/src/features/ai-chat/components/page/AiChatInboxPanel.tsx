'use client';

import { useState } from 'react';
import { Search } from 'lucide-react';
import type { AiAgent, HermesChatAgent, HermesConversation } from '@/lib/api';
import { Input } from '@/components/ui/input';
import { AiChatAgentList } from './AiChatAgentList';
import { HermesConversationList } from './HermesConversationList';

export function AiChatInboxPanel({
  projectKey,
  agents,
  hermesAgents,
  selected,
  conversations,
  conversationsLoading,
  selectedThreadId,
  onSelectAgent,
  onSelectThread,
  onDeleted,
}: {
  projectKey: string;
  agents: AiAgent[];
  hermesAgents: HermesChatAgent[];
  selected: AiAgent | null;
  conversations: HermesConversation[];
  conversationsLoading: boolean;
  selectedThreadId: string | null;
  onSelectAgent: (id: number) => void;
  onSelectThread: (conversationId: string) => void;
  onDeleted: (conversationId: string) => void;
}) {
  const [search, setSearch] = useState('');
  const query = search.trim().toLowerCase();
  const visible = agents.filter(
    (agent) =>
      !query ||
      agent.name.toLowerCase().includes(query) ||
      agent.username.toLowerCase().includes(query),
  );

  return (
    <aside className="flex min-h-[38rem] flex-col overflow-hidden rounded-2xl border bg-card shadow-sm">
      <div className="border-b px-4 py-3">
        <div className="flex items-center justify-between gap-3">
          <p className="font-mono text-[10px] tracking-[0.18em] text-muted-foreground uppercase">
            Inbox
          </p>
          <p className="text-xs text-muted-foreground tabular-nums">{agents.length} agents</p>
        </div>
        <div className="relative mt-3">
          <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search agents..."
            className="pl-9"
          />
        </div>
      </div>
      <AiChatAgentList
        agents={visible}
        hermesAgents={hermesAgents}
        selectedId={selected?.id ?? null}
        onSelect={onSelectAgent}
      />
      <div className="border-b px-4 py-2.5 font-mono text-[10px] tracking-[0.16em] text-muted-foreground uppercase">
        Conversations
      </div>
      <HermesConversationList
        projectKey={projectKey}
        agentId={selected?.id ?? null}
        conversations={conversations}
        isLoading={conversationsLoading}
        selectedConversationId={selectedThreadId}
        onSelect={onSelectThread}
        onArchived={onDeleted}
      />
    </aside>
  );
}
