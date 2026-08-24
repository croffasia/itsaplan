import { Elysia, t } from 'elysia';
import { mcpTool } from '#mcp/generate';
import { noContent } from '#shared/http';
import { guards, entityGuard } from '#shared/guards';
import { authContext } from '#shared/auth-context';
import { requireUser } from '#shared/access';
import { HttpError } from '#shared/lib';
import { accessErrors, commonErrors } from '#shared/responses';
import { transferCycleIssues } from '#modules/issues/service';
import {
  CycleListResponse,
  CycleOptionListResponse,
  CyclePageResponse,
  CycleResponse,
  StartNextCycleResponse,
  TransferCycleResponse,
  completedCyclesQuery,
  createCycleBody,
  cycleParams,
  listCyclesQuery,
  transferCycleBody,
  updateCycleBody,
} from './model';
import {
  listCycles,
  listPlannedCycles,
  listCompletedCycles,
  getCycle,
  getCycleProjectId,
  createCycle,
  updateCycle,
  deleteCycle,
  finishCycle,
  startNextCycle,
} from './service';

export const cycleRoutes = new Elysia({
  name: 'cycles',
  detail: { tags: ['Cycles'] },
})
  .use(authContext)
  .use(guards)
  // Guard for routes that address a cycle by its own id (no :projectKey in the
  // path). Set `cycle: "<action>"` in the route options.
  .macro({
    cycle: entityGuard('cycles', 'Cycle not found', (p) => getCycleProjectId(Number(p.cycleId))),
  })

  .get(
    '/projects/:projectKey/cycles',
    async ({ project, query }) =>
      query.status === 'planned' ? listPlannedCycles(project.id) : listCycles(project.id),
    {
      query: listCyclesQuery,
      permission: ['cycles', 'read'],
      response: { 200: CycleListResponse, ...commonErrors },
      detail: {
        summary: 'List cycles',
        description: "A project's cycles, oldest first.",
        ...mcpTool('list_cycles'),
      },
    },
  )

  // Fills the cycle picker on an issue and the cycle lanes on the board. Read under
  // work items: planning an issue needs the names, not the cycle pages the `cycles`
  // resource gates.
  .get(
    '/projects/:projectKey/cycles/options',
    async ({ project }) => {
      const cycles = await listPlannedCycles(project.id);
      return cycles.map((c) => ({ id: c.id, name: c.name, status: c.status }));
    },
    {
      permission: ['work_items', 'read'],
      response: { 200: CycleOptionListResponse, ...accessErrors },
      detail: {
        summary: 'List cycle options',
        description: 'The cycles an issue can be planned into: id, name and status.',
      },
    },
  )

  .get(
    '/projects/:projectKey/cycles/completed',
    async ({ project, query }) => {
      const page = query.page ?? 1;
      const pageSize = query.pageSize ?? 25;
      const { items, total } = await listCompletedCycles(project.id, {
        limit: pageSize,
        offset: (page - 1) * pageSize,
      });
      return { items, total, page, pageSize };
    },
    {
      query: completedCyclesQuery,
      permission: ['cycles', 'read'],
      response: { 200: CyclePageResponse, ...commonErrors },
      detail: {
        summary: 'List completed cycles',
        description: "A page of a project's finished cycles, newest first.",
      },
    },
  )

  .post(
    '/projects/:projectKey/cycles',
    async ({ project, body, set }) => {
      set.status = 201;
      return createCycle(project.id, body);
    },
    {
      body: createCycleBody,
      permission: ['cycles', 'create'],
      response: { 201: CycleResponse, ...commonErrors },
      detail: {
        summary: 'Create a cycle',
        description:
          'Create a cycle in a project. Its dates must not overlap another cycle of the same project.',
        ...mcpTool('create_cycle'),
      },
    },
  )

  .get(
    '/cycles/:cycleId',
    async ({ params }) => {
      const found = await getCycle(params.cycleId);
      if (!found) throw new HttpError(404, 'Cycle not found');
      return found;
    },
    {
      params: cycleParams,
      cycle: 'read',
      response: { 200: CycleResponse, ...commonErrors },
      detail: {
        summary: 'Get a cycle',
        description: 'Get a cycle by its numeric id.',
        ...mcpTool('get_cycle'),
      },
    },
  )

  .patch(
    '/cycles/:cycleId',
    async ({ params, body }) => {
      const updated = await updateCycle(params.cycleId, body);
      if (!updated) throw new HttpError(404, 'Cycle not found');
      return updated;
    },
    {
      params: cycleParams,
      body: updateCycleBody,
      cycle: 'edit',
      response: { 200: CycleResponse, ...commonErrors },
      detail: {
        summary: 'Update a cycle',
        description:
          'Update a cycle by its numeric id. New dates must not overlap another cycle of the same project.',
        ...mcpTool('update_cycle'),
      },
    },
  )

  .delete(
    '/cycles/:cycleId',
    async ({ params }) => {
      await deleteCycle(params.cycleId);
      return noContent();
    },
    {
      params: cycleParams,
      cycle: 'delete',
      response: { 204: t.Void(), ...commonErrors },
      detail: {
        summary: 'Delete a cycle',
        description: 'Delete a cycle by its numeric id. Its issues stay, without a cycle.',
        ...mcpTool('delete_cycle'),
      },
    },
  )

  .post(
    '/cycles/:cycleId/finish',
    async ({ params }) => {
      const finished = await finishCycle(params.cycleId);
      if (!finished) throw new HttpError(404, 'Cycle not found');
      return finished;
    },
    {
      params: cycleParams,
      cycle: 'edit',
      response: { 200: CycleResponse, ...commonErrors },
      detail: {
        summary: 'Finish a cycle',
        description:
          'Close a running cycle before its planned end date. Final: a finished cycle cannot be reopened, keeps its planned end date, and keeps its issues.',
        ...mcpTool('finish_cycle', { destructiveHint: true }),
      },
    },
  )

  .post(
    '/cycles/:cycleId/start-next',
    async ({ params, user, projectId }) => {
      const started = await startNextCycle(params.cycleId);
      if (!started) throw new HttpError(404, 'Cycle not found');
      const moved = await transferCycleIssues(
        projectId,
        params.cycleId,
        started.id,
        requireUser(user).id,
      );
      // Read back after the transfer, so the started cycle carries the issues it
      // just received in its progress counts.
      return { cycle: (await getCycle(started.id)) ?? started, moved };
    },
    {
      params: cycleParams,
      cycle: 'edit',
      response: { 200: StartNextCycleResponse, ...commonErrors },
      detail: {
        summary: 'Start the next cycle today',
        description:
          "Finish the running cycle and start the project's next upcoming cycle today, moving the unfinished issues over. The started cycle keeps its planned end date.",
        ...mcpTool('start_next_cycle', { destructiveHint: true }),
      },
    },
  )

  .post(
    '/cycles/:cycleId/transfer',
    // projectId comes from the cycle guard, which resolved it to check access.
    async ({ params, body, user, projectId }) => {
      const moved = await transferCycleIssues(
        projectId,
        params.cycleId,
        body.targetCycleId ?? null,
        requireUser(user).id,
      );
      return { moved };
    },
    {
      params: cycleParams,
      body: transferCycleBody,
      cycle: 'edit',
      response: { 200: TransferCycleResponse, ...commonErrors },
      detail: {
        summary: 'Transfer unfinished issues',
        description:
          "Move the cycle's issues that are not in a completed or canceled state to another cycle, or off any cycle. Finished issues stay on this cycle.",
        ...mcpTool('transfer_cycle_issues'),
      },
    },
  );
