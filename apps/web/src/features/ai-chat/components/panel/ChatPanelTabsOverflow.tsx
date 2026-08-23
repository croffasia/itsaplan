'use client';

import { MoreHorizontal } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ChatPanelTabsMenuItem } from './ChatPanelTabsMenuItem';
import type { ChatSession } from '../../hooks/useChatSessions';

// The sessions the tab row has no width for.
export function ChatPanelTabsOverflow({
  projectKey,
  sessions,
  activeId,
  onSelect,
  onClose,
}: {
  projectKey: string;
  sessions: ChatSession[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onClose: (id: string) => void;
}) {
  const t = useTranslations('aiChat');

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="size-7 shrink-0 text-muted-foreground hover:text-foreground"
          title={t('moreTabs', { count: sessions.length })}
        >
          <MoreHorizontal />
          <span className="sr-only">{t('moreTabs', { count: sessions.length })}</span>
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-64">
        {sessions.map((session) => (
          <ChatPanelTabsMenuItem
            key={session.id}
            projectKey={projectKey}
            session={session}
            active={session.id === activeId}
            onSelect={() => onSelect(session.id)}
            onClose={() => onClose(session.id)}
          />
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
