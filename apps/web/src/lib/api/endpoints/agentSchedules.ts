import { request } from '@/lib/api/core/client';
import type { AgentRunStatus } from '@/lib/api/endpoints/agents';
import { pageQuery, type Page, type PageParams } from '@/lib/api/core/paging';

export interface AgentSchedule {
  id: number;
  agentId: number;
  agentName: string;
  name: string;
  prompt: string;
  cron: string;
  timezone: 'UTC';
  status: 'active' | 'paused';
  nextRunAt: string;
  lastRunAt: string | null;
  lastRunStatus: AgentRunStatus | null;
  pendingRuns: number;
  // False when the agent's runner is scoped to another member, who alone may run or
  // stop it.
  canTrigger: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AgentScheduleInput {
  agentId: number;
  name: string;
  prompt: string;
  cron: string;
  status?: 'active' | 'paused';
}

export interface AgentScheduleRun {
  id: number;
  status: AgentRunStatus;
  trigger: 'schedule' | 'manual';
  prompt: string;
  attempts: number;
  lastError: string | null;
  output: string | null;
  // What the last model call of the run read and wrote: absent for a run that finished
  // before this was recorded and for one whose agent reports no counts.
  contextTokens?: number;
  scheduledFor: string | null;
  startedAt: string | null;
  finishedAt: string | null;
  createdAt: string;
}

export const listAgentSchedules = (projectKey: string, params: PageParams) =>
  request<Page<AgentSchedule>>(`/projects/${projectKey}/agent-schedules${pageQuery(params)}`);

export const createAgentSchedule = (projectKey: string, input: AgentScheduleInput) =>
  request<AgentSchedule>(`/projects/${projectKey}/agent-schedules`, {
    method: 'POST',
    body: JSON.stringify(input),
  });

export const updateAgentSchedule = (
  projectKey: string,
  scheduleId: number,
  patch: Partial<AgentScheduleInput>,
) =>
  request<AgentSchedule>(`/projects/${projectKey}/agent-schedules/${scheduleId}`, {
    method: 'PATCH',
    body: JSON.stringify(patch),
  });

export const deleteAgentSchedule = (projectKey: string, scheduleId: number) =>
  request<void>(`/projects/${projectKey}/agent-schedules/${scheduleId}`, { method: 'DELETE' });

export const runAgentSchedule = (projectKey: string, scheduleId: number) =>
  request<{ runId: number }>(`/projects/${projectKey}/agent-schedules/${scheduleId}/run`, {
    method: 'POST',
  });

export const listAgentScheduleRuns = (projectKey: string, scheduleId: number) =>
  request<AgentScheduleRun[]>(`/projects/${projectKey}/agent-schedules/${scheduleId}/runs`);

// Ends the schedule's waiting runs — all of them, or the one given.
export const cancelAgentScheduleRuns = (projectKey: string, scheduleId: number, runId?: number) =>
  request<{ canceled: number }>(
    `/projects/${projectKey}/agent-schedules/${scheduleId}/runs${runId != null ? `/${runId}` : ''}/cancel`,
    { method: 'POST' },
  );
