'use client';

import { MessageCircle } from 'lucide-react';
import { useAgentThreadsQuery } from '@/services/aiAgents.service';
import { formatShortDate } from '@/utils/dates';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';

// The caller's own past conversations with one agent, newest first. Used by both the
// AI Chat page's thread rail and the floating chat's history layer; each host supplies
// its own header. `selectedThreadId` marks the conversation currently shown; a thread
// that has not produced its first reply yet has no id and so is not in this list.
export function AiChatThreadList({
  projectKey,
  agentId,
  selectedThreadId,
  onSelect,
}: {
  projectKey: string;
  agentId: number;
  selectedThreadId: string | null;
  onSelect: (threadId: string) => void;
}) {
  const threadsQuery = useAgentThreadsQuery(projectKey, agentId);
  const threads = threadsQuery.data ?? [];

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
    <div className="min-h-0 flex-1 space-y-0.5 overflow-y-auto p-2">
      {threads.map((thread) => {
        const active = thread.id === selectedThreadId;
        return (
          <button
            key={thread.id}
            type="button"
            onClick={() => onSelect(thread.id)}
            aria-pressed={active}
            className={cn(
              'flex w-full items-start gap-2 rounded-lg px-2.5 py-2 text-left transition-colors',
              active ? 'bg-accent' : 'hover:bg-accent/50',
            )}
          >
            <MessageCircle
              className={cn(
                'mt-0.5 size-3.5 shrink-0',
                active ? 'text-foreground' : 'text-muted-foreground',
              )}
            />
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm">{thread.title ?? 'New conversation'}</div>
              <div className="text-xs text-muted-foreground">
                {formatShortDate(thread.updatedAt)}
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}
