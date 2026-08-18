'use client';

import { useAgentThreadsQuery } from '@/services/aiAgents.service';

// The coding agent session an external agent's runner keeps for the shown thread, which
// the thread list is what carries. Null until a runner has reported one.
export function useThreadSessionId(
  projectKey: string,
  agentId: number | null,
  threadId: string | null,
): string | null {
  const threadsQuery = useAgentThreadsQuery(projectKey, agentId);
  if (!threadId) return null;
  return threadsQuery.data?.find((thread) => thread.id === threadId)?.cliSessionId ?? null;
}
