import { request } from '@/lib/api/core/client';
import type { AgentRunStatus } from '@/lib/api/endpoints/agents';
import { pageQuery, type Page, type PageParams } from '@/lib/api/core/paging';

// 'cron' runs on its cron; 'status' runs on an issue each time one enters its column.
// Any other is a type the hosted build adds, in its own schedule dialog.
export type AgentScheduleType = string;

// Settings the hosted build keeps on a schedule; {} on a self-hosted instance.
export type AgentScheduleOptions = Record<string, unknown>;

export interface AgentSchedule {
  id: number;
  agentId: number;
  agentName: string;
  name: string;
  type: AgentScheduleType;
  // Empty on a status schedule that sends no task of its own.
  prompt: string;
  // Set on a cron schedule only, as is nextRunAt.
  cron: string | null;
  timezone: 'UTC';
  // Set on a status schedule only.
  columnId: number | null;
  delaySec: number;
  options: AgentScheduleOptions;
  status: 'active' | 'paused';
  nextRunAt: string | null;
  lastRunAt: string | null;
  lastRunStatus: AgentRunStatus | null;
  pendingRuns: number;
  // False when the agent's runner is scoped to another member, who alone may run or
  // stop it.
  canTrigger: boolean;
  createdAt: string;
  updatedAt: string;
}

// `type` is set on a create only: a schedule keeps the type it was created with.
export interface AgentScheduleInput {
  agentId: number;
  name: string;
  type?: AgentScheduleType;
  prompt: string;
  cron?: string;
  columnId?: number;
  delaySec?: number;
  options?: AgentScheduleOptions;
  status?: 'active' | 'paused';
}

export interface AgentScheduleRun {
  id: number;
  status: AgentRunStatus;
  trigger: 'schedule' | 'manual' | 'status' | 'event';
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
