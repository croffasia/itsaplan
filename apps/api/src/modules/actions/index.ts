import { Elysia, t } from 'elysia';
import { noContent } from '#shared/http';
import { guards, entityGuard } from '#shared/guards';
import { authContext } from '#shared/auth-context';
import { HttpError } from '#shared/lib';
import { mcpTool } from '#mcp/generate';
import { accessErrors, commonErrors } from '#shared/responses';
import {
  ActionResponse,
  ActionListResponse,
  actionParams,
  createActionBody,
  updateActionBody,
  reorderActionsBody,
} from './model';
import {
  listActions,
  createAction,
  getAction,
  updateAction,
  deleteAction,
  reorderActions,
} from './service';

export const actionRoutes = new Elysia({ name: 'actions', detail: { tags: ['Actions'] } })
  .use(authContext)
  .use(guards)
  // Guard for routes that address an action by its own id (no :projectKey in the
  // path). Set `savedAction: "<action>"` in the route options.
  .macro({
    savedAction: entityGuard(
      'actions',
      'Action not found',
      async (p) => (await getAction(Number(p.actionId)))?.projectId ?? null,
    ),
  })
  .get(
    '/projects/:projectKey/actions',
    async ({ project }) => {
      return listActions(project.id);
    },
    {
      permission: ['actions', 'read'],
      response: { 200: ActionListResponse, ...accessErrors },
      detail: {
        summary: 'List actions',
        description: "List a project's actions.",
        ...mcpTool('list_actions'),
      },
    },
  )

  // The same list, readable by any project member. The issue quick actions (board
  // context menu, issue detail) run off it, so a member who cannot manage actions
  // still sees the ones that apply to an issue.
  .get(
    '/projects/:projectKey/actions/quick',
    async ({ project }) => {
      return listActions(project.id);
    },
    {
      projectMember: true,
      response: { 200: ActionListResponse, ...accessErrors },
      detail: {
        summary: 'List quick actions',
        description: "List a project's actions for the issue quick actions.",
      },
    },
  )

  .post(
    '/projects/:projectKey/actions',
    async ({ project, body, set }) => {
      set.status = 201;
      return createAction({ projectId: project.id, ...body });
    },
    {
      body: createActionBody,
      permission: ['actions', 'create'],
      response: { 201: ActionResponse, ...commonErrors },
      detail: {
        summary: 'Create an action',
        description: 'Create an action in a project.',
        ...mcpTool('create_action'),
      },
    },
  )

  // Sets the action order to orderedIds.
  .put(
    '/projects/:projectKey/actions/reorder',
    async ({ project, body }) => {
      return reorderActions(project.id, body.orderedIds);
    },
    {
      body: reorderActionsBody,
      permission: ['actions', 'edit'],
      response: { 200: ActionListResponse, ...commonErrors },
      detail: {
        summary: 'Reorder actions',
        description: "Set the display order of a project's actions.",
        ...mcpTool('reorder_actions'),
      },
    },
  )

  .patch(
    '/actions/:actionId',
    async ({ params, body }) => {
      const action = await updateAction(params.actionId, body);
      if (!action) throw new HttpError(404, 'Action not found');
      return action;
    },
    {
      body: updateActionBody,
      params: actionParams,
      savedAction: 'edit',
      response: { 200: ActionResponse, ...commonErrors },
      detail: {
        summary: 'Update an action',
        description: 'Update an existing action.',
        ...mcpTool('update_action'),
      },
    },
  )

  .delete(
    '/actions/:actionId',
    async ({ params }) => {
      await deleteAction(params.actionId);
      return noContent();
    },
    {
      params: actionParams,
      savedAction: 'delete',
      response: { 204: t.Void(), ...commonErrors },
      detail: {
        summary: 'Delete an action',
        description: 'Delete an action. Irreversible.',
        ...mcpTool('delete_action'),
      },
    },
  );
