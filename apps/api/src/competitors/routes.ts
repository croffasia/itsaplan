import { Elysia, t } from 'elysia';
import { guards, entityGuard } from '../shared/guards';
import { authContext } from '../shared/auth-context';
import { noContent } from '../shared/http';
import { HttpError, pgErrorCode } from '../shared/lib';
import { ErrorResponse } from '../shared/responses';
import { mcpTool } from '../mcp/generate';
import { checkCompetitor } from './check';
import { providerStatuses } from './providers';
import {
  createCompetitor,
  deleteCompetitor,
  getCompetitor,
  getCompetitorOverview,
  getCompetitorProjectId,
  listCompetitorEvents,
  listCompetitors,
  markEventsRead,
  normaliseHandle,
  updateCompetitor,
} from './store';

const projectParams = t.Object({ projectKey: t.String() });
const competitorParams = t.Object({ competitorId: t.Numeric() });

const PlatformSchema = t.Union([
  t.Literal('instagram'),
  t.Literal('tiktok'),
  t.Literal('facebook'),
]);

const TagsSchema = t.Array(t.String({ minLength: 1, maxLength: 40 }), { maxItems: 12 });

const SnapshotResponse = t.Object({
  followers: t.Nullable(t.Number()),
  following: t.Nullable(t.Number()),
  posts: t.Nullable(t.Number()),
  displayName: t.Nullable(t.String()),
  biography: t.Nullable(t.String()),
  avatarUrl: t.Nullable(t.String()),
  latestPostId: t.Nullable(t.String()),
  latestPostUrl: t.Nullable(t.String()),
  latestPostAt: t.Nullable(t.String()),
  latestPostCaption: t.Nullable(t.String()),
  capturedAt: t.String(),
});

const CompetitorResponse = t.Object({
  id: t.Number(),
  platform: PlatformSchema,
  handle: t.String(),
  label: t.Nullable(t.String()),
  tags: t.Array(t.String()),
  active: t.Boolean(),
  lastCheckedAt: t.Nullable(t.String()),
  lastError: t.Nullable(t.String()),
  consecutiveFailures: t.Number(),
  latest: t.Nullable(SnapshotResponse),
  followerChange7d: t.Nullable(t.Number()),
  createdAt: t.String(),
});

const EventResponse = t.Object({
  id: t.Number(),
  competitorId: t.Number(),
  platform: PlatformSchema,
  handle: t.String(),
  kind: t.String(),
  summary: t.String(),
  detail: t.Any(),
  postUrl: t.Nullable(t.String()),
  readAt: t.Nullable(t.String()),
  createdAt: t.String(),
});

const OverviewResponse = t.Object({
  tracked: t.Number(),
  active: t.Number(),
  byPlatform: t.Array(t.Object({ platform: t.String(), count: t.Number() })),
  alertsToday: t.Number(),
  unread: t.Number(),
  newPosts24h: t.Number(),
  failing: t.Number(),
  lastSyncAt: t.Nullable(t.String()),
  // Which platforms this project can actually read, and through which credential.
  providers: t.Array(
    t.Object({ platform: t.String(), available: t.Boolean(), via: t.Nullable(t.String()) }),
  ),
});

export const competitorRoutes = new Elysia({
  name: 'competitors',
  detail: { tags: ['Competitors'] },
})
  .use(authContext)
  .use(guards)
  .macro({
    competitor: entityGuard('competitors', 'Competitor not found', (p) =>
      getCompetitorProjectId(Number(p.competitorId)),
    ),
  })

  .get(
    '/projects/:projectKey/competitors/overview',
    async ({ project }) => {
      const [overview, providers] = await Promise.all([
        getCompetitorOverview(project.id),
        providerStatuses(project.id),
      ]);
      return { ...overview, providers };
    },
    {
      params: projectParams,
      permission: ['competitors', 'read'],
      response: {
        200: OverviewResponse,
        401: ErrorResponse,
        403: ErrorResponse,
        404: ErrorResponse,
      },
      detail: { summary: 'Competitor overview', ...mcpTool('competitors_overview') },
    },
  )

  .get('/projects/:projectKey/competitors', ({ project }) => listCompetitors(project.id), {
    params: projectParams,
    permission: ['competitors', 'read'],
    response: {
      200: t.Array(CompetitorResponse),
      401: ErrorResponse,
      403: ErrorResponse,
      404: ErrorResponse,
    },
    detail: { summary: 'List tracked accounts', ...mcpTool('list_competitors') },
  })

  .get(
    '/projects/:projectKey/competitors/events',
    ({ project, query }) => listCompetitorEvents(project.id, query.limit ?? 50),
    {
      params: projectParams,
      query: t.Object({ limit: t.Optional(t.Numeric({ minimum: 1, maximum: 200 })) }),
      permission: ['competitors', 'read'],
      response: {
        200: t.Array(EventResponse),
        401: ErrorResponse,
        403: ErrorResponse,
        404: ErrorResponse,
      },
      detail: { summary: 'The competitor alert feed', ...mcpTool('competitor_alerts') },
    },
  )

  .post(
    '/projects/:projectKey/competitors',
    async ({ project, body, user, set }) => {
      const handle = normaliseHandle(body.handle);
      if (handle.length === 0) throw new HttpError(400, 'A handle is required');
      if (!/^[\w.-]{1,80}$/.test(handle)) {
        throw new HttpError(400, 'That does not look like an account handle');
      }
      try {
        const row = await createCompetitor({
          projectId: project.id,
          addedByUserId: user?.id ?? null,
          platform: body.platform,
          handle,
          label: body.label?.trim() || null,
          tags: body.tags ?? [],
        });
        set.status = 201;
        return row;
      } catch (error) {
        if (pgErrorCode(error) === '23505') {
          throw new HttpError(409, 'That account is already tracked in this project');
        }
        throw error;
      }
    },
    {
      params: projectParams,
      body: t.Object({
        platform: PlatformSchema,
        // A bare handle, an @handle, or a pasted profile URL — all normalise to the
        // same stored value.
        handle: t.String({ minLength: 1, maxLength: 200 }),
        label: t.Optional(t.String({ maxLength: 120 })),
        tags: t.Optional(TagsSchema),
      }),
      permission: ['competitors', 'create'],
      response: {
        201: CompetitorResponse,
        400: ErrorResponse,
        401: ErrorResponse,
        403: ErrorResponse,
        404: ErrorResponse,
        409: ErrorResponse,
      },
      detail: { summary: 'Track an account', ...mcpTool('track_competitor') },
    },
  )

  .post(
    '/projects/:projectKey/competitors/events/read',
    async ({ project }) => ({ marked: await markEventsRead(project.id) }),
    {
      params: projectParams,
      permission: ['competitors', 'edit'],
      response: {
        200: t.Object({ marked: t.Number() }),
        401: ErrorResponse,
        403: ErrorResponse,
        404: ErrorResponse,
      },
      detail: { summary: 'Mark the alert feed as read' },
    },
  )

  .patch(
    '/competitors/:competitorId',
    async ({ params, body }) => {
      const row = await updateCompetitor(params.competitorId, {
        ...(body.label !== undefined ? { label: body.label?.trim() || null } : {}),
        ...(body.tags != null ? { tags: body.tags } : {}),
        ...(body.active != null ? { active: body.active } : {}),
      });
      if (!row) throw new HttpError(404, 'Competitor not found');
      return row;
    },
    {
      params: competitorParams,
      body: t.Object({
        label: t.Optional(t.Nullable(t.String({ maxLength: 120 }))),
        tags: t.Optional(TagsSchema),
        active: t.Optional(t.Boolean()),
      }),
      competitor: 'edit',
      response: {
        200: CompetitorResponse,
        400: ErrorResponse,
        401: ErrorResponse,
        403: ErrorResponse,
        404: ErrorResponse,
      },
      detail: { summary: 'Update a tracked account' },
    },
  )

  .delete(
    '/competitors/:competitorId',
    async ({ params }) => {
      await deleteCompetitor(params.competitorId);
      return noContent();
    },
    {
      params: competitorParams,
      competitor: 'delete',
      response: { 204: t.Void(), 401: ErrorResponse, 403: ErrorResponse, 404: ErrorResponse },
      detail: { summary: 'Stop tracking an account' },
    },
  )

  // Checks one account now instead of waiting for the sweep. A provider failure is
  // recorded on the account and returned, not thrown: the caller wants to see why.
  .post(
    '/competitors/:competitorId/check',
    async ({ params, projectId }) => {
      const existing = await getCompetitor(params.competitorId);
      if (!existing) throw new HttpError(404, 'Competitor not found');
      const result = await checkCompetitor({
        id: existing.id,
        projectId,
        platform: existing.platform,
        handle: existing.handle,
      });
      const row = await getCompetitor(params.competitorId);
      if (!row) throw new HttpError(404, 'Competitor not found');
      return { ...result, competitor: row };
    },
    {
      params: competitorParams,
      competitor: 'edit',
      response: {
        200: t.Object({
          ok: t.Boolean(),
          events: t.Number(),
          error: t.Optional(t.String()),
          competitor: CompetitorResponse,
        }),
        401: ErrorResponse,
        403: ErrorResponse,
        404: ErrorResponse,
      },
      detail: { summary: 'Check one account now' },
    },
  );
