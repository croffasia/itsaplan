import { Elysia, t } from 'elysia';
import { noContent } from '#shared/http';
import { guards } from '#shared/guards';
import { HttpError } from '#shared/lib';
import { commonErrors } from '#shared/responses';
import { mcpTool } from '#mcp/generate';
import {
  IssueTemplateListResponse,
  IssueTemplateResponse,
  createIssueTemplateBody,
  templateParams,
  updateIssueTemplateBody,
} from './model';
import {
  listIssueTemplates,
  createIssueTemplate,
  updateIssueTemplate,
  deleteIssueTemplate,
} from './service';

export const issueTemplateRoutes = new Elysia({
  name: 'issue-templates',
  detail: { tags: ['Issue Templates'] },
})
  .use(guards)
  .get(
    '/projects/:projectKey/issue-templates',
    async ({ project }) => {
      return listIssueTemplates(project.id);
    },
    {
      permission: ['issue_templates', 'read'],
      response: { 200: IssueTemplateListResponse, ...commonErrors },
      detail: {
        summary: "List a project's issue templates",
        description: "List a project's issue templates.",
        ...mcpTool('list_issue_templates'),
      },
    },
  )

  .post(
    '/projects/:projectKey/issue-templates',
    async ({ project, body, set }) => {
      set.status = 201;
      return createIssueTemplate(project.id, body);
    },
    {
      body: createIssueTemplateBody,
      permission: ['issue_templates', 'create'],
      response: { 201: IssueTemplateResponse, ...commonErrors },
      detail: {
        summary: 'Create an issue template',
        description:
          'Create an issue template: the title, description and properties a new issue ' +
          'starts with when it is created from the template.',
        ...mcpTool('create_issue_template'),
      },
    },
  )

  .patch(
    '/projects/:projectKey/issue-templates/:templateId',
    async ({ project, params, body }) => {
      const template = await updateIssueTemplate(project.id, params.templateId, body);
      if (!template) throw new HttpError(404, 'Issue template not found');
      return template;
    },
    {
      body: updateIssueTemplateBody,
      params: templateParams,
      permission: ['issue_templates', 'edit'],
      response: { 200: IssueTemplateResponse, ...commonErrors },
      detail: {
        summary: 'Update an issue template',
        description:
          'Update an issue template. A property left out of the body keeps its value; ' +
          '`labelIds` replaces the whole label set.',
        ...mcpTool('update_issue_template'),
      },
    },
  )

  .delete(
    '/projects/:projectKey/issue-templates/:templateId',
    async ({ project, params }) => {
      const deleted = await deleteIssueTemplate(project.id, params.templateId);
      if (!deleted) throw new HttpError(404, 'Issue template not found');
      return noContent();
    },
    {
      params: templateParams,
      permission: ['issue_templates', 'delete'],
      response: { 204: t.Void(), ...commonErrors },
      detail: {
        summary: 'Delete an issue template',
        description: 'Delete an issue template. The issues created from it are untouched.',
        ...mcpTool('delete_issue_template'),
      },
    },
  );
