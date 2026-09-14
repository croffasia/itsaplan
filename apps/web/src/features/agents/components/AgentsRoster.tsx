import type { AiAgent } from '@/lib/api';
import AgentCard from './AgentCard';

export default function AgentsRoster({
  agents,
  projectKey,
  providerLabel,
}: {
  agents: AiAgent[];
  projectKey: string;
  providerLabel: (key: string) => string;
}) {
  if (agents.length === 0) {
    return (
      <div className="flex min-h-52 items-center justify-center rounded-xl border border-dashed px-6 text-center text-sm text-muted-foreground">
        No agents match these filters.
      </div>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {agents.map((agent) => (
        <AgentCard
          key={agent.id}
          agent={agent}
          projectKey={projectKey}
          providerLabel={providerLabel}
        />
      ))}
    </div>
  );
}
