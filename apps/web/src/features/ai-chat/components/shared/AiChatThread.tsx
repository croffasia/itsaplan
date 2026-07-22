'use client';

import { useEffect, useRef } from 'react';
import type { AiAgent } from '@/lib/api';
import { useAgentChat } from '@/hooks/useAgentChat';
import { useAgentThreadMessagesQuery } from '@/services/aiAgents.service';
import { AgentChatPanel } from '@/components/common/agent-chat/AgentChatPanel';
import { AiChatThreadSkeleton } from './AiChatThreadSkeleton';

// The transcript and composer for one conversation with an agent. The chat session
// lives here, so it survives the floating window being minimized (the window is hidden,
// not unmounted) and navigation between pages. `threadId` is the conversation the host
// wants shown: a past thread is restored from its transcript, null means a fresh chat.
// When a fresh chat produces its first reply, its new thread id is reported up via
// onThreadCreated so the host can select it and refresh the history list. Hosts key
// this component by agent id and a new-chat nonce: switching agents or starting a new
// chat remounts it into a fresh session.
export function AiChatThread({
  projectKey,
  agent,
  threadId,
  onThreadCreated,
}: {
  projectKey: string;
  agent: AiAgent;
  threadId: string | null;
  onThreadCreated: (threadId: string) => void;
}) {
  const {
    messages,
    status,
    activeTool,
    threadId: activeThreadId,
    send,
    loadThread,
    prependHistory,
  } = useAgentChat(projectKey, agent.id);
  const messagesQuery = useAgentThreadMessagesQuery(projectKey, agent.id, threadId);

  // How many transcript pages of the active thread are already in the conversation.
  // Page 0 counts as merged from the start: for a restored thread it is what
  // loadThread put there, and for a thread created live in this session its server
  // copies carry different ids than the optimistic messages, so merging it would
  // duplicate them.
  const mergedRef = useRef<{ threadId: string | null; pages: number }>({
    threadId: null,
    pages: 0,
  });

  // Restore a selected past thread once its transcript has loaded. Skipped when it
  // is already the active conversation (e.g. the thread just created here).
  useEffect(() => {
    const latestMessages = messagesQuery.data?.pages[0]?.items;
    if (threadId && threadId !== activeThreadId && latestMessages) {
      loadThread(threadId, latestMessages);
    }
  }, [threadId, messagesQuery.data, activeThreadId, loadThread]);

  // Merge the older pages fetched by "load earlier". They arrive newest-page first,
  // so the new pages are reversed before prepending to stay chronological.
  useEffect(() => {
    if (!threadId || threadId !== activeThreadId) return;
    if (mergedRef.current.threadId !== threadId) mergedRef.current = { threadId, pages: 1 };
    const pages = messagesQuery.data?.pages;
    if (!pages || pages.length <= mergedRef.current.pages) return;
    const older = pages.slice(mergedRef.current.pages);
    mergedRef.current.pages = pages.length;
    prependHistory([...older].reverse().flatMap((page) => page.items));
  }, [threadId, messagesQuery.data, activeThreadId, prependHistory]);

  // A fresh chat produced its first reply: report the new thread id up so the host
  // selects it and refreshes the history list. Only for a fresh chat (threadId null);
  // when restoring a past thread, activeThreadId briefly lags the selected threadId,
  // and reporting it back would overwrite the new selection in a render loop.
  useEffect(() => {
    if (activeThreadId && threadId === null) onThreadCreated(activeThreadId);
  }, [activeThreadId, threadId, onThreadCreated]);

  const restoring = threadId != null && threadId !== activeThreadId && messagesQuery.isLoading;
  if (restoring) return <AiChatThreadSkeleton />;

  return (
    <AgentChatPanel
      agent={agent}
      messages={messages}
      status={status}
      activeTool={activeTool}
      onSend={send}
      hasEarlierMessages={messagesQuery.hasNextPage}
      isLoadingEarlier={messagesQuery.isFetchingNextPage}
      onLoadEarlier={() => void messagesQuery.fetchNextPage()}
    />
  );
}
