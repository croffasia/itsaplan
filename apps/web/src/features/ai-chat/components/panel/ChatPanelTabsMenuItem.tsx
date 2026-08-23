'use client';

import { LoaderCircle, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { DropdownMenuItem } from '@/components/ui/dropdown-menu';
import { useChatSessionTitle } from '../../hooks/useChatSessionTitle';
import type { ChatSession } from '../../hooks/useChatSessions';

// One session in the menu of the tabs the row did not fit. The close control sits next
// to the item rather than inside it, so closing a tab leaves the menu open.
export function ChatPanelTabsMenuItem({
  projectKey,
  session,
  active,
  onSelect,
  onClose,
}: {
  projectKey: string;
  session: ChatSession;
  active: boolean;
  onSelect: () => void;
  onClose: () => void;
}) {
  const t = useTranslations('aiChat');
  const { title, agentName } = useChatSessionTitle(projectKey, session);

  return (
    <div className="relative">
      <DropdownMenuItem
        className={cn('items-start pe-8', active && 'bg-accent')}
        onSelect={onSelect}
      >
        {session.running && <LoaderCircle className="mt-1 size-3 shrink-0 animate-spin" />}
        <div className="min-w-0 flex-1">
          <div className="truncate">{title}</div>
          {agentName && <div className="truncate text-xs text-muted-foreground">{agentName}</div>}
        </div>
      </DropdownMenuItem>

      <Button
        variant="ghost"
        size="icon"
        title={t('closeTab')}
        onClick={onClose}
        className="absolute end-1 top-1/2 size-6 -translate-y-1/2 text-muted-foreground hover:text-foreground"
      >
        <X className="size-3" />
        <span className="sr-only">{t('closeTab')}</span>
      </Button>
    </div>
  );
}
