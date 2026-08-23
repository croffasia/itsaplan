'use client';

import { useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useAgentThreadsQuery, useDeleteAgentThread } from '@/services/aiAgents.service';
import ConfirmDialog from '@/components/common/overlay/ConfirmDialog';
import type { AiChatThread } from '@/lib/api';
import { AiChatThreadItem } from './AiChatThreadItem';
import { AiChatThreadItemSkeleton } from './AiChatThreadItemSkeleton';

// The caller's own past conversations with one agent, newest first, loaded a page at a
// time as the end of the list comes into view. The host supplies the header around it.
// `selectedThreadId` marks the conversation currently shown; a thread that has not
// produced its first reply yet has no id and so is not in this list. Deleting a
// conversation removes it and its messages; `onDeleted` lets the host reset the chat
// when the deleted one was open.
export function AiChatThreadList({
  projectKey,
  agentId,
  selectedThreadId,
  onSelect,
  onDeleted,
}: {
  projectKey: string;
  agentId: number;
  selectedThreadId: string | null;
  onSelect: (threadId: string) => void;
  onDeleted: (threadId: string) => void;
}) {
  const t = useTranslations('aiChat');
  const tCommon = useTranslations('common');
  const threadsQuery = useAgentThreadsQuery(projectKey, agentId);
  const threads = threadsQuery.data?.pages.flatMap((page) => page.items) ?? [];
  const { hasNextPage, isFetchingNextPage, fetchNextPage } = threadsQuery;
  const deleteThread = useDeleteAgentThread(projectKey, agentId);
  const [pending, setPending] = useState<AiChatThread | null>(null);

  const sentinelRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || !hasNextPage) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !isFetchingNextPage) void fetchNextPage();
      },
      // Start loading a bit before the sentinel is fully visible.
      { rootMargin: '200px' },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  async function confirmDelete() {
    if (!pending) return;
    await deleteThread.mutateAsync(pending.id);
    setPending(null);
    onDeleted(pending.id);
  }

  if (threadsQuery.isLoading) {
    return (
      <div className="min-h-0 flex-1 space-y-1 overflow-y-auto p-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <AiChatThreadItemSkeleton key={i} />
        ))}
      </div>
    );
  }

  if (threads.length === 0) {
    return (
      <div className="min-h-0 flex-1 px-4 py-6 text-center text-xs text-muted-foreground">
        {t('noThreads')}
      </div>
    );
  }

  return (
    <>
      <div className="min-h-0 flex-1 space-y-0.5 overflow-y-auto p-2">
        {threads.map((thread) => (
          <AiChatThreadItem
            key={thread.id}
            thread={thread}
            active={thread.id === selectedThreadId}
            onSelect={() => onSelect(thread.id)}
            onDelete={() => setPending(thread)}
          />
        ))}
        <div ref={sentinelRef} />
        {isFetchingNextPage && <AiChatThreadItemSkeleton />}
      </div>

      {pending && (
        <ConfirmDialog
          title={t('deleteThread')}
          confirmLabel={tCommon('delete')}
          onConfirm={confirmDelete}
          onClose={() => setPending(null)}
        >
          <div className="text-sm text-muted-foreground">
            {t('deleteThreadConfirm', { title: pending.title ?? t('untitledThread') })}
          </div>
        </ConfirmDialog>
      )}
    </>
  );
}
