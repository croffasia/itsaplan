import { Elysia, t } from 'elysia';
import { mcpTool } from '../mcp/generate';
import { noContent } from '../shared/http';
import { guards } from '../shared/guards';
import { HttpError } from '../shared/lib';
import { ErrorResponse } from '../shared/responses';
import { createIssueType, updateIssueType, deleteIssueType } from './store';

const typeParams = t.Object({ projectKey: t.String(), typeId: t.Numeric() });

// An issue type DTO (IssueTypeRow from the store).
const IssueTypeResponse = t.Object({
  id: t.Number(),
  projectId: t.Number(),
  name: t.String(),
  icon: t.String(),
  color: t.String(),
  isDefault: t.Boolean(),
  position: t.Number(),
});

export const issueTypeRoutes = new Elysia({
  name: 'issue-types',
  detail: { tags: ['Issue Types'] },
})
  .use(guards)
  .post(
    '/projects/:projectKey/issue-types',
    async ({ project, body, set }) => {
      set.status = 201;
      return createIssueType({ projectId: project.id, ...body });
    },
    {
      body: t.Object({
        name: t.String({ minLength: 1 }),
        icon: t.Optional(t.String()),
        color: t.Optional(t.String()),
        isDefault: t.Optional(t.Boolean()),
      }),
      permission: ['issue_types', 'create'],
      response: {
        201: IssueTypeResponse,
        400: ErrorResponse,
        401: ErrorResponse,
        403: ErrorResponse,
        404: ErrorResponse,
      },
      detail: {
        summary: 'Create an issue type',
        description:
          'Create an issue type. Set isDefault to make it the default type for new issues.',
        ...mcpTool('create_issue_type'),
      },
    },
  )

  .patch(
    '/projects/:projectKey/issue-types/:typeId',
    async ({ params, project, body }) => {
      const type = await updateIssueType(params.typeId, project.id, body);
      if (!type) throw new HttpError(404, 'Issue type not found');
      return type;
    },
    {
      body: t.Object({
        name: t.Optional(t.String({ minLength: 1 })),
        color: t.Optional(t.String()),
        isDefault: t.Optional(t.Boolean()),
      }),
      params: typeParams,
      permission: ['issue_types', 'edit'],
      response: {
        200: IssueTypeResponse,
        400: ErrorResponse,
        401: ErrorResponse,
        403: ErrorResponse,
        404: ErrorResponse,
      },
      detail: {
        summary: 'Update an issue type',
        description: "Update an issue type's name, color, or default flag.",
        ...mcpTool('update_issue_type'),
      },
    },
  )

  .delete(
    '/projects/:projectKey/issue-types/:typeId',
    async ({ params, project }) => {
      await deleteIssueType(params.typeId, project.id);
      return noContent();
    },
    {
      params: typeParams,
      permission: ['issue_types', 'delete'],
      response: {
        204: t.Void(),
        400: ErrorResponse,
        401: ErrorResponse,
        403: ErrorResponse,
        404: ErrorResponse,
      },
      detail: {
        summary: 'Delete an issue type',
        description: 'Delete an issue type.',
        ...mcpTool('delete_issue_type'),
      },
    },
  );
