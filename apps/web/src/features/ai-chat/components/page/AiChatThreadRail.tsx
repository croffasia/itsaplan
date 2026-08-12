'use client';

import { MessageSquarePlus } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { AiChatThreadList } from '../shared/AiChatThreadList';

// The middle column of the AI Chat page. A fresh chat that has not been sent yet is
// marked by selectedThreadId null.
export function AiChatThreadRail({
  projectKey,
  agentId,
  selectedThreadId,
  onSelect,
  onDeleted,
  onNewChat,
}: {
  projectKey: string;
  agentId: number;
  selectedThreadId: string | null;
  onSelect: (threadId: string) => void;
  onDeleted: (threadId: string) => void;
  onNewChat: () => void;
}) {
  const t = useTranslations('aiChat');

  return (
    <div className="flex w-64 shrink-0 flex-col border-r bg-muted/20">
      <div className="flex items-center justify-between gap-2 border-b px-3 py-3">
        <div className="text-sm font-semibold">{t('chats')}</div>
        <Button
          size="sm"
          variant="outline"
          className="h-7 gap-1.5 px-2 text-xs"
          onClick={onNewChat}
        >
          <MessageSquarePlus className="size-3.5" />
          {t('newChat')}
        </Button>
      </div>

      <AiChatThreadList
        projectKey={projectKey}
        agentId={agentId}
        selectedThreadId={selectedThreadId}
        onSelect={onSelect}
        onDeleted={onDeleted}
      />
    </div>
  );
}
