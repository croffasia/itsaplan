import { Elysia, t } from 'elysia';
import { noContent } from '#shared/http';
import { guards, entityGuard, requiresPermission, assertProjectReachable } from '#shared/guards';
import { authContext } from '#shared/auth-context';
import { assertPermission, requireUser, type AuthUser } from '#shared/access';
import { HttpError } from '#shared/lib';
import { accessErrors, commonErrors } from '#shared/responses';
import { mcpTool } from '#mcp/generate';
import type { ViewRow } from './service';
import {
  ViewResponse,
  createViewBody,
  reorderViewsBody,
  updateViewBody,
  viewParams,
} from './model';
import {
  listViews,
  createView,
  getView,
  updateView,
  publishView,
  deleteView,
  reorderViews,
  includesProjectViews,
  isFavoriteView,
  addFavoriteView,
  removeFavoriteView,
} from './service';

// The routes that act on one view resolve it themselves, as GET /issues/:issueId does, so each
// publishes the one permission it asks for: one's own private view needs only reading the
// views, a project's view the action itself. Someone else's private view is not found.
async function resolveView(
  viewId: number,
  user: AuthUser | null | undefined,
  request: Request,
  action: 'create' | 'edit' | 'delete',
): Promise<ViewRow> {
  const view = await getView(viewId, requireUser(user).id);
  if (!view) throw new HttpError(404, 'View not found');
  await assertPermission(view.projectId, user, 'views', view.isPrivate ? 'read' : action);
  await assertProjectReachable(view.projectId, request);
  return view;
}

export const viewRoutes = new Elysia({ name: 'views', detail: { tags: ['Views'] } })
  .use(authContext)
  .use(guards)
  // To anyone but its owner a private view does not exist.
  .macro({
    savedView: entityGuard(
      'views',
      'View not found',
      async (p, user) => (await getView(Number(p.viewId), user?.id ?? null))?.projectId ?? null,
    ),
  })
  .get(
    '/projects/:projectKey/views',
    async ({ project, user }) => {
      return listViews(project.id, requireUser(user).id);
    },
    {
      permission: ['views', 'read'],
      response: { 200: t.Array(ViewResponse), ...accessErrors },
      detail: {
        summary: 'List saved views',
        description: "List a project's saved views.",
        ...mcpTool('list_views'),
      },
    },
  )

  .post(
    '/projects/:projectKey/views',
    async ({ project, body, set, user }) => {
      const { isPrivate, ...view } = body;
      await assertPermission(project.id, user, 'views', isPrivate ? 'read' : 'create');
      set.status = 201;
      return {
        ...(await createView({
          projectId: project.id,
          ...view,
          ownerUserId: isPrivate ? requireUser(user).id : null,
        })),
        favorite: false,
      };
    },
    {
      body: createViewBody,
      projectMember: true,
      response: { 201: ViewResponse, ...commonErrors },
      detail: {
        summary: 'Create a saved view',
        description: 'Create a saved view in a project, or a private one of your own.',
        ...requiresPermission(['views', 'create']),
        ...mcpTool('create_view'),
      },
    },
  )

  .put(
    '/projects/:projectKey/views/reorder',
    async ({ project, body, user }) => {
      // The project's order is shared by everyone in it, so moving its views also takes
      // editing them; one's own private views need reading alone.
      const withProjectViews = await includesProjectViews(project.id, body.orderedIds);
      if (withProjectViews) await assertPermission(project.id, user, 'views', 'edit');
      return reorderViews(project.id, body.orderedIds, requireUser(user).id, withProjectViews);
    },
    {
      body: reorderViewsBody,
      permission: ['views', 'read'],
      response: { 200: t.Array(ViewResponse), ...commonErrors },
      detail: {
        summary: 'Reorder saved views',
        description:
          "Set the display order of a project's saved views, which also takes editing views, or of your own private ones, which follow them.",
        ...mcpTool('reorder_views'),
      },
    },
  )

  .patch(
    '/views/:viewId',
    async ({ params, body, user, request }) => {
      await resolveView(params.viewId, user, request, 'edit');
      const view = await updateView(params.viewId, body);
      if (!view) throw new HttpError(404, 'View not found');
      return { ...view, favorite: await isFavoriteView(view.id, requireUser(user).id) };
    },
    {
      body: updateViewBody,
      params: viewParams,
      response: { 200: ViewResponse, ...commonErrors },
      detail: {
        summary: 'Update a saved view',
        description: 'Update an existing saved view.',
        ...requiresPermission(['views', 'edit']),
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
      response: { 204: t.Void(), ...commonErrors },
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
      response: { 204: t.Void(), ...commonErrors },
      detail: {
        summary: 'Unfavorite a saved view',
        description: "Remove a saved view from the caller's favorites.",
      },
    },
  )

  .post(
    '/views/:viewId/publish',
    async ({ params, user, request }) => {
      const current = await resolveView(params.viewId, user, request, 'create');
      if (!current.isPrivate) throw new HttpError(400, 'Only a private view is published');
      await assertPermission(current.projectId, user, 'views', 'create');
      const view = await publishView(current.id, current.projectId);
      if (!view) throw new HttpError(404, 'View not found');
      return { ...view, favorite: await isFavoriteView(view.id, requireUser(user).id) };
    },
    {
      params: viewParams,
      response: { 200: ViewResponse, ...commonErrors },
      detail: {
        summary: 'Publish a private view',
        description:
          "Turn one of your private views into a view of the project, at the end of the project's order. It cannot be made private again.",
        ...requiresPermission(['views', 'create']),
        ...mcpTool('publish_view'),
      },
    },
  )

  .delete(
    '/views/:viewId',
    async ({ params, user, request }) => {
      await resolveView(params.viewId, user, request, 'delete');
      await deleteView(params.viewId);
      return noContent();
    },
    {
      params: viewParams,
      response: { 204: t.Void(), ...commonErrors },
      detail: {
        summary: 'Delete a saved view',
        description: 'Delete a saved view. Irreversible.',
        ...requiresPermission(['views', 'delete']),
        ...mcpTool('delete_view'),
      },
    },
  );
