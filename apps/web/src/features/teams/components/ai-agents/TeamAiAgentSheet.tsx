'use client';

import { useState } from 'react';
import { Bot, MessageSquare, X } from 'lucide-react';
import { AGENT_KIND_ICON } from '../../utils/agentKindIcon';
import type { AiAgent } from '@/lib/api/endpoints/agents';
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
import { useAgentSection } from '../../context/agentSection';
import { AgentSheetForm } from './AgentSheetForm';
import { useTranslations } from 'next-intl';

// Full-width sheet for one agent. Opened for create (agent null) or to edit an
// existing one. Create and edit share the same form (AgentSheetForm): on create the
// sheet stays open and switches to editing the new agent. An internal agent also gets
// the test chat, shown alongside the form.
export function TeamAiAgentSheet({
  open,
  agent,
  onClose,
}: {
  open: boolean;
  agent: AiAgent | null;
  // The project a new agent starts attached to, when the sheet is opened from one.
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
        {open && <SheetBody key={agent?.id ?? 'new'} initialAgent={agent} />}
      </SheetContent>
    </Sheet>
  );
}

function SheetBody({ initialAgent }: { initialAgent: AiAgent | null }) {
  const t = useTranslations('teams.agents');
  const tCommon = useTranslations('common');
  const { teamId } = useAgentSection();
  // The agent just created in this sheet, if any. Once set, the form switches from
  // create to edit for it without remounting.
  const [createdAgent, setCreatedAgent] = useState<AiAgent | null>(null);
  // The create response is a snapshot; re-read the row from the list so a key
  // regenerated in this sheet updates the prefix it shows.
  const agents = useAiAgentsQuery(teamId).data ?? [];
  const created = createdAgent && (agents.find((a) => a.id === createdAgent.id) ?? createdAgent);

  const agent = initialAgent ?? created;
  // A chat is held inside a project, so it runs in the first project the agent works
  // in. An agent attached to none has nothing to chat in.
  const chatProject = agent?.projects[0] ?? null;
  // Held here so the transcript and thread survive re-renders. No agent yet during
  // create → id 0; the chat is only reachable once the agent exists.
  const chat = useAgentChat(chatProject?.key ?? '', agent?.id ?? 0, agent?.kind === 'external');

  // The form and the test chat always sit side by side, so the sheet keeps its shape
  // from create through edit. There is nothing to chat in until the agent exists and
  // works in a project, and until then the chat side says what is missing.
  const chatReady = !!agent && chatProject != null;
  const KindIcon = agent ? AGENT_KIND_ICON[agent.kind] : Bot;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center gap-3 border-b border-border/60 px-5 pt-4 pb-3.5">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground ring-1 ring-border/60">
          <KindIcon className="size-4.5" />
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
        <div className="flex min-h-0 flex-1 basis-0 flex-col border-e border-border/60">
          <AgentSheetForm agent={agent} expanded onCreated={setCreatedAgent} />
        </div>

        <div className="flex min-h-0 flex-1 basis-0 flex-col">
          {chatReady ? (
            <AgentChatPanel
              agent={agent}
              projectKey={chatProject.key}
              messages={chat.messages}
              status={chat.status}
              activeTool={chat.activeTool}
              pending={chat.pending}
              onSend={chat.send}
              onStop={chat.stop}
              onRemovePending={chat.removePending}
              onReset={chat.newChat}
            />
          ) : (
            <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-2 px-6 text-center">
              <MessageSquare className="size-5 text-muted-foreground" />
              <p className="text-sm font-medium">{t('testChat')}</p>
              <p className="max-w-xs text-xs text-muted-foreground">
                {agent ? t('chatNeedsProject') : t('chatNeedsAgent')}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
