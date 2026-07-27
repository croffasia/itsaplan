'use client';

import { useState } from 'react';
import { useAgentThreadsQuery, useDeleteAgentThread } from '@/services/aiAgents.service';
import { Skeleton } from '@/components/ui/skeleton';
import ConfirmDialog from '@/components/common/overlay/ConfirmDialog';
import type { AiChatThread } from '@/lib/api';
import { AiChatThreadItem } from './AiChatThreadItem';

// The caller's own past conversations with one agent, newest first. Used by both the
// AI Chat page's thread rail and the floating chat's history layer; each host supplies
// its own header. `selectedThreadId` marks the conversation currently shown; a thread
// that has not produced its first reply yet has no id and so is not in this list.
// Deleting a conversation removes it and its messages; `onDeleted` lets the host reset
// the chat when the deleted one was open.
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
  const threadsQuery = useAgentThreadsQuery(projectKey, agentId);
  const threads = threadsQuery.data ?? [];
  const deleteThread = useDeleteAgentThread(projectKey, agentId);
  const [pending, setPending] = useState<AiChatThread | null>(null);

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
          <div key={i} className="flex items-start gap-2 px-1.5 py-2">
            <Skeleton className="mt-0.5 size-3.5 shrink-0 rounded" />
            <div className="min-w-0 flex-1 space-y-1.5">
              <Skeleton className="h-3.5 w-4/5 rounded" />
              <Skeleton className="h-3 w-12 rounded" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (threads.length === 0) {
    return (
      <div className="min-h-0 flex-1 px-4 py-6 text-center text-xs text-muted-foreground">
        No conversations yet. Send a message to start one.
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
      </div>

      {pending && (
        <ConfirmDialog
          title="Delete conversation"
          confirmLabel="Delete"
          onConfirm={confirmDelete}
          onClose={() => setPending(null)}
        >
          <div className="text-sm text-muted-foreground">
            “{pending.title ?? 'New conversation'}” and its messages are deleted permanently.
          </div>
        </ConfirmDialog>
      )}
    </>
  );
}
