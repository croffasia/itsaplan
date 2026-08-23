'use client';

import { History, Plus } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { ChatPanelTab } from './ChatPanelTab';
import type { ChatSession } from '../../hooks/useChatSessions';

// The open sessions of the panel, with the controls that open one more and the past
// ones. More tabs than the row fits scroll to the side.
export function ChatPanelTabs({
  projectKey,
  sessions,
  activeId,
  onSelect,
  onClose,
  onNewTab,
  onShowHistory,
}: {
  projectKey: string;
  sessions: ChatSession[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onClose: (id: string) => void;
  onNewTab: () => void;
  onShowHistory: () => void;
}) {
  const t = useTranslations('aiChat');

  return (
    <div className="flex items-center gap-1 border-b px-2 py-1">
      <div className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto">
        {sessions.map((session) => (
          <ChatPanelTab
            key={session.id}
            projectKey={projectKey}
            session={session}
            active={session.id === activeId}
            onSelect={() => onSelect(session.id)}
            onClose={() => onClose(session.id)}
          />
        ))}
      </div>

      <Button
        variant="ghost"
        size="icon"
        className="size-7 shrink-0 text-muted-foreground hover:text-foreground"
        title={t('history')}
        onClick={onShowHistory}
      >
        <History />
        <span className="sr-only">{t('history')}</span>
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className="size-7 shrink-0 text-muted-foreground hover:text-foreground"
        title={t('newChat')}
        onClick={onNewTab}
      >
        <Plus />
        <span className="sr-only">{t('newChat')}</span>
      </Button>
    </div>
  );
}
