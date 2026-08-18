import { Elysia, t } from 'elysia';
import { mcpTool } from '#mcp/generate';
import { noContent } from '#shared/http';
import { guards } from '#shared/guards';
import { HttpError, rethrowDuplicate } from '#shared/lib';
import { commonErrors, errors } from '#shared/responses';
import {
  LabelGroupResponse,
  LabelResponse,
  createLabelBody,
  createLabelGroupBody,
  labelGroupParams,
  labelParams,
  updateLabelBody,
  updateLabelGroupBody,
} from './model';
import {
  createLabel,
  updateLabel,
  deleteLabel,
  createLabelGroup,
  updateLabelGroup,
  deleteLabelGroup,
} from './service';

export const labelRoutes = new Elysia({ name: 'labels', detail: { tags: ['Labels'] } })
  .use(guards)
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
      body: createLabelBody,
      permission: ['labels', 'create'],
      response: { 201: LabelResponse, ...commonErrors, ...errors(409) },
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
      body: updateLabelBody,
      params: labelParams,
      permission: ['labels', 'edit'],
      response: { 200: LabelResponse, ...commonErrors, ...errors(409) },
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
      response: { 204: t.Void(), ...commonErrors },
      detail: {
        summary: 'Delete a label',
        description: 'Delete a label.',
        ...mcpTool('delete_label'),
      },
    },
  )

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
      body: createLabelGroupBody,
      permission: ['labels', 'create'],
      response: { 201: LabelGroupResponse, ...commonErrors, ...errors(409) },
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
      body: updateLabelGroupBody,
      params: labelGroupParams,
      permission: ['labels', 'edit'],
      response: { 200: LabelGroupResponse, ...commonErrors, ...errors(409) },
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
      params: labelGroupParams,
      permission: ['labels', 'delete'],
      response: { 204: t.Void(), ...commonErrors },
      detail: {
        summary: 'Delete a label group',
        description: 'Delete a label group.',
        ...mcpTool('delete_label_group'),
      },
    },
  );
