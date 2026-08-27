'use client';

import type { AiChatThread } from '@/lib/api';
import { useLoadedAgentThreads } from '@/services/aiAgents.service';

// The saved thread the panel is showing, which is what carries the facts about the
// conversation that are not in its transcript: the session an external agent's runner
// keeps for it, and the context size of its last answer. Null until the thread list
// holds it — a fresh chat has no thread yet.
export function useShownThread(
  projectKey: string,
  agentId: number | null,
  threadId: string | null,
): AiChatThread | null {
  const threads = useLoadedAgentThreads(projectKey, agentId);
  if (!threadId) return null;
  return threads.find((thread) => thread.id === threadId) ?? null;
}
