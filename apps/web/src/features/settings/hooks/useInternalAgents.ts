import { useAiAgentsQuery } from '@/services/aiAgents.service';

// Internal agents of a project: the only agents a schedule can run. Shared by the
// Schedules page header (which hides its add button when there are none) and the
// list itself.
export function useInternalAgents(projectKey: string | null) {
  const query = useAiAgentsQuery(projectKey);
  const agents = (query.data ?? []).filter((agent) => agent.kind === 'internal');
  return { ...query, agents };
}
