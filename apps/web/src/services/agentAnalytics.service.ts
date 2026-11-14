import { keepPreviousData, useQuery } from '@tanstack/react-query';
import {
  getTeamAgentAnalytics,
  getWorkspaceAgentAnalytics,
} from '@/lib/api/endpoints/agentAnalytics';
import { qk } from '@/services/queryKeys';

export function useTeamAgentAnalyticsQuery(
  teamId: number | null,
  days: number,
  projectIds: number[],
) {
  return useQuery({
    queryKey: qk.agentAnalytics(teamId ?? 0, days, projectIds),
    queryFn: () => getTeamAgentAnalytics(teamId!, days, projectIds),
    enabled: teamId != null,
    placeholderData: keepPreviousData,
  });
}

export function useWorkspaceAgentAnalyticsQuery(workspaceId: number, days: number) {
  return useQuery({
    queryKey: qk.workspaceAgentAnalytics(workspaceId, days),
    queryFn: () => getWorkspaceAgentAnalytics(workspaceId, days),
    placeholderData: keepPreviousData,
  });
}
