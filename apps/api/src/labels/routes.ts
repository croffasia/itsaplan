import { Elysia, t } from 'elysia';
import { mcpTool } from '../mcp/generate';
import { noContent } from '../shared/http';
import { guards } from '../shared/guards';
import { HttpError, rethrowDuplicate } from '../shared/lib';
import { ErrorResponse } from '../shared/responses';
import {
  createLabel,
  updateLabel,
  deleteLabel,
  createLabelGroup,
  updateLabelGroup,
  deleteLabelGroup,
} from './store';

const labelParams = t.Object({ projectKey: t.String(), labelId: t.Numeric() });
const groupParams = t.Object({ projectKey: t.String(), groupId: t.Numeric() });

// A label DTO (LabelRow from the store).
const LabelResponse = t.Object({
  id: t.Number(),
  projectId: t.Number(),
  groupId: t.Nullable(t.Number()),
  name: t.String(),
  color: t.String(),
});

// A label group DTO (LabelGroupRow from the store).
const LabelGroupResponse = t.Object({
  id: t.Number(),
  projectId: t.Number(),
  name: t.String(),
  color: t.String(),
});

export const labelRoutes = new Elysia({ name: 'labels', detail: { tags: ['Labels'] } })
  .use(guards)
  // --- Labels ------------------------------------------------------------------
  .post(
    '/projects/:projectKey/labels',
    async ({ project, body, set }) => {
      try {
        set.status = 201;
        return await createLabel({ projectId: project.id, ...body });
      } catch (err) {
        rethrowDuplicate(err, 'label');
      }
    },
    {
      body: t.Object({
        name: t.String({ minLength: 1 }),
        color: t.Optional(t.String()),
        groupId: t.Optional(t.Nullable(t.Integer())),
      }),
      permission: ['labels', 'create'],
      response: {
        201: LabelResponse,
        400: ErrorResponse,
        401: ErrorResponse,
        403: ErrorResponse,
        404: ErrorResponse,
        409: ErrorResponse,
      },
      detail: {
        summary: 'Create a label',
        description: 'Create a label. Optional groupId assigns it to a label group.',
        ...mcpTool('create_label'),
      },
    },
  )

  .patch(
    '/projects/:projectKey/labels/:labelId',
    async ({ params, project, body }) => {
      let label;
      try {
        label = await updateLabel(params.labelId, project.id, body);
      } catch (err) {
        rethrowDuplicate(err, 'label');
      }
      if (!label) throw new HttpError(404, 'Label not found');
      return label;
    },
    {
      body: t.Object({
        name: t.Optional(t.String({ minLength: 1 })),
        color: t.Optional(t.String()),
        groupId: t.Optional(t.Nullable(t.Integer())),
      }),
      params: labelParams,
      permission: ['labels', 'edit'],
      response: {
        200: LabelResponse,
        400: ErrorResponse,
        401: ErrorResponse,
        403: ErrorResponse,
        404: ErrorResponse,
        409: ErrorResponse,
      },
      detail: {
        summary: 'Update a label',
        description:
          "Update a label's name, color, or group. Set groupId to null to remove it from its group.",
        ...mcpTool('update_label'),
      },
    },
  )

  .delete(
    '/projects/:projectKey/labels/:labelId',
    async ({ params, project }) => {
      await deleteLabel(params.labelId, project.id);
      return noContent();
    },
    {
      params: labelParams,
      permission: ['labels', 'delete'],
      response: {
        204: t.Void(),
        400: ErrorResponse,
        401: ErrorResponse,
        403: ErrorResponse,
        404: ErrorResponse,
      },
      detail: {
        summary: 'Delete a label',
        description: 'Delete a label.',
        ...mcpTool('delete_label'),
      },
    },
  )

  // --- Label groups ------------------------------------------------------------
  .post(
    '/projects/:projectKey/label-groups',
    async ({ project, body, set }) => {
      try {
        set.status = 201;
        return await createLabelGroup({ projectId: project.id, ...body });
      } catch (err) {
        rethrowDuplicate(err, 'label group');
      }
    },
    {
      body: t.Object({ name: t.String({ minLength: 1 }), color: t.Optional(t.String()) }),
      permission: ['labels', 'create'],
      response: {
        201: LabelGroupResponse,
        400: ErrorResponse,
        401: ErrorResponse,
        403: ErrorResponse,
        404: ErrorResponse,
        409: ErrorResponse,
      },
      detail: {
        summary: 'Create a label group',
        description: 'Create a label group, a named container for labels.',
        ...mcpTool('create_label_group'),
      },
    },
  )

  .patch(
    '/projects/:projectKey/label-groups/:groupId',
    async ({ params, project, body }) => {
      let group;
      try {
        group = await updateLabelGroup(params.groupId, project.id, body);
      } catch (err) {
        rethrowDuplicate(err, 'label group');
      }
      if (!group) throw new HttpError(404, 'Label group not found');
      return group;
    },
    {
      body: t.Object({
        name: t.Optional(t.String({ minLength: 1 })),
        color: t.Optional(t.String()),
      }),
      params: groupParams,
      permission: ['labels', 'edit'],
      response: {
        200: LabelGroupResponse,
        400: ErrorResponse,
        401: ErrorResponse,
        403: ErrorResponse,
        404: ErrorResponse,
        409: ErrorResponse,
      },
      detail: {
        summary: 'Update a label group',
        description: "Update a label group's name or color.",
        ...mcpTool('update_label_group'),
      },
    },
  )

  .delete(
    '/projects/:projectKey/label-groups/:groupId',
    async ({ params, project }) => {
      await deleteLabelGroup(params.groupId, project.id);
      return noContent();
    },
    {
      params: groupParams,
      permission: ['labels', 'delete'],
      response: {
        204: t.Void(),
        400: ErrorResponse,
        401: ErrorResponse,
        403: ErrorResponse,
        404: ErrorResponse,
      },
      detail: {
        summary: 'Delete a label group',
        description: 'Delete a label group.',
        ...mcpTool('delete_label_group'),
      },
    },
  );
