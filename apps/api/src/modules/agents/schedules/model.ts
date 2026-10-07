import { t } from 'elysia';
import { pageQueryFields, pageResponse } from '#shared/pagination';

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
  description: "'active' runs, 'paused' does not run until it is set back to 'active'.",
});

export const scheduleType = t.UnionEnum(['cron', 'status'], {
  description:
    "'cron' runs the task on a cron. 'status' runs on an issue each time one enters a " +
    'column: moved there, or created in it.',
});

export const createScheduleBody = t.Object({
  agentId: t.Number({ description: 'Internal agent id from list_ai_agents that runs the task.' }),
  name: t.String({ minLength: 1, maxLength: 120, description: 'Display name of the schedule.' }),
  type: t.Optional(scheduleType),
  prompt: t.Optional(
    t.String({
      maxLength: 20_000,
      description:
        "Task sent to the agent on every run. Required for a 'cron' schedule. Optional for " +
        "a 'status' one, whose run already names the issue and the column it entered.",
    }),
  ),
  cron: t.Optional(
    t.String({
      minLength: 1,
      maxLength: 120,
      description:
        "Five-field cron expression in UTC, e.g. '0 9 * * 1' for Mondays at 09:00. " +
        "Required for a 'cron' schedule, refused on a 'status' one.",
    }),
  ),
  columnId: t.Optional(
    t.Number({
      description:
        "Column id from get_project whose incoming issues start a run. Required for a 'status' " +
        "schedule, refused on a 'cron' one.",
    }),
  ),
  delaySec: t.Optional(
    t.Integer({
      minimum: 0,
      maximum: 86400,
      description:
        "Seconds a 'status' run waits before the agent may pick it up; 0 by default. An issue " +
        "that leaves the column in that time ends the run. Refused on a 'cron' schedule.",
    }),
  ),
  status: t.Optional(scheduleStatus),
});

export const updateScheduleBody = t.Partial(t.Omit(createScheduleBody, ['type']));

// A schedule DTO (AgentScheduleRow from the service).
export const AgentScheduleResponse = t.Object({
  id: t.Number(),
  agentId: t.Number(),
  agentName: t.String(),
  name: t.String(),
  type: scheduleType,
  prompt: t.String(),
  cron: t.Nullable(t.String()),
  timezone: t.Literal('UTC'),
  columnId: t.Nullable(t.Number()),
  delaySec: t.Number(),
  status: scheduleStatus,
  nextRunAt: t.Nullable(t.String()),
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

export const AgentSchedulePageResponse = pageResponse(AgentScheduleResponse);

export const agentSchedulePageQuery = t.Object(pageQueryFields);

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
