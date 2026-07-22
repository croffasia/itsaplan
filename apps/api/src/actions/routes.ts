import { Elysia, t } from 'elysia';
import { noContent } from '../shared/http';
import { guards, entityGuard } from '../shared/guards';
import { authContext } from '../shared/auth-context';
import { HttpError } from '../shared/lib';
import { mcpTool } from '../mcp/generate';
import { ErrorResponse } from '../shared/responses';
import {
  listActions,
  createAction,
  getAction,
  updateAction,
  deleteAction,
  reorderActions,
} from './store';

const actionParams = t.Object({ actionId: t.Numeric() });

// An action DTO (ActionRow from the store). condition and effect are jsonb blobs
// owned by the UI, stored and returned without inspecting their shape.
const ActionResponse = t.Object({
  id: t.Number(),
  projectId: t.Number(),
  name: t.String(),
  icon: t.String(),
  condition: t.Any(),
  effect: t.Any(),
  position: t.Number(),
  createdAt: t.String(),
});

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
      response: {
        200: t.Array(ActionResponse),
        401: ErrorResponse,
        403: ErrorResponse,
        404: ErrorResponse,
      },
      detail: {
        summary: 'List actions',
        description: "List a project's actions.",
        ...mcpTool('list_actions'),
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
      body: t.Object({
        name: t.String({ minLength: 1 }),
        icon: t.Optional(t.String()),
        condition: t.Optional(t.Any()),
        effect: t.Optional(t.Any()),
      }),
      permission: ['actions', 'create'],
      response: {
        201: ActionResponse,
        400: ErrorResponse,
        401: ErrorResponse,
        403: ErrorResponse,
        404: ErrorResponse,
      },
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
      body: t.Object({ orderedIds: t.Array(t.Integer(), { minItems: 1 }) }),
      permission: ['actions', 'edit'],
      response: {
        200: t.Array(ActionResponse),
        400: ErrorResponse,
        401: ErrorResponse,
        403: ErrorResponse,
        404: ErrorResponse,
      },
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
      body: t.Object({
        name: t.Optional(t.String({ minLength: 1 })),
        icon: t.Optional(t.String()),
        condition: t.Optional(t.Any()),
        effect: t.Optional(t.Any()),
      }),
      params: actionParams,
      savedAction: 'edit',
      response: {
        200: ActionResponse,
        400: ErrorResponse,
        401: ErrorResponse,
        403: ErrorResponse,
        404: ErrorResponse,
      },
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
      response: {
        204: t.Void(),
        400: ErrorResponse,
        401: ErrorResponse,
        403: ErrorResponse,
        404: ErrorResponse,
      },
      detail: {
        summary: 'Delete an action',
        description: 'Delete an action. Irreversible.',
        ...mcpTool('delete_action'),
      },
    },
  );
