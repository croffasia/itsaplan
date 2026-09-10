import type { BreakdownBy } from '@/utils/dashboardWidgets';
import type { AgentRunStatus } from '@/lib/api/endpoints/agents';
import { request } from '@/lib/api/core/client';
import type { ActivityPage, FeedCursor } from '@/lib/api/endpoints/activity';

export interface AnalyticsStats {
  open: number;
  inProgress: number;
  backlog: number;
  overdue: number;
  unassigned: number;
  closedLast7d: number;
}

export interface BreakdownItem {
  key: string;
  label: string;
  count: number;
  color: string | null;
}

export type PulseUnit = 'hour' | 'day' | 'week';

// One heatmap cell from the server: a preformatted bucket label (for the hover
// tooltip) and its activity count. The series is ordered oldest to newest.
export interface PulseBucket {
  label: string;
  count: number;
}

export interface ThroughputWeek {
  week: string;
  created: number;
  closed: number;
}

// One agent run in the project-wide feed (agent runs widget).
export interface AgentRunFeedItem {
  id: number;
  status: AgentRunStatus;
  trigger: 'mention' | 'delegation' | 'field' | 'schedule' | 'manual';
  agentId: number;
  agentName: string;
  issueId: number | null;
  issueSequence: number | null;
  lastError: string | null;
  createdAt: string;
}

// Agent run outcome counts over a window (agent health widget).
export interface AgentRunStats {
  total: number;
  success: number;
  failed: number;
  pending: number;
}

// Webhook delivery health over a window plus the subscription split (webhook health widget).
export interface WebhookStats {
  total: number;
  success: number;
  failed: number;
  pending: number;
  activeWebhooks: number;
  disabledWebhooks: number;
}

// One agent's workload row: delegated open issues and lifetime run outcomes.
export interface AgentWorkloadItem {
  agentId: number;
  agentName: string;
  kind: string;
  delegatedOpen: number;
  runsTotal: number;
  runsSuccess: number;
  runsFailed: number;
}

// Analytics — read-only project metrics behind the dashboard widgets.
export const getBreakdown = (projectKey: string, by: BreakdownBy) =>
  request<BreakdownItem[]>(`/projects/${projectKey}/analytics/breakdown?by=${by}`);

export const getPulse = (
  projectKey: string,
  unit: PulseUnit,
  columns: number,
  scope: 'project' | 'me' = 'project',
) =>
  request<PulseBucket[]>(
    `/projects/${projectKey}/analytics/pulse?unit=${unit}&columns=${columns}&scope=${scope}`,
  );

export const getThroughput = (projectKey: string, weeks = 12) =>
  request<ThroughputWeek[]>(`/projects/${projectKey}/analytics/throughput?weeks=${weeks}`);

export const listActivity = (
  projectKey: string,
  params: {
    cursor?: FeedCursor | null;
    limit?: number;
    actorUserId?: string | null;
    action?: string | null;
    issueIds?: number[] | null;
  } = {},
) => {
  const q = new URLSearchParams();
  if (params.limit) q.set('limit', String(params.limit));
  if (params.cursor) q.set('cursor', JSON.stringify(params.cursor));
  if (params.actorUserId != null) q.set('actorUserId', params.actorUserId);
  if (params.action) q.set('action', params.action);
  if (params.issueIds) q.set('issueIds', params.issueIds.join(','));
  const qs = q.toString();
  return request<ActivityPage>(`/projects/${projectKey}/analytics/activity${qs ? `?${qs}` : ''}`);
};

export const getAgentRuns = (
  projectKey: string,
  params: { status?: string | null; limit?: number } = {},
) => {
  const q = new URLSearchParams();
  if (params.status) q.set('status', params.status);
  if (params.limit) q.set('limit', String(params.limit));
  const qs = q.toString();
  return request<AgentRunFeedItem[]>(
    `/projects/${projectKey}/analytics/agent-runs${qs ? `?${qs}` : ''}`,
  );
};

export const getAgentRunStats = (projectKey: string, days = 30) =>
  request<AgentRunStats>(`/projects/${projectKey}/analytics/agent-run-stats?days=${days}`);

export const getWebhookStats = (projectKey: string, days = 30) =>
  request<WebhookStats>(`/projects/${projectKey}/analytics/webhook-stats?days=${days}`);

export const getAgentWorkload = (projectKey: string) =>
  request<AgentWorkloadItem[]>(`/projects/${projectKey}/analytics/agent-workload`);
