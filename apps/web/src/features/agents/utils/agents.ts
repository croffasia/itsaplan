import type { AiAgent } from '@/lib/api';

export type AgentFilter = 'all' | 'internal' | 'external';

export function isMainAssistant(agent: AiAgent): boolean {
  return agent.username.toLowerCase() === 'bob-agent' || agent.name.toLowerCase() === 'bob';
}

export function filterAgents(agents: AiAgent[], filter: AgentFilter, search: string): AiAgent[] {
  const query = search.trim().toLowerCase();

  return agents
    .filter((agent) => filter === 'all' || agent.kind === filter)
    .filter(
      (agent) =>
        query.length === 0 ||
        agent.name.toLowerCase().includes(query) ||
        agent.username.toLowerCase().includes(query) ||
        agent.model?.toLowerCase().includes(query),
    )
    .sort((left, right) => {
      const mainOrder = Number(isMainAssistant(right)) - Number(isMainAssistant(left));
      return mainOrder || left.name.localeCompare(right.name);
    });
}
