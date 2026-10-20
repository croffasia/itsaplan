import { request } from '@/lib/api/core/client';

// What a group of model calls read, wrote and cost. `cost` is USD, and null where the
// price table names none of the models the group used.
export interface AgentUsage {
  inputTokens: number;
  outputTokens: number;
  cost: number | null;
}

export interface AgentAnalyticsTotals extends AgentUsage {
  runs: number;
  errors: number;
}

export interface AgentAnalytics {
  from: string;
  to: string;
  totals: AgentAnalyticsTotals;
  // The same span before the window, which every headline figure is compared against.
  previous: AgentAnalyticsTotals;
  models: (AgentUsage & { provider: string; model: string; calls: number })[];
  agents: (AgentAnalyticsTotals & { agentId: number; name: string })[];
  projects: (AgentAnalyticsTotals & { projectId: number; name: string })[];
  teams: (AgentAnalyticsTotals & { teamId: number; name: string })[];
  tokensPerDay: (AgentUsage & { day: string })[];
}

// What a dashboard reads: one team, all of it or one project of it, or every team of a
// workspace.
export type AgentAnalyticsScope =
  { teamId: number; projectId: number | null } | { workspaceId: number };

// A team's dashboard, with the projects the caller reads it for: what `projectId`
// narrows it to.
export interface TeamAgentAnalytics extends AgentAnalytics {
  readableProjects: { projectId: number; name: string }[];
}

export const getTeamAgentAnalytics = (teamId: number, days: number, projectId: number | null) => {
  const q = new URLSearchParams({ days: String(days) });
  if (projectId != null) q.set('projectId', String(projectId));
  return request<TeamAgentAnalytics>(`/teams/${teamId}/agent-analytics?${q}`);
};

export const getWorkspaceAgentAnalytics = (workspaceId: number, days: number) =>
  request<AgentAnalytics>(`/workspaces/${workspaceId}/agent-analytics?days=${days}`);
