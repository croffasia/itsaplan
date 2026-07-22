'use client';

import { Bot, Sparkles } from 'lucide-react';
import type { AiAgent } from '@/lib/api';
import { cn } from '@/lib/utils';
import { agentModelLabel } from '../../utils/agentModelLabel';

// The left rail of the AI Chat page: the internal agents to chat with.
export function AiChatAgentRail({
  agents,
  selectedId,
  onSelect,
  providerLabel,
}: {
  agents: AiAgent[];
  selectedId: number | null;
  onSelect: (id: number) => void;
  providerLabel: (key: string) => string;
}) {
  return (
    <div className="flex w-72 shrink-0 flex-col border-r bg-muted/30">
      <div className="border-b px-4 py-3">
        <div className="text-sm font-semibold">Agents</div>
        <div className="text-xs text-muted-foreground">
          {agents.length} {agents.length === 1 ? 'agent' : 'agents'} available
        </div>
      </div>
      <div className="min-h-0 flex-1 space-y-0.5 overflow-y-auto p-2">
        {agents.map((agent) => {
          const active = agent.id === selectedId;
          return (
            <button
              key={agent.id}
              type="button"
              onClick={() => onSelect(agent.id)}
              aria-pressed={active}
              className={cn(
                'flex w-full items-start gap-2.5 rounded-lg px-2.5 py-2 text-left transition-colors',
                active ? 'bg-accent' : 'hover:bg-accent/50',
              )}
            >
              <div
                className={cn(
                  'mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md border',
                  active
                    ? 'border-primary/20 bg-primary/10 text-primary'
                    : 'bg-background text-muted-foreground',
                )}
              >
                <Bot className="size-4" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium">{agent.name}</div>
                <div className="truncate text-xs text-muted-foreground">@{agent.username}</div>
                <div className="mt-1 flex items-center gap-1 text-xs text-muted-foreground/80">
                  <Sparkles className="size-3 shrink-0" />
                  <span className="truncate">{agentModelLabel(agent, providerLabel)}</span>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
