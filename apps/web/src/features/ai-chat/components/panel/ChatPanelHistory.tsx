'use client';

import { useState } from 'react';
import { History } from 'lucide-react';
import { useTranslations } from 'next-intl';
import * as PopoverPrimitive from '@radix-ui/react-popover';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { InputGroupButton } from '@/components/ui/input-group';
import { AiChatThreadList } from '../shared/AiChatThreadList';

// The past conversations with the agent of this session, over the composer. The session
// below stays mounted, so a reply that runs while the list is open goes on.
export function ChatPanelHistory({
  projectKey,
  agentId,
  agentName,
  selectedThreadId,
  onSelect,
  onDeleted,
}: {
  projectKey: string;
  agentId: number;
  agentName: string;
  selectedThreadId: string | null;
  onSelect: (threadId: string) => void;
  onDeleted: (threadId: string) => void;
}) {
  const t = useTranslations('aiChat');
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <InputGroupButton
          type="button"
          variant="ghost"
          size="icon-xs"
          className="rounded-md text-muted-foreground hover:text-foreground"
          title={t('history')}
        >
          <History />
          <span className="sr-only">{t('history')}</span>
        </InputGroupButton>
      </PopoverTrigger>
      <PopoverContent
        align="center"
        className="flex h-[28rem] max-h-(--radix-popover-content-available-height) w-96 flex-col p-0"
        // Picking a conversation hides the session this popover is anchored to, and a
        // hidden trigger reports a zero rect in the top left corner, where the popover
        // would be moved while it plays its closing animation. Without that animation it
        // is gone in the same frame, so there is none it could be seen in.
        style={open ? undefined : { animation: 'none' }}
        // The delete confirmation opens in a portal of its own, so a click in it counts
        // as outside this popover. The list has to stay mounted for that delete to run.
        onInteractOutside={(event) => {
          if ((event.target as HTMLElement | null)?.closest('[role="dialog"]'))
            event.preventDefault();
        }}
      >
        <PopoverPrimitive.Arrow className="size-2.5 translate-y-[calc(-50%_-_1px)] rotate-45 rounded-[2px] border border-t-0 border-l-0 bg-popover fill-popover" />

        <div className="flex min-w-0 items-baseline gap-1.5 border-b px-3 py-2">
          <span className="text-sm font-medium">{t('history')}</span>
          <span className="truncate text-xs text-muted-foreground">{agentName}</span>
        </div>

        <AiChatThreadList
          projectKey={projectKey}
          agentId={agentId}
          selectedThreadId={selectedThreadId}
          onSelect={(threadId) => {
            setOpen(false);
            onSelect(threadId);
          }}
          onDeleted={onDeleted}
        />
      </PopoverContent>
    </Popover>
  );
}
