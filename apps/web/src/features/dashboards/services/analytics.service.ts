// Read-only analytics queries behind the dashboard widgets. Each hook wraps an
// api.ts call and is keyed by qk.analytics(projectKey, kind, params) so widgets
// with different windows/filters cache independently. Feature-local: only the
// dashboards feature reads these.

import { useQuery } from '@tanstack/react-query';
import { api, type PulseUnit } from '@/lib/api';
import type { BreakdownBy } from '@/utils/dashboardWidgets';
import { qk } from '@/services/queryKeys';

export function useBreakdownQuery(projectKey: string, by: BreakdownBy) {
  return useQuery({
    queryKey: qk.analytics(projectKey, 'breakdown', { by }),
    queryFn: () => api.getBreakdown(projectKey, by),
  });
}

export function usePulseQuery(projectKey: string, unit: PulseUnit, columns: number) {
  return useQuery({
    queryKey: qk.analytics(projectKey, 'pulse', { unit, columns }),
    queryFn: () => api.getPulse(projectKey, unit, columns),
  });
}

export function useThroughputQuery(projectKey: string, weeks: number) {
  return useQuery({
    queryKey: qk.analytics(projectKey, 'throughput', { weeks }),
    queryFn: () => api.getThroughput(projectKey, weeks),
  });
}

export function useAgentRunsQuery(
  projectKey: string,
  params: { status: string | null; limit: number },
) {
  return useQuery({
    queryKey: qk.analytics(projectKey, 'agent-runs', params),
    queryFn: () => api.getAgentRuns(projectKey, params),
  });
}

export function useAgentRunStatsQuery(projectKey: string, days: number) {
  return useQuery({
    queryKey: qk.analytics(projectKey, 'agent-run-stats', { days }),
    queryFn: () => api.getAgentRunStats(projectKey, days),
  });
}

export function useWebhookStatsQuery(projectKey: string, days: number) {
  return useQuery({
    queryKey: qk.analytics(projectKey, 'webhook-stats', { days }),
    queryFn: () => api.getWebhookStats(projectKey, days),
  });
}

export function useAgentWorkloadQuery(projectKey: string) {
  return useQuery({
    queryKey: qk.analytics(projectKey, 'agent-workload'),
    queryFn: () => api.getAgentWorkload(projectKey),
  });
}

export function useActivityFeedQuery(
  projectKey: string,
  params: { action: string | null; issueIds: number[] | null; limit: number },
) {
  return useQuery({
    queryKey: qk.analytics(projectKey, 'activity', params),
    queryFn: () => api.listActivity(projectKey, params),
  });
}
