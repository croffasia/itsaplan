'use client';

import { Bot, Check, ChevronDown, History, MessageSquarePlus } from 'lucide-react';
import type { AiAgent } from '@/lib/api';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { agentModelLabel } from '../../utils/agentModelLabel';

// The top bar of the floating chat: the agent picker plus the history, new-chat and
// minimize actions. `selected` is null when the project has no internal agents, which
// disables everything but minimize.
export function FloatingChatHeader({
  agents,
  providerLabel,
  selected,
  onSelectAgent,
  onShowHistory,
  onNewChat,
  onMinimize,
}: {
  agents: AiAgent[];
  providerLabel: (key: string) => string;
  selected: AiAgent | null;
  onSelectAgent: (id: number) => void;
  onShowHistory: () => void;
  onNewChat: () => void;
  onMinimize: () => void;
}) {
  return (
    <div className="flex items-center gap-1 border-b px-2.5 py-2">
      <DropdownMenu>
        <DropdownMenuTrigger asChild disabled={!selected}>
          <button
            type="button"
            className="flex min-w-0 flex-1 items-center gap-2 rounded-md px-1.5 py-1 text-left transition-colors hover:bg-accent"
          >
            <div className="flex size-7 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
              <Bot className="size-4" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm leading-tight font-medium">
                {selected?.name ?? 'No agents'}
              </div>
              <div className="truncate text-xs leading-tight text-muted-foreground">
                {selected ? `@${selected.username}` : 'Add an internal agent'}
              </div>
            </div>
            {selected && <ChevronDown className="size-4 shrink-0 text-muted-foreground" />}
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-64">
          <DropdownMenuLabel>Agents</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {agents.map((agent) => (
            <DropdownMenuItem
              key={agent.id}
              onSelect={() => onSelectAgent(agent.id)}
              className="gap-2"
            >
              <Bot className="size-4 shrink-0" />
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm">{agent.name}</div>
                <div className="truncate text-xs text-muted-foreground">
                  {agentModelLabel(agent, providerLabel)}
                </div>
              </div>
              {agent.id === selected?.id && <Check className="size-4 shrink-0" />}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      <Button
        variant="ghost"
        size="icon"
        className="size-7 shrink-0 text-muted-foreground hover:text-foreground"
        title="History"
        disabled={!selected}
        onClick={onShowHistory}
      >
        <History />
        <span className="sr-only">History</span>
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className="size-7 shrink-0 text-muted-foreground hover:text-foreground"
        title="New chat"
        disabled={!selected}
        onClick={onNewChat}
      >
        <MessageSquarePlus />
        <span className="sr-only">New chat</span>
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className="size-7 shrink-0 text-muted-foreground hover:text-foreground"
        title="Minimize"
        onClick={onMinimize}
      >
        <ChevronDown />
        <span className="sr-only">Minimize chat</span>
      </Button>
    </div>
  );
}
