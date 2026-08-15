import { Elysia, t } from 'elysia';
import { authContext } from '#shared/auth-context';
import { guards } from '#shared/guards';
import { requireUser } from '#shared/access';
import { noContent } from '#shared/http';
import { HttpError } from '#shared/lib';
import { accessErrors, commonErrors } from '#shared/responses';
import { mcpTool } from '#mcp/generate';
import { nextCronRun } from './cron';
import {
  AgentScheduleResponse,
  AgentScheduleListResponse,
  CanceledRunsResponse,
  QueuedRunResponse,
  ScheduleRunListResponse,
  createScheduleBody,
  scheduleParams,
  scheduleRunParams,
  updateScheduleBody,
} from './model';
import {
  cancelPendingScheduleRuns,
  createAgentSchedule,
  deleteAgentSchedule,
  enqueueManualScheduleRun,
  getAgentSchedule,
  listAgentSchedules,
  listScheduleRuns,
  updateAgentSchedule,
} from './service';

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
  .get(
    '/projects/:projectKey/agent-schedules',
    ({ project, user }) => listAgentSchedules(project.id, requireUser(user).id),
    {
      permission: ['ai_agents', 'read'],
      response: { 200: AgentScheduleListResponse, ...accessErrors },
      detail: {
        summary: 'List agent schedules',
        description: "List the project's agent schedules with their cron, next run, and last run.",
        ...mcpTool('list_agent_schedules'),
      },
    },
  )
  .post(
    '/projects/:projectKey/agent-schedules',
    async ({ project, body, set, user }) => {
      const cron = body.cron.trim();
      const row = await createAgentSchedule({
        projectId: project.id,
        agentId: body.agentId,
        actorUserId: requireUser(user).id,
        name: requiredText(body.name, 'Name'),
        prompt: requiredText(body.prompt, 'Task'),
        cron,
        status: body.status ?? 'active',
        nextRunAt: nextCronRun(cron),
      });
      if (!row) throw new HttpError(400, 'Select an agent from this project');
      set.status = 201;
      return row;
    },
    {
      body: createScheduleBody,
      permission: ['ai_agents', 'create'],
      response: { 201: AgentScheduleResponse, ...commonErrors },
      detail: {
        summary: 'Create an agent schedule',
        description: 'Create a schedule that sends a task to an agent on a cron.',
        ...mcpTool('create_agent_schedule'),
      },
    },
  )
  .patch(
    '/projects/:projectKey/agent-schedules/:scheduleId',
    async ({ project, params, body, user }) => {
      const cron = body.cron?.trim();
      const current = await getAgentSchedule(project.id, params.scheduleId, requireUser(user).id);
      if (!current) throw new HttpError(404, 'Schedule not found');
      // Recompute the next run when the cron changes, or when resuming a paused schedule.
      const resuming = body.status === 'active' && current.status === 'paused';
      let nextRunAt: Date | undefined;
      if (cron !== undefined) nextRunAt = nextCronRun(cron);
      else if (resuming) nextRunAt = nextCronRun(current.cron);
      const row = await updateAgentSchedule(
        project.id,
        params.scheduleId,
        {
          ...(body.agentId !== undefined ? { agentId: body.agentId } : {}),
          ...(body.name !== undefined ? { name: requiredText(body.name, 'Name') } : {}),
          ...(body.prompt !== undefined ? { prompt: requiredText(body.prompt, 'Task') } : {}),
          ...(cron !== undefined ? { cron } : {}),
          ...(nextRunAt !== undefined ? { nextRunAt } : {}),
          ...(body.status !== undefined ? { status: body.status } : {}),
        },
        requireUser(user).id,
      );
      if (!row) throw new HttpError(404, 'Schedule not found');
      return row;
    },
    {
      params: scheduleParams,
      body: updateScheduleBody,
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
    async ({ project, params, user }) => {
      if (!(await deleteAgentSchedule(project.id, params.scheduleId, requireUser(user).id))) {
        throw new HttpError(404, 'Schedule not found');
      }
      return noContent();
    },
    {
      params: scheduleParams,
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
    async ({ project, params, set, user }) => {
      const runId = await enqueueManualScheduleRun(
        project.id,
        params.scheduleId,
        requireUser(user).id,
      );
      if (runId == null) throw new HttpError(404, 'Schedule not found');
      set.status = 202;
      return { runId };
    },
    {
      params: scheduleParams,
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
  .post(
    '/projects/:projectKey/agent-schedules/:scheduleId/runs/cancel',
    async ({ project, params, user }) => {
      const canceled = await cancelPendingScheduleRuns(
        project.id,
        params.scheduleId,
        requireUser(user).id,
      );
      if (canceled == null) throw new HttpError(404, 'Schedule not found');
      return { canceled };
    },
    {
      params: scheduleParams,
      permission: ['ai_agents', 'edit'],
      response: { 200: CanceledRunsResponse, ...commonErrors },
      detail: {
        summary: 'End the pending runs of an agent schedule',
        description:
          'End every run of the schedule that has not started yet, so it is never run. ' +
          'A run already being executed, and one that finished, are left as they are.',
        ...mcpTool('cancel_agent_schedule_runs'),
      },
    },
  )
  .post(
    '/projects/:projectKey/agent-schedules/:scheduleId/runs/:runId/cancel',
    async ({ project, params, user }) => {
      const canceled = await cancelPendingScheduleRuns(
        project.id,
        params.scheduleId,
        requireUser(user).id,
        params.runId,
      );
      if (canceled == null) throw new HttpError(404, 'Schedule not found');
      if (canceled === 0) throw new HttpError(404, 'Pending run not found');
      return { canceled };
    },
    {
      params: scheduleRunParams,
      permission: ['ai_agents', 'edit'],
      response: { 200: CanceledRunsResponse, ...commonErrors },
      detail: {
        summary: 'End one pending run of an agent schedule',
        description: 'End a run that has not started yet, so it is never run.',
        ...mcpTool('cancel_agent_schedule_run'),
      },
    },
  )
  .get(
    '/projects/:projectKey/agent-schedules/:scheduleId/runs',
    async ({ project, params, user }) => {
      const rows = await listScheduleRuns(project.id, params.scheduleId, requireUser(user).id);
      if (!rows) throw new HttpError(404, 'Schedule not found');
      return rows;
    },
    {
      params: scheduleParams,
      permission: ['ai_agents', 'read'],
      response: { 200: ScheduleRunListResponse, ...commonErrors },
      detail: {
        summary: 'List agent schedule runs',
        description:
          "The schedule's last 50 runs, newest first, with their status, output, and error.",
        ...mcpTool('list_agent_schedule_runs'),
      },
    },
  );
