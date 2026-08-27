import { t } from 'elysia';

import { runContextTokens } from '../model';

export const scheduleParams = t.Object({
  projectKey: t.String(),
  scheduleId: t.Numeric({ description: 'Schedule id from list_agent_schedules.' }),
});

export const scheduleRunParams = t.Object({
  projectKey: t.String(),
  scheduleId: t.Numeric({ description: 'Schedule id from list_agent_schedules.' }),
  runId: t.Numeric({ description: 'Run id from list_agent_schedule_runs.' }),
});

export const scheduleStatus = t.UnionEnum(['active', 'paused'], {
  description: "'active' runs on the cron, 'paused' does not run until it is set back to 'active'.",
});

export const createScheduleBody = t.Object({
  agentId: t.Number({ description: 'Internal agent id from list_ai_agents that runs the task.' }),
  name: t.String({ minLength: 1, maxLength: 120, description: 'Display name of the schedule.' }),
  prompt: t.String({
    minLength: 1,
    maxLength: 20_000,
    description: 'Task sent to the agent on every run.',
  }),
  cron: t.String({
    minLength: 1,
    maxLength: 120,
    description: "Five-field cron expression in UTC, e.g. '0 9 * * 1' for Mondays at 09:00.",
  }),
  status: t.Optional(scheduleStatus),
});

export const updateScheduleBody = t.Partial(createScheduleBody);

// A schedule DTO (AgentScheduleRow from the service).
export const AgentScheduleResponse = t.Object({
  id: t.Number(),
  agentId: t.Number(),
  agentName: t.String(),
  name: t.String(),
  prompt: t.String(),
  cron: t.String(),
  timezone: t.Literal('UTC'),
  status: scheduleStatus,
  nextRunAt: t.String(),
  lastRunAt: t.Nullable(t.String()),
  lastRunStatus: t.Nullable(t.String()),
  pendingRuns: t.Number({ description: 'Runs of this schedule that have not started yet.' }),
  canTrigger: t.Boolean({
    description:
      "Whether you may run or stop this schedule; an 'owner'-scoped agent serves its owner only.",
  }),
  createdAt: t.String(),
  updatedAt: t.String(),
});

export const AgentScheduleListResponse = t.Array(AgentScheduleResponse);

// One run of a schedule (ScheduleRunRow from the service), with the agent's answer in
// `output` once the run has finished.
export const ScheduleRunResponse = t.Object({
  id: t.Number(),
  status: t.String(),
  trigger: t.String(),
  prompt: t.String(),
  attempts: t.Number(),
  lastError: t.Nullable(t.String()),
  output: t.Nullable(t.String()),
  contextTokens: runContextTokens,
  scheduledFor: t.Nullable(t.String()),
  startedAt: t.Nullable(t.String()),
  finishedAt: t.Nullable(t.String()),
  createdAt: t.String(),
});

export const ScheduleRunListResponse = t.Array(ScheduleRunResponse);

export const QueuedRunResponse = t.Object({ runId: t.Number() });

export const CanceledRunsResponse = t.Object({
  canceled: t.Number({ description: 'How many pending runs were ended.' }),
});
