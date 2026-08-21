import { Elysia, t } from 'elysia';
import { noContent } from '#shared/http';
import { guards } from '#shared/guards';
import { HttpError } from '#shared/lib';
import { commonErrors } from '#shared/responses';
import { mcpTool } from '#mcp/generate';
import {
  CustomFieldListResponse,
  CustomFieldResponse,
  createCustomFieldBody,
  fieldParams,
  listFieldsQuery,
  updateCustomFieldBody,
} from './model';
import {
  listCustomFields,
  createCustomField,
  updateCustomField,
  deleteCustomField,
} from './service';

export const customFieldRoutes = new Elysia({
  name: 'custom-fields',
  detail: { tags: ['Custom Fields'] },
})
  .use(guards)
  // issueTypeId query param includes that type's own fields alongside the
  // project-wide ones; omitting it returns only the project-wide fields.
  .get(
    '/projects/:projectKey/custom-fields',
    async ({ project, query }) => {
      return listCustomFields(project.id, { issueTypeId: query.issueTypeId });
    },
    {
      query: listFieldsQuery,
      permission: ['custom_fields', 'read'],
      response: { 200: CustomFieldListResponse, ...commonErrors },
      detail: {
        summary: "List a project's custom fields",
        description: "List a project's custom fields.",
        ...mcpTool('list_custom_fields'),
      },
    },
  )

  .post(
    '/projects/:projectKey/custom-fields',
    async ({ project, body, set }) => {
      set.status = 201;
      return createCustomField({ projectId: project.id, ...body });
    },
    {
      body: createCustomFieldBody,
      permission: ['custom_fields', 'create'],
      response: { 201: CustomFieldResponse, ...commonErrors },
      detail: {
        summary: 'Create a custom field',
        description: 'Create a custom field for a project.',
        ...mcpTool('create_custom_field'),
      },
    },
  )

  .patch(
    '/projects/:projectKey/custom-fields/:fieldId',
    async ({ project, params, body }) => {
      const field = await updateCustomField(project.id, params.fieldId, body);
      if (!field) throw new HttpError(404, 'Custom field not found');
      return field;
    },
    {
      body: updateCustomFieldBody,
      params: fieldParams,
      permission: ['custom_fields', 'edit'],
      response: { 200: CustomFieldResponse, ...commonErrors },
      detail: {
        summary: 'Update a custom field',
        description:
          'Update a custom field. Changing its type clears the values issues hold in it, ' +
          'narrowing a member scope clears the ones it no longer allows, and an option left ' +
          'out of `options` is deleted along with the selections of it.',
        ...mcpTool('update_custom_field'),
      },
    },
  )

  .delete(
    '/projects/:projectKey/custom-fields/:fieldId',
    async ({ project, params }) => {
      const deleted = await deleteCustomField(project.id, params.fieldId);
      if (!deleted) throw new HttpError(404, 'Custom field not found');
      return noContent();
    },
    {
      params: fieldParams,
      permission: ['custom_fields', 'delete'],
      response: { 204: t.Void(), ...commonErrors },
      detail: {
        summary: 'Delete a custom field',
        description: 'Delete a custom field.',
        ...mcpTool('delete_custom_field'),
      },
    },
  );
