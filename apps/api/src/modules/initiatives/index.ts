import { Elysia, t } from 'elysia';
import { mcpTool } from '#mcp/generate';
import { noContent } from '#shared/http';
import { guards, entityGuard } from '#shared/guards';
import { authContext } from '#shared/auth-context';
import { requireUser } from '#shared/access';
import { HttpError } from '#shared/lib';
import { commonErrors } from '#shared/responses';
import {
  FeedPageResponse,
  InitiativeCountsResponse,
  InitiativeOptionListResponse,
  InitiativePageResponse,
  InitiativeResponse,
  createInitiativeBody,
  initiativeFeedQuery,
  initiativeOptionsQuery,
  initiativeParams,
  listInitiativesQuery,
  updateInitiativeBody,
} from './model';
import {
  listInitiatives,
  listInitiativeOptions,
  initiativeStatusCounts,
  getInitiative,
  getInitiativeProjectId,
  createInitiative,
  updateInitiative,
  deleteInitiative,
} from './service';
import { listFeed } from './activity';

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
      query: listInitiativesQuery,
      permission: ['initiatives', 'read'],
      response: { 200: InitiativePageResponse, ...commonErrors },
      detail: {
        summary: 'List initiatives',
        description: "List a project's initiatives, filtered, sorted and paged.",
        ...mcpTool('list_initiatives'),
      },
    },
  )

  // Fills the initiative picker on an issue. Read under work items: linking an issue
  // needs the titles, not the initiative pages the `initiatives` resource gates.
  .get(
    '/projects/:projectKey/initiatives/options',
    async ({ project, query }) => listInitiativeOptions(project.id, query),
    {
      query: initiativeOptionsQuery,
      permission: ['work_items', 'read'],
      response: { 200: InitiativeOptionListResponse, ...commonErrors },
      detail: {
        summary: 'List initiative options',
        description: 'The initiatives an issue can be linked to: id, title and status.',
      },
    },
  )

  .get(
    '/projects/:projectKey/initiatives/counts',
    async ({ project }) => initiativeStatusCounts(project.id),
    {
      permission: ['initiatives', 'read'],
      response: { 200: InitiativeCountsResponse, ...commonErrors },
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
      body: createInitiativeBody,
      permission: ['initiatives', 'create'],
      response: { 201: InitiativeResponse, ...commonErrors },
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
      response: { 200: InitiativeResponse, ...commonErrors },
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
      body: updateInitiativeBody,
      initiative: 'edit',
      response: { 200: InitiativeResponse, ...commonErrors },
      detail: {
        summary: 'Update an initiative',
        description:
          "Update an initiative by its numeric id. labelIds replaces the initiative's labels.",
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
      response: { 204: t.Void(), ...commonErrors },
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
      const limit = query.limit != null ? Number(query.limit) : undefined;
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
      query: initiativeFeedQuery,
      initiative: 'read',
      response: { 200: FeedPageResponse, ...commonErrors },
      detail: {
        summary: 'Get an initiative feed',
        description: "Get an initiative's activity feed by its numeric id.",
        ...mcpTool('list_initiative_activity'),
      },
    },
  );
