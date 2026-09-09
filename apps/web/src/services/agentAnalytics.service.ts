import { useQuery } from '@tanstack/react-query';
import {
  getProjectAgentAnalytics,
  getTeamAgentAnalytics,
  type AgentAnalytics,
} from '@/lib/api/endpoints/agentAnalytics';
import { qk } from '@/services/queryKeys';

// The agent dashboard. The two scopes answer the same shape, so the panels take one
// hook and the page picks which side it reads.
export type AgentAnalyticsScope = { teamId: number } | { projectKey: string };

export function useAgentAnalyticsQuery(scope: AgentAnalyticsScope, days: number) {
  const key = 'teamId' in scope ? `team-${scope.teamId}` : `project-${scope.projectKey}`;
  return useQuery<AgentAnalytics>({
    queryKey: qk.agentAnalytics(key, days),
    queryFn: () =>
      'teamId' in scope
        ? getTeamAgentAnalytics(scope.teamId, days)
        : getProjectAgentAnalytics(scope.projectKey, days),
  });
}
