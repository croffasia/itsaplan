'use client';

import { useState } from 'react';
import { LoaderCircle, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { ChatPanelTabRename } from './ChatPanelTabRename';
import { useChatSessionTitle } from '../../hooks/useChatSessionTitle';
import type { ChatSession } from '../../hooks/useChatSessions';

// One session in the tab row.
export function ChatPanelTab({
  projectKey,
  session,
  active,
  dragging = false,
  editing = false,
  onEditing,
  onSelect,
  onClose,
}: {
  projectKey: string;
  session: ChatSession;
  active: boolean;
  dragging?: boolean;
  editing?: boolean;
  onEditing?: (editing: boolean) => void;
  onSelect: () => void;
  onClose: () => void;
}) {
  const t = useTranslations('aiChat');
  const { title, agentName } = useChatSessionTitle(projectKey, session);
  // Controlled, so that a tab being dragged shows no tooltip over the row it moves in.
  const [tooltipOpen, setTooltipOpen] = useState(false);

  return (
    <div
      className={cn(
        'group relative flex shrink-0 items-center rounded-md transition-colors',
        active ? 'bg-accent' : 'hover:bg-accent/50',
      )}
    >
      {editing && session.threadId ? (
        <ChatPanelTabRename
          projectKey={projectKey}
          agentId={session.agentId}
          threadId={session.threadId}
          title={title}
          onDone={() => onEditing?.(false)}
        />
      ) : (
        <Tooltip open={tooltipOpen && !dragging} onOpenChange={setTooltipOpen}>
          <TooltipTrigger asChild>
            <button
              type="button"
              onClick={onSelect}
              // A chat that has not started has no thread to carry a title yet.
              onDoubleClick={() => session.threadId && onEditing?.(true)}
              aria-pressed={active}
              className="flex max-w-40 items-center gap-1.5 py-1 ps-2 pe-7 text-xs"
            >
              {session.running && (
                <LoaderCircle className="size-3 shrink-0 animate-spin text-muted-foreground" />
              )}
              <span className={cn('truncate', !active && 'text-muted-foreground')}>{title}</span>
            </button>
          </TooltipTrigger>
          {/* Which agent a tab chats with is only on screen for the one in front. */}
          <TooltipContent side="bottom" className="max-w-64">
            <div className="truncate">{title}</div>
            {agentName && <div className="font-medium text-muted-foreground">{agentName}</div>}
            {session.threadId && (
              <div className="mt-1 text-[11px] text-muted-foreground/70">{t('renameHint')}</div>
            )}
          </TooltipContent>
        </Tooltip>
      )}

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
