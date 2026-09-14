import { MessageSquarePlus } from 'lucide-react';
import type { AiAgent } from '@/lib/api';
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty';
import { HermesChatConversation } from './HermesChatConversation';

export function AiChatSelectedConversation({
  projectKey,
  agent,
  conversationId,
}: {
  projectKey: string;
  agent: AiAgent | null;
  conversationId: string | null;
}) {
  if (!agent) return null;
  return (
    <div className="min-h-[38rem] overflow-hidden rounded-2xl border bg-card shadow-sm">
      {conversationId ? (
        <HermesChatConversation
          key={conversationId}
          projectKey={projectKey}
          agent={agent}
          conversationId={conversationId}
        />
      ) : (
        <Empty className="h-full">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <MessageSquarePlus />
            </EmptyMedia>
            <EmptyTitle>Create a conversation with {agent.name}</EmptyTitle>
            <EmptyDescription>
              Select New chat to create an isolated session on the Hermes server.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      )}
    </div>
  );
}
