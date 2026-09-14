'use client';

import { useState } from 'react';
import type { HermesConversation } from '@/lib/api';
import { useArchiveHermesConversation } from '@/services/aiAgents.service';
import { Skeleton } from '@/components/ui/skeleton';
import ConfirmDialog from '@/components/common/overlay/ConfirmDialog';
import { AiChatThreadItem } from '../shared/AiChatThreadItem';

export function HermesConversationList({
  projectKey,
  agentId,
  conversations,
  isLoading,
  selectedConversationId,
  onSelect,
  onArchived,
}: {
  projectKey: string;
  agentId: number | null;
  conversations: HermesConversation[];
  isLoading: boolean;
  selectedConversationId: string | null;
  onSelect: (conversationId: string) => void;
  onArchived: (conversationId: string) => void;
}) {
  const archive = useArchiveHermesConversation(projectKey, agentId);
  const [pending, setPending] = useState<HermesConversation | null>(null);

  if (isLoading) {
    return (
      <div className="min-h-0 flex-1 space-y-2 p-3">
        {Array.from({ length: 4 }).map((_, index) => (
          <Skeleton key={index} className="h-12 rounded-lg" />
        ))}
      </div>
    );
  }
  if (conversations.length === 0) {
    return (
      <div className="min-h-0 flex-1 px-4 py-6 text-center text-xs text-muted-foreground">
        No conversations yet. Select New chat to create a separate Hermes session.
      </div>
    );
  }

  return (
    <>
      <div className="min-h-0 flex-1 space-y-0.5 overflow-y-auto p-2">
        {conversations.map((conversation) => (
          <AiChatThreadItem
            key={conversation.id}
            thread={conversation}
            active={conversation.id === selectedConversationId}
            onSelect={() => onSelect(conversation.id)}
            onDelete={() => setPending(conversation)}
          />
        ))}
      </div>
      {pending && (
        <ConfirmDialog
          title="Archive conversation"
          confirmLabel="Archive"
          onConfirm={async () => {
            await archive.mutateAsync(pending.id);
            onArchived(pending.id);
            setPending(null);
          }}
          onClose={() => setPending(null)}
        >
          <div className="text-sm text-muted-foreground">
            This removes the conversation from Vexol. Hermes history is retained.
          </div>
        </ConfirmDialog>
      )}
    </>
  );
}
