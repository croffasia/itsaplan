import { Elysia, t } from 'elysia';
import { mcpTool } from '../mcp/generate';
import { noContent } from '../shared/http';
import { guards, entityGuard } from '../shared/guards';
import { authContext } from '../shared/auth-context';
import { requireUser } from '../shared/access';
import { HttpError } from '../shared/lib';
import { ErrorResponse } from '../shared/responses';
import {
  listInitiatives,
  initiativeStatusCounts,
  getInitiative,
  getInitiativeProjectId,
  createInitiative,
  updateInitiative,
  deleteInitiative,
  initiativeRev,
} from './store';
import { listFeed } from './activity';

const initiativeParams = t.Object({ initiativeId: t.Numeric() });

// The initiative lifecycle enum, validated at the edge so an invalid value is a
// 400 (not a Postgres CHECK violation → 500). Mirrors the DB check constraint.
const InitiativeStatus = t.Union([
  t.Literal('proposed'),
  t.Literal('planned'),
  t.Literal('active'),
  t.Literal('completed'),
  t.Literal('canceled'),
]);

// InitiativeRow from the store. progress is derived issue counts; health is
// computed on the fly (on_track/at_risk/off_track, or null when there is nothing
// to judge).
const InitiativeResponse = t.Object({
  id: t.Number(),
  projectId: t.Number(),
  title: t.String(),
  description: t.String(),
  status: t.String(),
  ownerUserId: t.Nullable(t.String()),
  priority: t.Nullable(t.String()),
  startDate: t.Nullable(t.String()),
  targetDate: t.Nullable(t.String()),
  position: t.Number(),
  createdAt: t.String(),
  updatedAt: t.String(),
  labelIds: t.Array(t.Number()),
  progress: t.Object({ completed: t.Number(), canceled: t.Number(), total: t.Number() }),
  health: t.Nullable(t.String()),
});

// InitiativeFeedItemRow from activity.ts: one timeline entry, from the initiative
// itself (source 'initiative') or a linked issue (source 'issue').
const FeedItemResponse = t.Object({
  id: t.Number(),
  source: t.String(),
  kind: t.String(),
  actorUserId: t.Nullable(t.String()),
  actorName: t.Nullable(t.String()),
  body: t.Nullable(t.String()),
  action: t.Nullable(t.String()),
  subject: t.Nullable(t.String()),
  fromText: t.Nullable(t.String()),
  toText: t.Nullable(t.String()),
  createdAt: t.String(),
  issueId: t.Nullable(t.Number()),
  issueIdentifier: t.Nullable(t.String()),
});

const FeedPageResponse = t.Object({
  items: t.Array(FeedItemResponse),
  nextCursor: t.Nullable(t.Object({ ts: t.String(), id: t.Number() })),
});

export const initiativeRoutes = new Elysia({
  name: 'initiatives',
  detail: { tags: ['Initiatives'] },
})
  .use(authContext)
  .use(guards)
  // Guard for routes that address an initiative by its own id (no :projectKey in
  // the path). Set `initiative: "<action>"` in the route options.
  .macro({
    initiative: entityGuard('initiatives', 'Initiative not found', (p) =>
      getInitiativeProjectId(Number(p.initiativeId)),
    ),
  })

  .get(
    '/projects/:projectKey/initiatives',
    async ({ project, query }) => {
      const statuses = query.status
        ? query.status
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean)
        : undefined;
      const page = query.page ?? 1;
      const pageSize = query.pageSize ?? 25;
      const { items, total } = await listInitiatives(project.id, {
        statuses,
        search: query.search,
        sort: query.sort,
        dir: query.dir,
        limit: pageSize,
        offset: (page - 1) * pageSize,
      });
      return { items, total, page, pageSize };
    },
    {
      params: t.Object({ projectKey: t.String() }),
      query: t.Object({
        status: t.Optional(
          t.String({
            description:
              'Filter by status: a comma-separated subset of proposed,planned,active,completed,canceled. Omit for all.',
          }),
        ),
        search: t.Optional(t.String({ description: 'Case-insensitive match on the title.' })),
        sort: t.Optional(
          t.Union(
            [
              t.Literal('title'),
              t.Literal('priority'),
              t.Literal('targetDate'),
              t.Literal('owner'),
            ],
            { description: 'Sort column. Omit for the manual position order.' },
          ),
        ),
        dir: t.Optional(
          t.Union([t.Literal('asc'), t.Literal('desc')], {
            description: 'Sort direction. Default asc.',
          }),
        ),
        page: t.Optional(t.Numeric({ minimum: 1, description: '1-based page. Default 1.' })),
        pageSize: t.Optional(
          t.Numeric({
            minimum: 1,
            maximum: 100,
            description: 'Items per page (1-100). Default 25.',
          }),
        ),
      }),
      permission: ['initiatives', 'read'],
      response: {
        200: t.Object({
          items: t.Array(InitiativeResponse),
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
        summary: 'List initiatives',
        description: "List a project's initiatives, filtered, sorted and paged.",
        ...mcpTool('list_initiatives'),
      },
    },
  )

  .get(
    '/projects/:projectKey/initiatives/counts',
    async ({ project }) => initiativeStatusCounts(project.id),
    {
      params: t.Object({ projectKey: t.String() }),
      permission: ['initiatives', 'read'],
      response: {
        200: t.Object({
          total: t.Number(),
          proposed: t.Number(),
          planned: t.Number(),
          active: t.Number(),
          completed: t.Number(),
          canceled: t.Number(),
        }),
        400: ErrorResponse,
        401: ErrorResponse,
        403: ErrorResponse,
        404: ErrorResponse,
      },
      detail: {
        summary: 'Initiative status counts',
        description: "Per-status initiative counts for a project, for the list's tabs.",
      },
    },
  )

  .post(
    '/projects/:projectKey/initiatives',
    async ({ project, body, user, set }) => {
      set.status = 201;
      return createInitiative(project.id, body, requireUser(user).id);
    },
    {
      params: t.Object({ projectKey: t.String() }),
      body: t.Object({
        title: t.String({ minLength: 1, description: 'Initiative title.' }),
        description: t.Optional(t.String({ description: 'Initiative description.' })),
        status: t.Optional(InitiativeStatus),
        ownerUserId: t.Optional(
          t.Nullable(t.String({ description: 'Owner user id (a project member), or null.' })),
        ),
        priority: t.Optional(
          t.Nullable(t.String({ description: 'One of: urgent, high, medium, low. Or null.' })),
        ),
        startDate: t.Optional(
          t.Nullable(t.String({ description: "Start date 'YYYY-MM-DD', or null." })),
        ),
        targetDate: t.Optional(
          t.Nullable(t.String({ description: "Target date 'YYYY-MM-DD', or null." })),
        ),
        labelIds: t.Optional(
          t.Array(t.Integer(), { description: 'Label ids to attach. From get_project.labels.' }),
        ),
      }),
      permission: ['initiatives', 'create'],
      response: {
        201: InitiativeResponse,
        400: ErrorResponse,
        401: ErrorResponse,
        403: ErrorResponse,
        404: ErrorResponse,
      },
      detail: {
        summary: 'Create an initiative',
        description: 'Create an initiative in a project.',
        ...mcpTool('create_initiative'),
      },
    },
  )

  .get(
    '/initiatives/:initiativeId',
    async ({ params }) => {
      const found = await getInitiative(params.initiativeId);
      if (!found) throw new HttpError(404, 'Initiative not found');
      return found;
    },
    {
      params: initiativeParams,
      initiative: 'read',
      response: {
        200: InitiativeResponse,
        400: ErrorResponse,
        401: ErrorResponse,
        403: ErrorResponse,
        404: ErrorResponse,
      },
      detail: {
        summary: 'Get an initiative',
        description: 'Get an initiative by its numeric id.',
        ...mcpTool('get_initiative'),
      },
    },
  )

  .patch(
    '/initiatives/:initiativeId',
    async ({ params, body, user }) => {
      const actorUserId = requireUser(user).id;
      const updated = await updateInitiative(params.initiativeId, body, actorUserId);
      if (!updated) throw new HttpError(404, 'Initiative not found');
      return updated;
    },
    {
      params: initiativeParams,
      body: t.Object({
        title: t.Optional(t.String({ minLength: 1, description: 'New title.' })),
        description: t.Optional(t.String({ description: 'New description.' })),
        status: t.Optional(InitiativeStatus),
        ownerUserId: t.Optional(
          t.Nullable(t.String({ description: 'New owner user id (a project member), or null.' })),
        ),
        priority: t.Optional(
          t.Nullable(t.String({ description: 'One of: urgent, high, medium, low. Or null.' })),
        ),
        startDate: t.Optional(
          t.Nullable(t.String({ description: "Start date 'YYYY-MM-DD', or null." })),
        ),
        targetDate: t.Optional(
          t.Nullable(t.String({ description: "Target date 'YYYY-MM-DD', or null." })),
        ),
        labelIds: t.Optional(
          t.Array(t.Integer(), { description: "Replace the initiative's labels with these ids." }),
        ),
      }),
      initiative: 'edit',
      response: {
        200: InitiativeResponse,
        400: ErrorResponse,
        401: ErrorResponse,
        403: ErrorResponse,
        404: ErrorResponse,
      },
      detail: {
        summary: 'Update an initiative',
        description: 'Update an initiative by its numeric id.',
        ...mcpTool('update_initiative'),
      },
    },
  )

  .delete(
    '/initiatives/:initiativeId',
    async ({ params }) => {
      await deleteInitiative(params.initiativeId);
      return noContent();
    },
    {
      params: initiativeParams,
      initiative: 'delete',
      response: {
        204: t.Void(),
        400: ErrorResponse,
        401: ErrorResponse,
        403: ErrorResponse,
        404: ErrorResponse,
      },
      detail: {
        summary: 'Delete an initiative',
        description: 'Delete an initiative by its numeric id. Irreversible.',
        ...mcpTool('delete_initiative'),
      },
    },
  )

  .get(
    '/initiatives/:initiativeId/feed',
    async ({ params, query }) => {
      const limit = query.limit != null ? Number(query.limit) : 25;
      let before = null;
      if (query.cursor) {
        try {
          before = JSON.parse(query.cursor);
        } catch {
          // Ignore a malformed cursor and serve the first page.
        }
      }
      return listFeed(params.initiativeId, { before, limit });
    },
    {
      params: initiativeParams,
      query: t.Object({
        limit: t.Optional(t.String({ description: 'Max items per page (1-100). Default 25.' })),
        cursor: t.Optional(
          t.String({ description: 'nextCursor from the previous page, for paging.' }),
        ),
      }),
      initiative: 'read',
      response: {
        200: FeedPageResponse,
        400: ErrorResponse,
        401: ErrorResponse,
        403: ErrorResponse,
        404: ErrorResponse,
      },
      detail: {
        summary: 'Get an initiative feed',
        description: "Get an initiative's activity feed by its numeric id.",
        ...mcpTool('list_initiative_activity'),
      },
    },
  )

  .get(
    '/initiatives/:initiativeId/rev',
    async ({ params }) => ({ rev: await initiativeRev(params.initiativeId) }),
    {
      params: initiativeParams,
      initiative: 'read',
      response: {
        200: t.Object({ rev: t.String() }),
        400: ErrorResponse,
        401: ErrorResponse,
        403: ErrorResponse,
        404: ErrorResponse,
      },
      detail: { summary: 'Get initiative revision' },
    },
  );
