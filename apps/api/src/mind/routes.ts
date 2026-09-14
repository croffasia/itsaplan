import { Elysia, t } from 'elysia';
import { guards, entityGuard } from '../shared/guards';
import { authContext } from '../shared/auth-context';
import { noContent } from '../shared/http';
import { HttpError } from '../shared/lib';
import { ErrorResponse } from '../shared/responses';
import { mcpTool } from '../mcp/generate';
import { isMcpRequest } from '../shared/mcp-request';
import {
  createMindFact,
  deleteMindFact,
  getMindFact,
  getMindFactProjectId,
  getMindOverview,
  linkMindFacts,
  listLinkedFacts,
  listMindFacts,
  listRecentRecalls,
  listStaleMindFacts,
  recallMindFacts,
  recordRecalls,
  unlinkMindFacts,
  updateMindFact,
} from './store';

const projectParams = t.Object({ projectKey: t.String() });
const factParams = t.Object({ factId: t.Numeric() });

const CategorySchema = t.Union([
  t.Literal('goals'),
  t.Literal('routines'),
  t.Literal('people'),
  t.Literal('clients'),
  t.Literal('infra'),
  t.Literal('business'),
  t.Literal('knowledge'),
  t.Literal('daily_notes'),
  t.Literal('archive'),
]);

const StatusSchema = t.Union([
  t.Literal('unverified'),
  t.Literal('verified'),
  t.Literal('flagged'),
  t.Literal('conflicted'),
]);

const SourceSchema = t.Union([t.Literal('manual'), t.Literal('braindump'), t.Literal('agent')]);

const TagsSchema = t.Array(t.String({ minLength: 1, maxLength: 40 }), { maxItems: 12 });

const FactResponse = t.Object({
  id: t.Number(),
  category: CategorySchema,
  title: t.String(),
  body: t.String(),
  tags: t.Array(t.String()),
  source: SourceSchema,
  pinned: t.Boolean(),
  status: StatusSchema,
  confidence: t.Number(),
  authorName: t.Nullable(t.String()),
  braindumpEntryId: t.Nullable(t.Number()),
  linksOut: t.Number(),
  linksIn: t.Number(),
  recallsThisWeek: t.Number(),
  verifiedAt: t.Nullable(t.String()),
  createdAt: t.String(),
  updatedAt: t.String(),
});

const OverviewResponse = t.Object({
  totalFacts: t.Number(),
  factsThisWeek: t.Number(),
  links: t.Number(),
  recallsToday: t.Number(),
  byCategory: t.Array(t.Object({ category: t.String(), count: t.Number() })),
  daily: t.Array(t.Object({ date: t.String(), count: t.Number() })),
  mostLinked: t.Array(
    t.Object({
      id: t.Number(),
      title: t.String(),
      category: t.String(),
      linksIn: t.Number(),
      linksOut: t.Number(),
    }),
  ),
  health: t.Object({
    verified: t.Number(),
    conflicted: t.Number(),
    stale: t.Number(),
    orphans: t.Number(),
  }),
});

const RecallResponse = t.Object({
  id: t.Number(),
  factId: t.Nullable(t.Number()),
  factTitle: t.Nullable(t.String()),
  actor: t.String(),
  actorKind: t.String(),
  query: t.String(),
  createdAt: t.String(),
});

export const mindRoutes = new Elysia({ name: 'mind', detail: { tags: ['Mind'] } })
  .use(authContext)
  .use(guards)
  .macro({
    mindFact: entityGuard('mind', 'Fact not found', (p) => getMindFactProjectId(Number(p.factId))),
  })

  .get(
    '/projects/:projectKey/mind/overview',
    ({ project, query }) => getMindOverview(project.id, query.days ?? 14),
    {
      params: projectParams,
      query: t.Object({ days: t.Optional(t.Numeric({ minimum: 1, maximum: 90 })) }),
      permission: ['mind', 'read'],
      response: {
        200: OverviewResponse,
        401: ErrorResponse,
        403: ErrorResponse,
        404: ErrorResponse,
      },
      detail: { summary: 'Memory overview and health', ...mcpTool('mind_overview') },
    },
  )

  .get(
    '/projects/:projectKey/mind/facts',
    ({ project, query }) =>
      listMindFacts(project.id, {
        category: query.category,
        status: query.status,
        tag: query.tag,
        search: query.search,
      }),
    {
      params: projectParams,
      query: t.Object({
        category: t.Optional(CategorySchema),
        status: t.Optional(StatusSchema),
        tag: t.Optional(t.String({ maxLength: 40 })),
        search: t.Optional(t.String({ maxLength: 200 })),
      }),
      permission: ['mind', 'read'],
      response: {
        200: t.Array(FactResponse),
        401: ErrorResponse,
        403: ErrorResponse,
        404: ErrorResponse,
      },
      detail: { summary: 'List memory facts', ...mcpTool('list_mind_facts') },
    },
  )

  .get('/projects/:projectKey/mind/stale', ({ project }) => listStaleMindFacts(project.id, 50), {
    params: projectParams,
    permission: ['mind', 'read'],
    response: {
      200: t.Array(FactResponse),
      401: ErrorResponse,
      403: ErrorResponse,
      404: ErrorResponse,
    },
    detail: { summary: 'List facts that are going stale' },
  })

  .get(
    '/projects/:projectKey/mind/recalls',
    ({ project, query }) => listRecentRecalls(project.id, query.limit ?? 20),
    {
      params: projectParams,
      query: t.Object({ limit: t.Optional(t.Numeric({ minimum: 1, maximum: 100 })) }),
      permission: ['mind', 'read'],
      response: {
        200: t.Array(RecallResponse),
        401: ErrorResponse,
        403: ErrorResponse,
        404: ErrorResponse,
      },
      detail: { summary: 'Recent memory recalls' },
    },
  )

  // The route an agent calls before it acts. Every answer is written to the recall
  // log, which is what makes the memory auditable — so this stays a POST even
  // though it reads, and it is the one mind tool an agent needs.
  .post(
    '/projects/:projectKey/mind/recall',
    async ({ project, body, user, request }) => {
      const facts = await recallMindFacts(project.id, body.query ?? '', body.limit ?? 20);
      const fromMcp = isMcpRequest(request.headers);
      const actor = body.actor?.trim() || user?.name || 'unknown';
      await recordRecalls(
        project.id,
        facts.map((fact) => fact.id),
        actor.slice(0, 120),
        fromMcp ? 'agent' : 'user',
        (body.query ?? '').slice(0, 500),
      );
      return facts;
    },
    {
      params: projectParams,
      body: t.Object({
        query: t.Optional(t.String({ maxLength: 500 })),
        limit: t.Optional(t.Number({ minimum: 1, maximum: 50 })),
        // What to record as the caller. Only a label for the audit log; it never
        // grants access, which is settled by the session and the permission guard.
        actor: t.Optional(t.String({ maxLength: 120 })),
      }),
      permission: ['mind', 'read'],
      response: {
        200: t.Array(FactResponse),
        400: ErrorResponse,
        401: ErrorResponse,
        403: ErrorResponse,
        404: ErrorResponse,
      },
      detail: {
        summary: 'Recall what the operation knows',
        description:
          'Returns the pinned facts plus whatever matches the query, most trusted first, and records the read in the recall log. Call this before acting.',
        ...mcpTool('recall_memory'),
      },
    },
  )

  .post(
    '/projects/:projectKey/mind/facts',
    async ({ project, body, user, set }) => {
      const title = body.title.trim();
      if (title.length === 0) throw new HttpError(400, 'A fact needs a title');
      const row = await createMindFact({
        projectId: project.id,
        authorUserId: user?.id ?? null,
        category: body.category,
        title,
        body: body.body?.trim() ?? '',
        tags: body.tags ?? [],
        source: 'manual',
        confidence: body.confidence,
        pinned: body.pinned,
      });
      set.status = 201;
      return row;
    },
    {
      params: projectParams,
      body: t.Object({
        category: CategorySchema,
        title: t.String({ minLength: 1, maxLength: 200 }),
        body: t.Optional(t.String({ maxLength: 20_000 })),
        tags: t.Optional(TagsSchema),
        confidence: t.Optional(t.Number({ minimum: 0, maximum: 100 })),
        pinned: t.Optional(t.Boolean()),
      }),
      permission: ['mind', 'create'],
      response: {
        201: FactResponse,
        400: ErrorResponse,
        401: ErrorResponse,
        403: ErrorResponse,
        404: ErrorResponse,
      },
      detail: { summary: 'Remember a fact', ...mcpTool('remember_fact') },
    },
  )

  .get('/mind/facts/:factId/links', ({ params }) => listLinkedFacts(params.factId), {
    params: factParams,
    mindFact: 'read',
    response: {
      200: t.Array(FactResponse),
      401: ErrorResponse,
      403: ErrorResponse,
      404: ErrorResponse,
    },
    detail: { summary: 'List the facts a fact links to' },
  })

  .patch(
    '/mind/facts/:factId',
    async ({ params, body }) => {
      const row = await updateMindFact(params.factId, {
        ...(body.category != null ? { category: body.category } : {}),
        ...(body.title != null ? { title: body.title.trim() } : {}),
        ...(body.body != null ? { body: body.body.trim() } : {}),
        ...(body.tags != null ? { tags: body.tags } : {}),
        ...(body.pinned != null ? { pinned: body.pinned } : {}),
        ...(body.status != null ? { status: body.status } : {}),
        ...(body.confidence != null ? { confidence: body.confidence } : {}),
      });
      if (!row) throw new HttpError(404, 'Fact not found');
      return row;
    },
    {
      params: factParams,
      body: t.Object({
        category: t.Optional(CategorySchema),
        title: t.Optional(t.String({ minLength: 1, maxLength: 200 })),
        body: t.Optional(t.String({ maxLength: 20_000 })),
        tags: t.Optional(TagsSchema),
        pinned: t.Optional(t.Boolean()),
        status: t.Optional(StatusSchema),
        confidence: t.Optional(t.Number({ minimum: 0, maximum: 100 })),
      }),
      mindFact: 'edit',
      response: {
        200: FactResponse,
        400: ErrorResponse,
        401: ErrorResponse,
        403: ErrorResponse,
        404: ErrorResponse,
      },
      detail: { summary: 'Update a memory fact' },
    },
  )

  .delete(
    '/mind/facts/:factId',
    async ({ params }) => {
      await deleteMindFact(params.factId);
      return noContent();
    },
    {
      params: factParams,
      mindFact: 'delete',
      response: { 204: t.Void(), 401: ErrorResponse, 403: ErrorResponse, 404: ErrorResponse },
      detail: { summary: 'Forget a fact' },
    },
  )

  .post(
    '/mind/facts/:factId/links',
    async ({ params, body, projectId }) => {
      if (body.toFactId === params.factId) {
        throw new HttpError(400, 'A fact cannot link to itself');
      }
      const linked = await linkMindFacts(projectId, params.factId, body.toFactId);
      if (!linked) throw new HttpError(404, 'The fact to link to was not found in this project');
      const row = await getMindFact(params.factId);
      if (!row) throw new HttpError(404, 'Fact not found');
      return row;
    },
    {
      params: factParams,
      body: t.Object({ toFactId: t.Number() }),
      mindFact: 'edit',
      response: {
        200: FactResponse,
        400: ErrorResponse,
        401: ErrorResponse,
        403: ErrorResponse,
        404: ErrorResponse,
      },
      detail: { summary: 'Link one fact to another' },
    },
  )

  .delete(
    '/mind/facts/:factId/links/:toFactId',
    async ({ params }) => {
      await unlinkMindFacts(params.factId, params.toFactId);
      return noContent();
    },
    {
      params: t.Object({ factId: t.Numeric(), toFactId: t.Numeric() }),
      mindFact: 'edit',
      response: { 204: t.Void(), 401: ErrorResponse, 403: ErrorResponse, 404: ErrorResponse },
      detail: { summary: 'Remove a link between two facts' },
    },
  );
