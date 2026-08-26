'use client';

import { useState } from 'react';
import { Bot, X } from 'lucide-react';
import type { AiAgent } from '@/lib/api';
import { useAiAgentsQuery } from '@/services/aiAgents.service';
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetTitle,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { AgentChatPanel } from '@/components/common/agent-chat/AgentChatPanel';
import { useAgentChat } from '@/hooks/useAgentChat';
import { AgentSheetForm } from './AgentSheetForm';
import { useTranslations } from 'next-intl';

// Full-width sheet for one agent. Opened for create (agent null) or to edit an
// existing one. Create and edit share the same form (AgentSheetForm): on create the
// sheet stays open and switches to editing the new agent. An internal agent also gets
// the test chat, shown alongside the form.
export function SettingsAiAgentSheet({
  projectKey,
  open,
  agent,
  onClose,
}: {
  projectKey: string;
  open: boolean;
  agent: AiAgent | null;
  onClose: () => void;
}) {
  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      {/* The built-in close button is pinned to the far top-right corner, which drifts
          away from the header controls at full width. Hide it (it is the only direct
          <button> child of SheetContent) and render our own in the header. */}
      {/* duration-0 cancels the slide-in/out animation from SheetContent so the
          full-screen editor appears at once instead of sliding in from the right. */}
      <SheetContent
        side="right"
        className="w-full gap-0 p-0 duration-0 data-[state=closed]:duration-0 data-[state=open]:duration-0 sm:max-w-none [&>button]:hidden"
      >
        {/* Key by agent (or 'new' for create) so switching gives a fresh form and chat
            session; create keeps the 'new' key while it becomes edit, so no remount. */}
        {open && (
          <SheetBody key={agent?.id ?? 'new'} projectKey={projectKey} initialAgent={agent} />
        )}
      </SheetContent>
    </Sheet>
  );
}

function SheetBody({
  projectKey,
  initialAgent,
}: {
  projectKey: string;
  initialAgent: AiAgent | null;
}) {
  const t = useTranslations('settings.agents');
  const tCommon = useTranslations('common');
  // The agent just created in this sheet, if any. Once set, the form switches from
  // create to edit for it without remounting.
  const [createdAgent, setCreatedAgent] = useState<AiAgent | null>(null);
  // The create response is a snapshot; re-read the row from the list so a key
  // regenerated in this sheet updates the prefix it shows.
  const agents = useAiAgentsQuery(projectKey).data ?? [];
  const created = createdAgent && (agents.find((a) => a.id === createdAgent.id) ?? createdAgent);

  const agent = initialAgent ?? created;
  // Held here so the transcript and thread survive re-renders. No agent yet during
  // create → id 0; the chat is only reachable once the agent exists.
  const chat = useAgentChat(projectKey, agent?.id ?? 0, agent?.kind === 'external');

  // The sheet is always full width: an existing agent shows the form and the chat side
  // by side; while creating one there is nothing to chat with, so the form takes the
  // full width on its own.
  const split = !!agent;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center gap-3 border-b border-border/60 px-5 pt-4 pb-3.5">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground ring-1 ring-border/60">
          <Bot className="size-4.5" />
        </div>
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <div className="min-w-0">
            <SheetTitle className="truncate text-sm">
              {agent ? agent.name : t('newAgent')}
            </SheetTitle>
            <SheetDescription className="truncate text-xs">
              {agent ? `@${agent.username}` : t('sheetSubtitle')}
            </SheetDescription>
          </div>
          {agent && (
            <span className="shrink-0 rounded-full bg-secondary px-2 py-0.5 text-[10px] font-medium tracking-wide text-muted-foreground uppercase">
              {agent.kind}
            </span>
          )}
        </div>
        <SheetClose asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-8 shrink-0 text-muted-foreground hover:text-foreground"
            aria-label={tCommon('close')}
          >
            <X className="size-4" />
          </Button>
        </SheetClose>
      </div>

      <div className="flex min-h-0 flex-1">
        <div
          className={`flex min-h-0 flex-1 flex-col ${split ? 'basis-0 border-e border-border/60' : ''}`}
        >
          <AgentSheetForm
            projectKey={projectKey}
            agent={agent}
            expanded
            onCreated={setCreatedAgent}
          />
        </div>

        {split && (
          <div className="flex min-h-0 flex-1 basis-0 flex-col">
            <AgentChatPanel
              agent={agent}
              projectKey={projectKey}
              messages={chat.messages}
              status={chat.status}
              activeTool={chat.activeTool}
              pending={chat.pending}
              onSend={chat.send}
              onStop={chat.stop}
              onRemovePending={chat.removePending}
              onReset={chat.newChat}
            />
          </div>
        )}
      </div>
    </div>
  );
}
