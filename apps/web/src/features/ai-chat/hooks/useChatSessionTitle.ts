'use client';

import { useTranslations } from 'next-intl';
import { useLoadedChatThreads } from '@/services/aiAgents.service';
import type { ChatSession } from './useChatSessions';

// What a session is called: its title in the loaded history, the one it was opened by where
// the history has not reached it, and a new chat while it has no thread.
export function useChatSessionTitle(projectKey: string): (session: ChatSession) => string {
  const t = useTranslations('aiChat');
  const threads = useLoadedChatThreads(projectKey);

  return (session) => {
    if (!session.threadId) return t('newChat');
    const thread = threads.find((candidate) => candidate.id === session.threadId);
    return thread?.title ?? session.title ?? t('untitledThread');
  };
}
