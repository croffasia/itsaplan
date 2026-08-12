import { Elysia, t } from 'elysia';
import { noContent } from '../shared/http';
import { guards, entityGuard } from '../shared/guards';
import { authContext } from '../shared/auth-context';
import { requireUser } from '../shared/access';
import { HttpError } from '../shared/lib';
import { ErrorResponse } from '../shared/responses';
import { mcpTool } from '../mcp/generate';
import {
  listViews,
  createView,
  getView,
  updateView,
  deleteView,
  reorderViews,
  isFavoriteView,
  addFavoriteView,
  removeFavoriteView,
} from './store';

const viewParams = t.Object({ viewId: t.Numeric() });

// A saved view DTO (ViewRow from the store). filters and display are jsonb blobs
// owned by the UI, returned as-is (t.Any()).
const ViewResponse = t.Object({
  id: t.Number(),
  projectId: t.Number(),
  name: t.String(),
  icon: t.Nullable(t.String()),
  filters: t.Any(),
  display: t.Any(),
  position: t.Number(),
  shareToken: t.Nullable(t.String()),
  shareExtended: t.Boolean(),
  // Personal to the caller, not shared with the other project members.
  favorite: t.Boolean(),
  createdAt: t.String(),
});

export const viewRoutes = new Elysia({ name: 'views', detail: { tags: ['Views'] } })
  .use(authContext)
  .use(guards)
  // Guard for routes that address a view by its own id (no :projectKey in the
  // path). Set `savedView: "<action>"` in the route options.
  .macro({
    savedView: entityGuard(
      'views',
      'View not found',
      async (p) => (await getView(Number(p.viewId)))?.projectId ?? null,
    ),
  })
  .get(
    '/projects/:projectKey/views',
    async ({ project, user }) => {
      return listViews(project.id, requireUser(user).id);
    },
    {
      permission: ['views', 'read'],
      response: {
        200: t.Array(ViewResponse),
        401: ErrorResponse,
        403: ErrorResponse,
        404: ErrorResponse,
      },
      detail: {
        summary: 'List saved views',
        description: "List a project's saved views.",
        ...mcpTool('list_views'),
      },
    },
  )

  .post(
    '/projects/:projectKey/views',
    async ({ project, body, set }) => {
      set.status = 201;
      return { ...(await createView({ projectId: project.id, ...body })), favorite: false };
    },
    {
      body: t.Object({
        name: t.String({ minLength: 1 }),
        icon: t.Optional(t.Nullable(t.String())),
        filters: t.Optional(t.Any()),
        display: t.Optional(t.Any()),
      }),
      permission: ['views', 'create'],
      response: {
        201: ViewResponse,
        400: ErrorResponse,
        401: ErrorResponse,
        403: ErrorResponse,
        404: ErrorResponse,
      },
      detail: {
        summary: 'Create a saved view',
        description: 'Create a saved view in a project.',
        ...mcpTool('create_view'),
      },
    },
  )

  // Sets the tab order to orderedIds.
  .put(
    '/projects/:projectKey/views/reorder',
    async ({ project, body, user }) => {
      return reorderViews(project.id, body.orderedIds, requireUser(user).id);
    },
    {
      body: t.Object({ orderedIds: t.Array(t.Integer(), { minItems: 1 }) }),
      permission: ['views', 'edit'],
      response: {
        200: t.Array(ViewResponse),
        400: ErrorResponse,
        401: ErrorResponse,
        403: ErrorResponse,
        404: ErrorResponse,
      },
      detail: {
        summary: 'Reorder saved views',
        description: "Set the display order of a project's saved views.",
        ...mcpTool('reorder_views'),
      },
    },
  )

  .patch(
    '/views/:viewId',
    async ({ params, body, user }) => {
      const view = await updateView(params.viewId, body);
      if (!view) throw new HttpError(404, 'View not found');
      return { ...view, favorite: await isFavoriteView(view.id, requireUser(user).id) };
    },
    {
      body: t.Object({
        name: t.Optional(t.String({ minLength: 1 })),
        icon: t.Optional(t.Nullable(t.String())),
        filters: t.Optional(t.Any()),
        display: t.Optional(t.Any()),
      }),
      params: viewParams,
      savedView: 'edit',
      response: {
        200: ViewResponse,
        400: ErrorResponse,
        401: ErrorResponse,
        403: ErrorResponse,
        404: ErrorResponse,
      },
      detail: {
        summary: 'Update a saved view',
        description: 'Update an existing saved view.',
        ...mcpTool('update_view'),
      },
    },
  )

  // Favorites are the caller's own, so reading the view is enough to mark one.
  .put(
    '/views/:viewId/favorite',
    async ({ params, user }) => {
      await addFavoriteView(params.viewId, requireUser(user).id);
      return noContent();
    },
    {
      params: viewParams,
      savedView: 'read',
      response: {
        204: t.Void(),
        400: ErrorResponse,
        401: ErrorResponse,
        403: ErrorResponse,
        404: ErrorResponse,
      },
      detail: {
        summary: 'Favorite a saved view',
        description: "Add a saved view to the caller's favorites.",
      },
    },
  )

  .delete(
    '/views/:viewId/favorite',
    async ({ params, user }) => {
      await removeFavoriteView(params.viewId, requireUser(user).id);
      return noContent();
    },
    {
      params: viewParams,
      savedView: 'read',
      response: {
        204: t.Void(),
        400: ErrorResponse,
        401: ErrorResponse,
        403: ErrorResponse,
        404: ErrorResponse,
      },
      detail: {
        summary: 'Unfavorite a saved view',
        description: "Remove a saved view from the caller's favorites.",
      },
    },
  )

  .delete(
    '/views/:viewId',
    async ({ params }) => {
      await deleteView(params.viewId);
      return noContent();
    },
    {
      params: viewParams,
      savedView: 'delete',
      response: {
        204: t.Void(),
        400: ErrorResponse,
        401: ErrorResponse,
        403: ErrorResponse,
        404: ErrorResponse,
      },
      detail: {
        summary: 'Delete a saved view',
        description: 'Delete a saved view. Irreversible.',
        ...mcpTool('delete_view'),
      },
    },
  );
