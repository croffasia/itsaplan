import { request } from '@/lib/api/core/client';

// The agent dashboard, read either for a whole team or for one project. Both answer
// the same shape, so one set of panels renders either scope.

// A headline figure of the window. `cost` is USD, and null where the price table
// names none of the models the window used.
export interface AgentAnalyticsTotals {
  runs: number;
  errors: number;
  inputTokens: number;
  outputTokens: number;
  toolCalls: number;
  cost: number | null;
}

export interface AgentAnalyticsModel {
  provider: string;
  model: string;
  calls: number;
  inputTokens: number;
  outputTokens: number;
  cost: number | null;
}

export interface AgentAnalyticsAgent {
  agentId: number;
  name: string;
  runs: number;
  errors: number;
  inputTokens: number;
  outputTokens: number;
  cost: number | null;
}

export interface AgentAnalyticsDay {
  day: string;
  inputTokens: number;
  outputTokens: number;
  cost: number | null;
}

export interface AgentAnalyticsTool {
  name: string;
  calls: number;
  errors: number;
}

export interface AgentAnalyticsLatency {
  day: string;
  p50: number;
  p95: number;
}

export interface AgentAnalytics {
  from: string;
  to: string;
  totals: AgentAnalyticsTotals;
  // The same span before the window, which every headline figure is compared against.
  previous: AgentAnalyticsTotals;
  threads: number;
  models: AgentAnalyticsModel[];
  agents: AgentAnalyticsAgent[];
  tokensPerDay: AgentAnalyticsDay[];
  tools: AgentAnalyticsTool[];
  latencyPerDay: AgentAnalyticsLatency[];
}

export const getTeamAgentAnalytics = (teamId: number, days: number) =>
  request<AgentAnalytics>(`/teams/${teamId}/agent-analytics?days=${days}`);

export const getProjectAgentAnalytics = (projectKey: string, days: number) =>
  request<AgentAnalytics>(`/projects/${projectKey}/agent-analytics?days=${days}`);
