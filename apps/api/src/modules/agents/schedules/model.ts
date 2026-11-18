import { t } from 'elysia';
import { pageQueryFields, pageResponse } from '#shared/pagination';

import { runContextTokens, agentExecutionState } from '../model';

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
  // t.UnionEnum defaults to its first value, which would resume a paused schedule on a
  // PATCH that leaves the status out; the update is partial.
  default: undefined,
  description: "'paused' does not run until set back to 'active'.",
});

export const scheduleType = t.String({
  minLength: 1,
  maxLength: 40,
  description:
    "'cron' runs on a cron. 'status' runs on each issue that enters a column, by a move or by " +
    'creation. Instance-added types take no cron and no column.',
});

export const scheduleOptions = t.Record(t.String(), t.Any(), {
  description:
    'Settings for instance extensions, such as conditions on the issues that start a run. ' +
    'Without extensions, only {} is accepted.',
});

export const createScheduleBody = t.Object({
  agentId: t.Number({ description: 'Internal agent id from list_ai_agents.' }),
  name: t.String({ minLength: 1, maxLength: 120 }),
  type: t.Optional(scheduleType),
  prompt: t.Optional(
    t.String({
      maxLength: 20_000,
      description:
        "Task for each run. Required for 'cron'. Optional for " +
        'other types: their runs already name the issue and the event.',
    }),
  ),
  cron: t.Optional(
    t.String({
      minLength: 1,
      maxLength: 120,
      description:
        "Five-field cron in UTC, such as '0 9 * * 1' (Mondays " +
        "09:00). Required for 'cron', refused for other types.",
    }),
  ),
  columnId: t.Optional(
    t.Number({
      description:
        'Column id from get_project. Issues that enter it start ' +
        "a run. Required for 'status', refused for other types.",
    }),
  ),
  delaySec: t.Optional(
    t.Integer({
      minimum: 0,
      maximum: 86400,
      description:
        "Seconds an issue run waits before the agent may pick it up. Default 0. On 'status', the " +
        "run ends if the issue leaves the column in that time. Refused for 'cron'.",
    }),
  ),
  options: t.Optional(scheduleOptions),
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
  options: scheduleOptions,
  status: scheduleStatus,
  nextRunAt: t.Nullable(t.String()),
  lastRunAt: t.Nullable(t.String()),
  lastRunStatus: t.Nullable(t.String()),
  pendingRuns: t.Number({ description: 'Runs of this schedule that have not started yet.' }),
  canTrigger: t.Boolean({
    description:
      "Whether you may run or stop this schedule; an 'owner'-scoped agent serves its owner only.",
  }),
  supported: t.Boolean({
    description:
      'False for a schedule whose type or options come from Cloud or Pro and are not on this ' +
      'instance. It is kept as it is but starts no run and cannot be updated, only deleted.',
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
  kind: t.String(),
  status: t.String(),
  executionState: agentExecutionState,
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
