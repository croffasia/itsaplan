'use client';

import { useTranslations } from 'next-intl';
import { useAiAgentsQuery, useLoadedAgentThreads } from '@/services/aiAgents.service';
import type { ChatSession } from './useChatSessions';

// What a session is called in the tab row and in the menu of the tabs that did not fit
// it. The title comes from the agent's thread list, which every tab of that agent reads
// from the same query; a session with no thread yet is a new chat and has none.
export function useChatSessionTitle(projectKey: string, session: ChatSession) {
  const t = useTranslations('aiChat');
  const threads = useLoadedAgentThreads(projectKey, session.agentId);
  const agents = useAiAgentsQuery(projectKey).data ?? [];
  const thread = threads.find((candidate) => candidate.id === session.threadId);

  return {
    title: thread?.title ?? t('newChat'),
    agentName: agents.find((agent) => agent.id === session.agentId)?.name ?? '',
  };
}
