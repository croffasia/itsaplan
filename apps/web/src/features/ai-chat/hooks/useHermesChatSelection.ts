'use client';

import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import {
  useAiAgentsQuery,
  useCreateHermesConversation,
  useHermesAgentsQuery,
  useHermesConversationsQuery,
} from '@/services/aiAgents.service';

export function useHermesChatSelection(projectKey: string | null) {
  const aiAgentsQuery = useAiAgentsQuery(projectKey);
  const hermesAgentsQuery = useHermesAgentsQuery(projectKey);
  const hermesAgents = useMemo(() => hermesAgentsQuery.data ?? [], [hermesAgentsQuery.data]);
  const agents = useMemo(() => {
    const ids = new Set(hermesAgents.map((agent) => agent.id));
    return (aiAgentsQuery.data ?? []).filter((agent) => ids.has(agent.id));
  }, [aiAgentsQuery.data, hermesAgents]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const selected = agents.find((agent) => agent.id === selectedId) ?? agents[0] ?? null;
  const selectedStatus =
    hermesAgents.find((agent) => agent.id === selected?.id)?.status ?? 'offline';
  const conversationsQuery = useHermesConversationsQuery(projectKey, selected?.id ?? null);
  const conversations = conversationsQuery.data ?? [];
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const activeConversationId = selectedConversationId ?? conversations[0]?.id ?? null;
  const createConversation = useCreateHermesConversation(projectKey, selected?.id ?? null);

  const selectAgent = (id: number) => {
    setSelectedId(id);
    setSelectedConversationId(null);
  };

  const startNewChat = async () => {
    if (!selected || selectedStatus !== 'ready') return;
    try {
      const conversation = await createConversation.mutateAsync();
      setSelectedConversationId(conversation.id);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not create the conversation.');
    }
  };

  return {
    agents,
    hermesAgents,
    selected,
    selectedStatus,
    conversations,
    conversationsLoading: conversationsQuery.isLoading,
    selectedConversationId: activeConversationId,
    isLoading: aiAgentsQuery.isLoading || hermesAgentsQuery.isLoading,
    isCreating: createConversation.isPending,
    selectAgent,
    selectConversation: setSelectedConversationId,
    startNewChat,
    clearConversation: () => setSelectedConversationId(null),
  };
}
