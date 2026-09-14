import { Bot } from 'lucide-react';
import type { AiAgent, HermesChatAgent } from '@/lib/api';
import { cn } from '@/lib/utils';

export function AiChatAgentList({
  agents,
  selectedId,
  onSelect,
  hermesAgents,
}: {
  agents: AiAgent[];
  selectedId: number | null;
  onSelect: (id: number) => void;
  hermesAgents: HermesChatAgent[];
}) {
  return (
    <div className="max-h-64 space-y-1 overflow-y-auto border-b p-2">
      {agents.map((agent) => {
        const main = agent.name.toLowerCase() === 'bob' || agent.username === 'bob-agent';
        const status = hermesAgents.find((candidate) => candidate.id === agent.id)?.status;
        return (
          <button
            key={agent.id}
            type="button"
            onClick={() => onSelect(agent.id)}
            className={cn(
              'flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition-colors',
              selectedId === agent.id
                ? 'border-primary/30 bg-primary/5'
                : 'border-transparent hover:bg-accent/50',
            )}
          >
            <span className="flex size-9 shrink-0 items-center justify-center rounded-lg border bg-background">
              <Bot className="size-4" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-2">
                <span className="truncate text-sm font-medium">{agent.name}</span>
                {main && (
                  <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] font-medium">
                    Main
                  </span>
                )}
              </span>
              <span className="block truncate text-xs text-muted-foreground">
                @{agent.username} · Hermes
              </span>
            </span>
            <span
              className={cn(
                'size-2 rounded-full',
                status === 'ready' ? 'bg-emerald-500' : 'bg-destructive',
              )}
            />
          </button>
        );
      })}
      {agents.length === 0 && (
        <p className="px-3 py-6 text-center text-xs text-muted-foreground">No agents found.</p>
      )}
    </div>
  );
}
