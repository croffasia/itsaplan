import { Elysia, t } from 'elysia';
import { mcpTool } from '#mcp/generate';
import { noContent } from '#shared/http';
import { guards } from '#shared/guards';
import { HttpError } from '#shared/lib';
import { commonErrors } from '#shared/responses';
import {
  IssueTypeResponse,
  createIssueTypeBody,
  issueTypeParams,
  updateIssueTypeBody,
} from './model';
import { createIssueType, updateIssueType, deleteIssueType } from './service';

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
      body: createIssueTypeBody,
      permission: ['issue_types', 'create'],
      response: { 201: IssueTypeResponse, ...commonErrors },
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
      body: updateIssueTypeBody,
      params: issueTypeParams,
      permission: ['issue_types', 'edit'],
      response: { 200: IssueTypeResponse, ...commonErrors },
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
      params: issueTypeParams,
      permission: ['issue_types', 'delete'],
      response: { 204: t.Void(), ...commonErrors },
      detail: {
        summary: 'Delete an issue type',
        description: 'Delete an issue type.',
        ...mcpTool('delete_issue_type'),
      },
    },
  );
