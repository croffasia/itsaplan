// Read-only analytics queries behind the dashboard widgets. Each hook wraps an
// api.ts call and is keyed by qk.analytics(projectKey, kind, params) so widgets
// with different windows/filters cache independently. Feature-local: only the
// dashboards feature reads these.

import { useQuery } from '@tanstack/react-query';
import {
  type PulseUnit,
  getBreakdown,
  getPulse,
  getThroughput,
  getAgentRuns,
  getAgentRunStats,
  getWebhookStats,
  getAgentWorkload,
  listActivity,
} from '@/lib/api/endpoints/analytics';
import type { BreakdownBy } from '@/utils/dashboardWidgets';
import { qk } from '@/services/queryKeys';

export function useBreakdownQuery(projectKey: string, by: BreakdownBy) {
  return useQuery({
    queryKey: qk.analytics(projectKey, 'breakdown', { by }),
    queryFn: () => getBreakdown(projectKey, by),
  });
}

export function usePulseQuery(projectKey: string, unit: PulseUnit, columns: number) {
  return useQuery({
    queryKey: qk.analytics(projectKey, 'pulse', { unit, columns }),
    queryFn: () => getPulse(projectKey, unit, columns),
  });
}

export function useThroughputQuery(projectKey: string, weeks: number) {
  return useQuery({
    queryKey: qk.analytics(projectKey, 'throughput', { weeks }),
    queryFn: () => getThroughput(projectKey, weeks),
  });
}

export function useAgentRunsQuery(
  projectKey: string,
  params: { status: string | null; limit: number },
) {
  return useQuery({
    queryKey: qk.analytics(projectKey, 'agent-runs', params),
    queryFn: () => getAgentRuns(projectKey, params),
  });
}

export function useAgentRunStatsQuery(projectKey: string, days: number) {
  return useQuery({
    queryKey: qk.analytics(projectKey, 'agent-run-stats', { days }),
    queryFn: () => getAgentRunStats(projectKey, days),
  });
}

export function useWebhookStatsQuery(projectKey: string, days: number) {
  return useQuery({
    queryKey: qk.analytics(projectKey, 'webhook-stats', { days }),
    queryFn: () => getWebhookStats(projectKey, days),
  });
}

export function useAgentWorkloadQuery(projectKey: string) {
  return useQuery({
    queryKey: qk.analytics(projectKey, 'agent-workload'),
    queryFn: () => getAgentWorkload(projectKey),
  });
}

export function useActivityFeedQuery(
  projectKey: string,
  params: { action: string | null; issueIds: number[] | null; limit: number },
) {
  return useQuery({
    queryKey: qk.analytics(projectKey, 'activity', params),
    queryFn: () => listActivity(projectKey, params),
  });
}
