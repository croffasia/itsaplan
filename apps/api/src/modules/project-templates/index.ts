import { Elysia, t } from 'elysia';
import { noContent } from '#shared/http';
import { guards } from '#shared/guards';
import { errors } from '#shared/responses';
import { mcpTool } from '#mcp/generate';
import { teamParams } from '#modules/teams/model';
import {
  ProjectTemplateDetailResponse,
  ProjectTemplateListResponse,
  ProjectTemplateResponse,
  projectTemplateParams,
  saveProjectTemplateBody,
} from './model';
import {
  deleteProjectTemplate,
  getProjectTemplate,
  listProjectTemplates,
  saveProjectTemplate,
} from './service';

// The project templates of a team: saved copies of a project's configuration that new
// projects are created from (POST /teams/:teamId/projects with templateId). They are
// run by the team's owners and managers, who create its projects.
export const projectTemplateRoutes = new Elysia({
  name: 'project-templates',
  detail: { tags: ['Project Templates'] },
})
  .use(guards)

  .get(
    '/teams/:teamId/project-templates',
    ({ membership }) => listProjectTemplates(membership.teamId),
    {
      teamManager: true,
      params: teamParams,
      response: { 200: ProjectTemplateListResponse, ...errors(401, 403, 404) },
      detail: {
        summary: 'List project templates',
        description:
          'Every project template of the team, by name. Pass its id as templateId to ' +
          'create_project to create a project from it.',
        ...mcpTool('list_project_templates'),
      },
    },
  )

  .get(
    '/teams/:teamId/project-templates/:templateId',
    ({ membership, params }) =>
      getProjectTemplate(membership.teamId, params.templateId, membership.userId),
    {
      teamManager: true,
      params: projectTemplateParams,
      response: { 200: ProjectTemplateDetailResponse, ...errors(401, 403, 404) },
      detail: {
        summary: 'Get a project template',
        description:
          'What a project template holds: its states, issue types, labels, custom fields, ' +
          'issue templates, views, dashboards, actions, the sections it turns on and its ' +
          'estimates.',
        ...mcpTool('get_project_template'),
      },
    },
  )

  .post(
    '/teams/:teamId/project-templates',
    async ({ body, membership, set }) => {
      set.status = 201;
      return saveProjectTemplate(membership.teamId, body, membership.userId);
    },
    {
      teamManager: true,
      params: teamParams,
      body: saveProjectTemplateBody,
      response: { 201: ProjectTemplateResponse, ...errors(400, 401, 403, 404, 409) },
      detail: {
        summary: 'Save a project as a template',
        description:
          "Save a copy of a team project's configuration, without its issues, as a project " +
          'template. Later changes to the project do not change the template. `include` ' +
          'chooses the sections as for a copy; docs, webhooks, agents and schedules are ' +
          'never saved.',
      },
    },
  )

  .delete(
    '/teams/:teamId/project-templates/:templateId',
    async ({ membership, params }) => {
      await deleteProjectTemplate(membership.teamId, params.templateId);
      return noContent();
    },
    {
      teamManager: true,
      params: projectTemplateParams,
      response: { 204: t.Void(), ...errors(401, 403, 404) },
      detail: {
        summary: 'Delete a project template',
        description: 'Delete a project template. Projects created from it are not changed.',
      },
    },
  );
