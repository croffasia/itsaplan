'use client';

import { useState } from 'react';
import { Bot, X } from 'lucide-react';
import type { AiAgent } from '@/lib/api';
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
  // The agent just created in this sheet, if any. Once set, the form switches from
  // create to edit for it without remounting.
  const [createdAgent, setCreatedAgent] = useState<AiAgent | null>(null);
  // A new external agent's plaintext key, revealed once inline after create.
  const [revealedKey, setRevealedKey] = useState<string | null>(null);

  const agent = initialAgent ?? createdAgent;
  const canTest = agent?.kind === 'internal';
  // Held here so the transcript and thread survive re-renders. No agent yet during
  // create → id 0; the chat is only reachable once the agent exists.
  const chat = useAgentChat(projectKey, agent?.id ?? 0);

  function onCreated(created: AiAgent, apiKey: string | null) {
    setCreatedAgent(created);
    setRevealedKey(apiKey);
  }

  // The sheet is always full width: a testable agent shows the form and the chat side
  // by side; otherwise the form takes the full width on its own.
  const split = canTest && !!agent;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center gap-3 border-b border-border/60 px-5 pt-4 pb-3.5">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground ring-1 ring-border/60">
          <Bot className="size-4.5" />
        </div>
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <div className="min-w-0">
            <SheetTitle className="truncate text-sm">{agent ? agent.name : 'New agent'}</SheetTitle>
            <SheetDescription className="truncate text-xs">
              {agent ? `@${agent.username}` : 'A bot user you can delegate issues to'}
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
            aria-label="Close"
          >
            <X className="size-4" />
          </Button>
        </SheetClose>
      </div>

      <div className="flex min-h-0 flex-1">
        <div
          className={`flex min-h-0 flex-1 flex-col ${split ? 'basis-0 border-r border-border/60' : ''}`}
        >
          <AgentSheetForm
            projectKey={projectKey}
            agent={agent}
            expanded
            onCreated={onCreated}
            revealedKey={revealedKey}
            onDismissKey={() => setRevealedKey(null)}
          />
        </div>

        {split && (
          <div className="flex min-h-0 flex-1 basis-0 flex-col">
            <AgentChatPanel
              agent={agent}
              messages={chat.messages}
              status={chat.status}
              activeTool={chat.activeTool}
              onSend={chat.send}
              onReset={chat.newChat}
            />
          </div>
        )}
      </div>
    </div>
  );
}
