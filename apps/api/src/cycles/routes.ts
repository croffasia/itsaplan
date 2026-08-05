import { Elysia, t } from 'elysia';
import { mcpTool } from '../mcp/generate';
import { noContent } from '../shared/http';
import { guards, entityGuard } from '../shared/guards';
import { authContext } from '../shared/auth-context';
import { requireUser } from '../shared/access';
import { HttpError } from '../shared/lib';
import { ErrorResponse } from '../shared/responses';
import { transferCycleIssues } from '../issues/store';
import {
  listCycles,
  listPlannedCycles,
  listCompletedCycles,
  getCycle,
  getCycleProjectId,
  createCycle,
  updateCycle,
  deleteCycle,
} from './store';

const cycleParams = t.Object({ cycleId: t.Numeric() });

const IsoDate = t.String({
  pattern: '^\\d{4}-\\d{2}-\\d{2}$',
  description: "Date 'YYYY-MM-DD'.",
});

// CycleRow from the store. status follows from the dates against today (upcoming /
// active / completed) and progress is derived issue counts; neither is stored.
const CycleResponse = t.Object({
  id: t.Number(),
  projectId: t.Number(),
  name: t.String(),
  goal: t.String(),
  startDate: t.String(),
  endDate: t.String(),
  status: t.String(),
  createdAt: t.String(),
  updatedAt: t.String(),
  progress: t.Object({ completed: t.Number(), canceled: t.Number(), total: t.Number() }),
});

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
      params: t.Object({ projectKey: t.String() }),
      query: t.Object({
        status: t.Optional(
          t.Literal('planned', {
            description: 'Only the cycles that have not finished: active and upcoming.',
          }),
        ),
      }),
      permission: ['cycles', 'read'],
      response: {
        200: t.Array(CycleResponse),
        400: ErrorResponse,
        401: ErrorResponse,
        403: ErrorResponse,
        404: ErrorResponse,
      },
      detail: {
        summary: 'List cycles',
        description: "A project's cycles, oldest first.",
        ...mcpTool('list_cycles'),
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
      params: t.Object({ projectKey: t.String() }),
      query: t.Object({
        page: t.Optional(t.Numeric({ minimum: 1, description: '1-based page. Default 1.' })),
        pageSize: t.Optional(
          t.Numeric({
            minimum: 1,
            maximum: 100,
            description: 'Items per page (1-100). Default 25.',
          }),
        ),
      }),
      permission: ['cycles', 'read'],
      response: {
        200: t.Object({
          items: t.Array(CycleResponse),
          total: t.Number(),
          page: t.Number(),
          pageSize: t.Number(),
        }),
        400: ErrorResponse,
        401: ErrorResponse,
        403: ErrorResponse,
        404: ErrorResponse,
      },
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
      params: t.Object({ projectKey: t.String() }),
      body: t.Object({
        name: t.String({ minLength: 1, description: 'Cycle name.' }),
        goal: t.Optional(t.String({ description: 'What the team commits to in this cycle.' })),
        startDate: IsoDate,
        endDate: IsoDate,
      }),
      permission: ['cycles', 'create'],
      response: {
        201: CycleResponse,
        400: ErrorResponse,
        401: ErrorResponse,
        403: ErrorResponse,
        404: ErrorResponse,
      },
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
      response: {
        200: CycleResponse,
        400: ErrorResponse,
        401: ErrorResponse,
        403: ErrorResponse,
        404: ErrorResponse,
      },
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
      body: t.Object({
        name: t.Optional(t.String({ minLength: 1, description: 'New name.' })),
        goal: t.Optional(t.String({ description: 'New goal.' })),
        startDate: t.Optional(IsoDate),
        endDate: t.Optional(IsoDate),
      }),
      cycle: 'edit',
      response: {
        200: CycleResponse,
        400: ErrorResponse,
        401: ErrorResponse,
        403: ErrorResponse,
        404: ErrorResponse,
      },
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
      response: {
        204: t.Void(),
        400: ErrorResponse,
        401: ErrorResponse,
        403: ErrorResponse,
        404: ErrorResponse,
      },
      detail: {
        summary: 'Delete a cycle',
        description: 'Delete a cycle by its numeric id. Its issues stay, without a cycle.',
        ...mcpTool('delete_cycle'),
      },
    },
  )

  .post(
    '/cycles/:cycleId/transfer',
    async ({ params, body, user }) => {
      const projectId = await getCycleProjectId(params.cycleId);
      if (projectId === null) throw new HttpError(404, 'Cycle not found');
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
      body: t.Object({
        targetCycleId: t.Nullable(
          t.Integer({
            description:
              'Cycle to move the unfinished issues to, or null to leave them without a cycle.',
          }),
        ),
      }),
      cycle: 'edit',
      response: {
        200: t.Object({ moved: t.Number() }),
        400: ErrorResponse,
        401: ErrorResponse,
        403: ErrorResponse,
        404: ErrorResponse,
      },
      detail: {
        summary: 'Transfer unfinished issues',
        description:
          "Move the cycle's issues that are not in a completed or canceled state to another cycle, or off any cycle. Finished issues stay on this cycle.",
        ...mcpTool('transfer_cycle_issues'),
      },
    },
  );
