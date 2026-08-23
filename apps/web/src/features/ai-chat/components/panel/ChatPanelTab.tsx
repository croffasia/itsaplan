'use client';

import { useEffect, useRef } from 'react';
import { LoaderCircle, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useAgentThreadsQuery } from '@/services/aiAgents.service';
import { cn } from '@/lib/utils';
import type { ChatSession } from '../../hooks/useChatSessions';

// One session in the tab row. The title comes from the agent's thread list, which every
// tab of that agent reads from the same query; a session with no thread yet is a new
// chat and has none.
export function ChatPanelTab({
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
  const threads = useAgentThreadsQuery(projectKey, session.agentId).data ?? [];
  const thread = threads.find((candidate) => candidate.id === session.threadId);
  const title = thread?.title ?? t('newChat');

  // The row scrolls, so the tab the user just opened has to bring itself into sight.
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (active) ref.current?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }, [active]);

  return (
    <div
      ref={ref}
      className={cn(
        'group relative flex shrink-0 items-center rounded-md transition-colors',
        active ? 'bg-accent' : 'hover:bg-accent/50',
      )}
    >
      <button
        type="button"
        onClick={onSelect}
        aria-pressed={active}
        title={title}
        className="flex max-w-40 items-center gap-1.5 py-1 ps-2 pe-7 text-xs"
      >
        {session.running && (
          <LoaderCircle className="size-3 shrink-0 animate-spin text-muted-foreground" />
        )}
        <span className={cn('truncate', !active && 'text-muted-foreground')}>{title}</span>
      </button>

      <button
        type="button"
        onClick={onClose}
        title={t('closeTab')}
        className="absolute end-1 rounded-sm p-0.5 text-muted-foreground hover:text-foreground"
      >
        <X className="size-3" />
        <span className="sr-only">{t('closeTab')}</span>
      </button>
    </div>
  );
}
