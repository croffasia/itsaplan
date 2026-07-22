import { Elysia, t } from 'elysia';
import { authContext } from '../shared/auth-context';
import { guards } from '../shared/guards';
import { noContent } from '../shared/http';
import { HttpError } from '../shared/lib';
import { ErrorResponse } from '../shared/responses';
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

const params = t.Object({ projectKey: t.String(), scheduleId: t.Numeric() });
const status = t.UnionEnum(['active', 'paused']);
const scheduleBody = t.Object({
  agentId: t.Number(),
  name: t.String({ minLength: 1, maxLength: 120 }),
  prompt: t.String({ minLength: 1, maxLength: 20_000 }),
  cron: t.String({ minLength: 1, maxLength: 120 }),
  status: t.Optional(status),
});

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
    detail: { summary: 'List agent schedules' },
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
      response: { 400: ErrorResponse, 401: ErrorResponse, 403: ErrorResponse, 404: ErrorResponse },
      detail: { summary: 'Create an agent schedule' },
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
      response: { 400: ErrorResponse, 401: ErrorResponse, 403: ErrorResponse, 404: ErrorResponse },
      detail: { summary: 'Update an agent schedule' },
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
      detail: { summary: 'Delete an agent schedule' },
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
    { params, permission: ['ai_agents', 'edit'], detail: { summary: 'Run an agent schedule now' } },
  )
  .get(
    '/projects/:projectKey/agent-schedules/:scheduleId/runs',
    async ({ project, params }) => {
      const rows = await listScheduleRuns(project.id, params.scheduleId);
      if (!rows) throw new HttpError(404, 'Schedule not found');
      return rows;
    },
    { params, permission: ['ai_agents', 'read'], detail: { summary: 'List agent schedule runs' } },
  );
