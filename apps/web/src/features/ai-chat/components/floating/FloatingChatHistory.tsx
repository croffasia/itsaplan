'use client';

import { ChevronLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { AiChatThreadList } from '../shared/AiChatThreadList';

// The history layer of the floating chat, shown over the conversation.
export function FloatingChatHistory({
  projectKey,
  agentId,
  selectedThreadId,
  onSelect,
  onBack,
}: {
  projectKey: string;
  agentId: number;
  selectedThreadId: string | null;
  onSelect: (threadId: string) => void;
  onBack: () => void;
}) {
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center gap-2 border-b px-2.5 py-2">
        <Button
          variant="ghost"
          size="icon"
          className="size-7 shrink-0"
          title="Back"
          onClick={onBack}
        >
          <ChevronLeft />
          <span className="sr-only">Back to chat</span>
        </Button>
        <div className="text-sm font-medium">History</div>
      </div>

      <AiChatThreadList
        projectKey={projectKey}
        agentId={agentId}
        selectedThreadId={selectedThreadId}
        onSelect={onSelect}
      />
    </div>
  );
}
