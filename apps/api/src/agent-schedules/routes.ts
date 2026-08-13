import { Elysia, t } from 'elysia';
import { authContext } from '../shared/auth-context';
import { guards } from '../shared/guards';
import { noContent } from '../shared/http';
import { HttpError } from '../shared/lib';
import { accessErrors, commonErrors } from '../shared/responses';
import { mcpTool } from '../mcp/generate';
import { nextCronRun } from './cron';
import {
  createAgentSchedule,
  deleteAgentSchedule,
  enqueueManualScheduleRun,
  getAgentSchedule,
  listAgentSchedules,
  listScheduleRuns,
  updateAgentSchedule,
} from './store';

const params = t.Object({
  projectKey: t.String(),
  scheduleId: t.Numeric({ description: 'Schedule id from list_agent_schedules.' }),
});
const status = t.UnionEnum(['active', 'paused'], {
  description: "'active' runs on the cron, 'paused' does not run until it is set back to 'active'.",
});
const scheduleBody = t.Object({
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
  status: t.Optional(status),
});

// A schedule DTO (AgentScheduleRow from the store).
const AgentScheduleResponse = t.Object({
  id: t.Number(),
  agentId: t.Number(),
  agentName: t.String(),
  name: t.String(),
  prompt: t.String(),
  cron: t.String(),
  timezone: t.Literal('UTC'),
  status,
  nextRunAt: t.String(),
  lastRunAt: t.Nullable(t.String()),
  lastRunStatus: t.Nullable(t.String()),
  createdAt: t.String(),
  updatedAt: t.String(),
});

// One run of a schedule (ScheduleRunRow from the store), with the agent's answer in
// `output` once the run has finished.
const ScheduleRunResponse = t.Object({
  id: t.Number(),
  status: t.String(),
  trigger: t.String(),
  prompt: t.String(),
  attempts: t.Number(),
  lastError: t.Nullable(t.String()),
  output: t.Nullable(t.String()),
  scheduledFor: t.Nullable(t.String()),
  startedAt: t.Nullable(t.String()),
  finishedAt: t.Nullable(t.String()),
  createdAt: t.String(),
});

const QueuedRunResponse = t.Object({ runId: t.Number() });

function requiredText(value: string, field: string): string {
  const trimmed = value.trim();
  if (!trimmed) throw new HttpError(400, `${field} is required`);
  return trimmed;
}

export const agentScheduleRoutes = new Elysia({
  name: 'agent-schedules',
  detail: { tags: ['Agent Schedules'] },
})
  .use(authContext)
  .use(guards)
  .get('/projects/:projectKey/agent-schedules', ({ project }) => listAgentSchedules(project.id), {
    permission: ['ai_agents', 'read'],
    response: { 200: t.Array(AgentScheduleResponse), ...accessErrors },
    detail: {
      summary: 'List agent schedules',
      description: "List the project's agent schedules with their cron, next run, and last run.",
      ...mcpTool('list_agent_schedules'),
    },
  })
  .post(
    '/projects/:projectKey/agent-schedules',
    async ({ project, body, set }) => {
      const cron = body.cron.trim();
      const row = await createAgentSchedule({
        projectId: project.id,
        agentId: body.agentId,
        name: requiredText(body.name, 'Name'),
        prompt: requiredText(body.prompt, 'Task'),
        cron,
        status: body.status ?? 'active',
        nextRunAt: nextCronRun(cron),
      });
      if (!row) throw new HttpError(400, 'Select an internal agent from this project');
      set.status = 201;
      return row;
    },
    {
      body: scheduleBody,
      permission: ['ai_agents', 'create'],
      response: { 201: AgentScheduleResponse, ...commonErrors },
      detail: {
        summary: 'Create an agent schedule',
        description: 'Create a schedule that sends a task to an internal agent on a cron.',
        ...mcpTool('create_agent_schedule'),
      },
    },
  )
  .patch(
    '/projects/:projectKey/agent-schedules/:scheduleId',
    async ({ project, params, body }) => {
      const cron = body.cron?.trim();
      const current = await getAgentSchedule(project.id, params.scheduleId);
      if (!current) throw new HttpError(404, 'Schedule not found');
      // Recompute the next run when the cron changes, or when resuming a paused schedule.
      const resuming = body.status === 'active' && current.status === 'paused';
      let nextRunAt: Date | undefined;
      if (cron !== undefined) nextRunAt = nextCronRun(cron);
      else if (resuming) nextRunAt = nextCronRun(current.cron);
      const row = await updateAgentSchedule(project.id, params.scheduleId, {
        ...(body.agentId !== undefined ? { agentId: body.agentId } : {}),
        ...(body.name !== undefined ? { name: requiredText(body.name, 'Name') } : {}),
        ...(body.prompt !== undefined ? { prompt: requiredText(body.prompt, 'Task') } : {}),
        ...(cron !== undefined ? { cron } : {}),
        ...(nextRunAt !== undefined ? { nextRunAt } : {}),
        ...(body.status !== undefined ? { status: body.status } : {}),
      });
      if (!row) throw new HttpError(404, 'Schedule not found');
      return row;
    },
    {
      params,
      body: t.Partial(scheduleBody),
      permission: ['ai_agents', 'edit'],
      response: { 200: AgentScheduleResponse, ...commonErrors },
      detail: {
        summary: 'Update an agent schedule',
        description: "Update a schedule's agent, task, cron, or status.",
        ...mcpTool('update_agent_schedule'),
      },
    },
  )
  .delete(
    '/projects/:projectKey/agent-schedules/:scheduleId',
    async ({ project, params }) => {
      if (!(await deleteAgentSchedule(project.id, params.scheduleId))) {
        throw new HttpError(404, 'Schedule not found');
      }
      return noContent();
    },
    {
      params,
      permission: ['ai_agents', 'delete'],
      response: { 204: t.Void(), ...commonErrors },
      detail: {
        summary: 'Delete an agent schedule',
        description: 'Delete a schedule with its run history. Irreversible.',
        ...mcpTool('delete_agent_schedule'),
      },
    },
  )
  .post(
    '/projects/:projectKey/agent-schedules/:scheduleId/run',
    async ({ project, params, set }) => {
      const runId = await enqueueManualScheduleRun(project.id, params.scheduleId);
      if (runId == null) throw new HttpError(404, 'Schedule not found');
      set.status = 202;
      return { runId };
    },
    {
      params,
      permission: ['ai_agents', 'edit'],
      response: { 202: QueuedRunResponse, ...commonErrors },
      detail: {
        summary: 'Run an agent schedule now',
        description:
          'Queue a run of the schedule now and return its run id. It runs in the background; ' +
          'read the result with list_agent_schedule_runs.',
        ...mcpTool('run_agent_schedule'),
      },
    },
  )
  .get(
    '/projects/:projectKey/agent-schedules/:scheduleId/runs',
    async ({ project, params }) => {
      const rows = await listScheduleRuns(project.id, params.scheduleId);
      if (!rows) throw new HttpError(404, 'Schedule not found');
      return rows;
    },
    {
      params,
      permission: ['ai_agents', 'read'],
      response: { 200: t.Array(ScheduleRunResponse), ...commonErrors },
      detail: {
        summary: 'List agent schedule runs',
        description:
          "The schedule's last 50 runs, newest first, with their status, output, and error.",
        ...mcpTool('list_agent_schedule_runs'),
      },
    },
  );
