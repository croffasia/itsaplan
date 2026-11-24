'use client';

import { useState } from 'react';
import { ChevronDown, Plus } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { AiAgent } from '@/lib/api/endpoints/agents';
import WorkingCount from '@/components/common/WorkingCount';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ChatPanelFavorite } from './ChatPanelFavorite';
import { ChatPanelList } from './ChatPanelList';
import { useChatSessionTitle } from '../../hooks/useChatSessionTitle';
import type { ChatSession, ChatSessions } from '../../hooks/useChatSessions';

// What the open conversation is called. Where the conversations have no column of their
// own, the name opens them, and how many others are answering stands next to it.
export function ChatPanelTitle({
  projectKey,
  agents,
  chats,
  active,
  wide,
}: {
  projectKey: string;
  agents: AiAgent[];
  chats: ChatSessions;
  active: ChatSession;
  wide: boolean;
}) {
  const t = useTranslations('aiChat');
  const titleOf = useChatSessionTitle(projectKey);
  const [open, setOpen] = useState(false);
  const title = titleOf(active);
  const answering = chats.sessions.filter(
    (session) => session.running && session.id !== active.id,
  ).length;

  return (
    <div className="flex h-12 shrink-0 items-center gap-1 ps-2 pe-2.5">
      {wide ? (
        <h2 dir="auto" className="min-w-0 truncate px-4 text-sm font-semibold">
          {title}
        </h2>
      ) : (
        <>
          <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="min-w-0 shrink gap-2 px-2 font-semibold has-[>svg]:px-2 aria-expanded:bg-accent"
                title={t('history')}
              >
                <span dir="auto" className="truncate">
                  {title}
                </span>
                <ChevronDown className="size-3.5 text-muted-foreground" />
              </Button>
            </PopoverTrigger>
            <PopoverContent
              align="start"
              aria-label={t('history')}
              className="flex h-[32rem] max-h-(--radix-popover-content-available-height) w-96 max-w-[calc(100vw-1rem)] flex-col p-0"
              // The delete confirmation opens in a portal of its own, so a click in it
              // counts as outside this popover. The list has to stay mounted for that
              // delete to run.
              onInteractOutside={(event) => {
                if ((event.target as HTMLElement | null)?.closest('[role="dialog"]'))
                  event.preventDefault();
              }}
              // In a title being typed it takes the typing back, not the list away.
              onEscapeKeyDown={(event) => {
                if ((event.target as HTMLElement | null)?.closest('[data-chat-rename]'))
                  event.preventDefault();
              }}
            >
              <ChatPanelList
                projectKey={projectKey}
                agents={agents}
                chats={chats}
                onPicked={() => setOpen(false)}
              />
            </PopoverContent>
          </Popover>
          <span role="status" className="flex shrink-0">
            <WorkingCount
              count={answering}
              label={t('othersAnswering', { count: answering })}
              className="text-muted-foreground"
            />
          </span>
        </>
      )}

      <span className="flex-1" />
      {/* A chat that has not started has no thread, and neither has one with an agent
          that keeps no memory, so there is nothing to star for either. */}
      {active.threadId && (
        <ChatPanelFavorite
          projectKey={projectKey}
          thread={{ id: active.threadId, agentId: active.agentId }}
        />
      )}
      {!wide && (
        <Button
          variant="ghost"
          size="icon"
          className="size-7 shrink-0 text-muted-foreground hover:text-foreground"
          title={t('newChat')}
          onClick={() => chats.newChat()}
        >
          <Plus />
          <span className="sr-only">{t('newChat')}</span>
        </Button>
      )}
    </div>
  );
}
