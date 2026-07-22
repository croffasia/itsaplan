'use client';

import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAiAgentsQuery } from '@/services/aiAgents.service';
import { useIntegrationCatalogQuery } from '@/services/integrations.service';
import { qk } from '@/services/queryKeys';

// The agents available for chat and which conversation is shown, shared by the AI Chat
// page and the floating chat. Only internal agents appear, since they are the ones the
// built-in runtime can run; external agents are driven through the API and have no test
// chat.
//
// `selectedThreadId` is a past thread, or null for a fresh chat. `newChatNonce` bumps on
// "New chat" so the host can key the conversation by it and remount into a fresh session
// without changing agents.
export function useAiChatSelection(projectKey: string | null) {
  const qc = useQueryClient();
  const agentsQuery = useAiAgentsQuery(projectKey);
  const agents = (agentsQuery.data ?? []).filter((agent) => agent.kind === 'internal');
  const catalog = useIntegrationCatalogQuery(projectKey).data ?? [];
  const providerLabel = (key: string) => catalog.find((entry) => entry.key === key)?.label ?? key;

  const [selectedId, setSelectedId] = useState<number | null>(null);
  const selected = agents.find((agent) => agent.id === selectedId) ?? agents[0] ?? null;
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);
  const [newChatNonce, setNewChatNonce] = useState(0);

  const selectAgent = (id: number) => {
    setSelectedId(id);
    setSelectedThreadId(null);
  };

  const startNewChat = () => {
    setSelectedThreadId(null);
    setNewChatNonce((n) => n + 1);
  };

  // A fresh chat produced its first reply: show it as the selected thread and refresh
  // the history list, which now holds it.
  const handleThreadCreated = (threadId: string) => {
    setSelectedThreadId(threadId);
    if (projectKey && selected)
      void qc.invalidateQueries({ queryKey: qk.agentThreads(projectKey, selected.id) });
  };

  return {
    agents,
    isLoading: agentsQuery.isLoading,
    providerLabel,
    selected,
    selectedThreadId,
    newChatNonce,
    selectAgent,
    selectThread: setSelectedThreadId,
    startNewChat,
    handleThreadCreated,
  };
}
