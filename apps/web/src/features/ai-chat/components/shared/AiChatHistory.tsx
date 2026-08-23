'use client';

import { ChevronLeft } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { AiChatThreadList } from './AiChatThreadList';

// The past conversations with one agent, shown over the conversation by the host. The
// conversation below stays mounted, so a reply that runs while the list is open goes on.
export function AiChatHistory({
  projectKey,
  agentId,
  selectedThreadId,
  onSelect,
  onDeleted,
  onBack,
}: {
  projectKey: string;
  agentId: number;
  selectedThreadId: string | null;
  onSelect: (threadId: string) => void;
  onDeleted: (threadId: string) => void;
  onBack: () => void;
}) {
  const t = useTranslations('aiChat');
  const tCommon = useTranslations('common');

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center gap-2 border-b px-2.5 py-2">
        <Button
          variant="ghost"
          size="icon"
          className="size-7 shrink-0"
          title={tCommon('back')}
          onClick={onBack}
        >
          <ChevronLeft />
          <span className="sr-only">{t('backToChat')}</span>
        </Button>
        <div className="text-sm font-medium">{t('history')}</div>
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
