import { Elysia, t } from 'elysia';
import { noContent } from '#shared/http';
import { guards } from '#shared/guards';
import { errors } from '#shared/responses';
import { mcpTool } from '#mcp/generate';
import { teamParams } from '#modules/teams/model';
import { workspaceParams } from '#modules/workspaces/model';
import {
  ProjectTemplateContentsResponse,
  ProjectTemplateDetailResponse,
  ProjectTemplateListResponse,
  TemplatePublicationResponse,
  TemplatePublisherResponse,
  WorkspaceProjectTemplateListResponse,
  previewProjectTemplateBody,
  ProjectTemplateResponse,
  importProjectTemplateBody,
  linkPublisherBody,
  publisherCodeBody,
  publisherAuthorBody,
  previewImportedTemplateBody,
  saveProjectTemplateBody,
  SharedProjectTemplate,
  teamTemplateParams,
  updateProjectTemplateBody,
  workspaceTemplateParams,
} from './model';
import {
  deleteProjectTemplate,
  getTeamTemplate,
  getWorkspaceTemplate,
  listTeamTemplates,
  listWorkspaceTemplates,
  previewProjectTemplate,
  saveProjectTemplate,
  updateProjectTemplate,
} from './service';
import {
  getTemplatePublisher,
  linkTemplatePublisher,
  publishTemplate,
  requestPublisherCode,
  setTemplatePublisherAuthor,
  unlinkTemplatePublisher,
  unpublishTemplate,
} from './publish';
import { exportProjectTemplate, importProjectTemplate, previewImportedTemplate } from './share';

// The project templates of a workspace: snapshots of a project's configuration that new
// projects are created from (POST /teams/:teamId/projects with templateId). The
// workspace's owner and its admins save, edit and delete them. A team's owners and managers,
// who create its projects, read the ones open to their team.
export const projectTemplateRoutes = new Elysia({
  name: 'project-templates',
  detail: { tags: ['Project Templates'] },
})
  .use(guards)

  .get(
    '/workspaces/:workspaceId/project-templates',
    ({ standing }) => listWorkspaceTemplates(standing.workspaceId),
    {
      workspaceManager: true,
      params: workspaceParams,
      response: { 200: WorkspaceProjectTemplateListResponse, ...errors(400, 401, 404) },
      detail: {
        summary: 'List the project templates of a workspace',
        description:
          'Every project template of the workspace, by name, with the teams it is limited to.',
      },
    },
  )

  .get(
    '/workspaces/:workspaceId/project-templates/:templateId',
    ({ standing, params }) => getWorkspaceTemplate(standing.workspaceId, params.templateId),
    {
      workspaceManager: true,
      params: workspaceTemplateParams,
      response: { 200: ProjectTemplateDetailResponse, ...errors(400, 401, 404) },
      detail: {
        summary: 'Get a project template of a workspace',
        description:
          'What a project template holds: its states, issue types, labels, custom fields, ' +
          'issue templates, views, dashboards, actions, settings, the sections it turns on ' +
          'and its estimates.',
      },
    },
  )

  .post(
    '/workspaces/:workspaceId/project-templates/preview',
    ({ body, standing }) => previewProjectTemplate(standing.workspaceId, body),
    {
      workspaceManager: true,
      params: workspaceParams,
      body: previewProjectTemplateBody,
      response: { 200: ProjectTemplateContentsResponse, ...errors(400, 401, 404) },
      detail: {
        summary: 'Preview a project template',
        description:
          'What a template saved from the project with this `include` would hold. Saves ' +
          'nothing.',
      },
    },
  )

  .post(
    '/workspaces/:workspaceId/project-templates',
    async ({ body, standing, set }) => {
      set.status = 201;
      return saveProjectTemplate(standing.workspaceId, body);
    },
    {
      workspaceManager: true,
      params: workspaceParams,
      body: saveProjectTemplateBody,
      response: { 201: ProjectTemplateResponse, ...errors(400, 401, 404) },
      detail: {
        summary: 'Save a project as a template',
        description:
          'Save a snapshot of the configuration of a project of the workspace, without its ' +
          'issues, as a project template. Later changes to the project do not change the ' +
          'template. `include` chooses the sections as for a copy; docs, webhooks, agents ' +
          'and schedules are never saved. `teamIds` limits the template to those teams.',
      },
    },
  )

  .get(
    '/workspaces/:workspaceId/project-templates/:templateId/export',
    ({ standing, params }) => exportProjectTemplate(standing.workspaceId, params.templateId),
    {
      workspaceManager: true,
      params: workspaceTemplateParams,
      response: { 200: SharedProjectTemplate, ...errors(400, 401, 404) },
      detail: {
        summary: 'Export a project template',
        description:
          'The template as a document another workspace imports, on this instance or ' +
          'another one. The people it names, the settings other than auto-archive and ' +
          'the subtask automations, and the sections an extension adds are left out.',
      },
    },
  )

  .get(
    '/workspaces/:workspaceId/template-publisher',
    async ({ standing }) => ({ publisher: await getTemplatePublisher(standing.workspaceId) }),
    {
      workspaceManager: true,
      params: workspaceParams,
      response: {
        200: t.Object({ publisher: t.Nullable(TemplatePublisherResponse) }),
        ...errors(400, 401, 404),
      },
      detail: {
        summary: 'Get the gallery publisher of a workspace',
        description:
          'The address the workspace publishes its project templates to the gallery at ' +
          'itsaplan.dev under, and the author the gallery shows for it. `publisher` is null ' +
          'while the workspace is not linked.',
      },
    },
  )

  .post(
    '/workspaces/:workspaceId/template-publisher/code',
    async ({ body }) => {
      await requestPublisherCode(body.email);
      return noContent();
    },
    {
      workspaceManager: true,
      params: workspaceParams,
      body: publisherCodeBody,
      response: { 204: t.Void(), ...errors(400, 401, 403, 404, 429, 502) },
      detail: {
        summary: 'Email a gallery code',
        description:
          'The gallery at itsaplan.dev emails a code to the address. Linking the workspace ' +
          'with it confirms that the address is the caller’s.',
      },
    },
  )

  .post(
    '/workspaces/:workspaceId/template-publisher',
    ({ standing, body }) => linkTemplatePublisher(standing.workspaceId, body),
    {
      workspaceManager: true,
      params: workspaceParams,
      body: linkPublisherBody,
      response: { 200: TemplatePublisherResponse, ...errors(400, 401, 403, 404, 429, 502) },
      detail: {
        summary: 'Link a workspace to the gallery',
        description:
          'Confirms the address with the code the gallery emailed and links the workspace to ' +
          'it. Every manager of the workspace then publishes under that address.',
      },
    },
  )

  .put(
    '/workspaces/:workspaceId/template-publisher/author',
    ({ standing, body }) => setTemplatePublisherAuthor(standing.workspaceId, body),
    {
      workspaceManager: true,
      params: workspaceParams,
      body: publisherAuthorBody,
      response: { 200: TemplatePublisherResponse, ...errors(400, 401, 403, 404, 409, 429, 502) },
      detail: {
        summary: 'Set the gallery author of a workspace',
        description:
          'The name and the profile link the gallery shows on every template published ' +
          'from the linked address, including those already published.',
      },
    },
  )

  .delete(
    '/workspaces/:workspaceId/template-publisher',
    async ({ standing }) => {
      await unlinkTemplatePublisher(standing.workspaceId);
      return noContent();
    },
    {
      workspaceManager: true,
      params: workspaceParams,
      response: { 204: t.Void(), ...errors(400, 401, 404) },
      detail: {
        summary: 'Unlink a workspace from the gallery',
        description:
          'The published templates stay in the gallery. Linking the same address again ' +
          'manages them.',
      },
    },
  )

  .post(
    '/workspaces/:workspaceId/project-templates/:templateId/publication',
    ({ standing, params }) => publishTemplate(standing.workspaceId, params.templateId),
    {
      workspaceManager: true,
      params: workspaceTemplateParams,
      response: {
        200: TemplatePublicationResponse,
        ...errors(400, 401, 403, 404, 409, 413, 429, 502),
      },
      detail: {
        summary: 'Publish a project template',
        description:
          'Publishes what an export of the template holds to the gallery at itsaplan.dev, ' +
          'or updates the page it already has. Anyone can read and download it there. The ' +
          'workspace must be linked to the gallery, with an author named.',
      },
    },
  )

  .delete(
    '/workspaces/:workspaceId/project-templates/:templateId/publication',
    async ({ standing, params }) => {
      await unpublishTemplate(standing.workspaceId, params.templateId);
      return noContent();
    },
    {
      workspaceManager: true,
      params: workspaceTemplateParams,
      response: { 204: t.Void(), ...errors(400, 401, 403, 404, 409, 429, 502) },
      detail: { summary: 'Unpublish a project template' },
    },
  )

  .post(
    '/workspaces/:workspaceId/project-templates/import/preview',
    ({ body }) => previewImportedTemplate(body.template),
    {
      workspaceManager: true,
      params: workspaceParams,
      body: previewImportedTemplateBody,
      response: { 200: ProjectTemplateContentsResponse, ...errors(400, 401, 404) },
      detail: {
        summary: 'Preview an exported project template',
        description:
          'Checks an exported template and answers with what it would hold once imported. ' +
          'Saves nothing.',
      },
    },
  )

  .post(
    '/workspaces/:workspaceId/project-templates/import',
    async ({ body, standing, set }) => {
      set.status = 201;
      return importProjectTemplate(standing.workspaceId, body);
    },
    {
      workspaceManager: true,
      params: workspaceParams,
      body: importProjectTemplateBody,
      response: { 201: ProjectTemplateResponse, ...errors(400, 401, 404) },
      detail: {
        summary: 'Import a project template',
        description:
          'Save an exported template as a template of the workspace, under its own name ' +
          'and description. `teamIds` limits it to those teams. The people it names are ' +
          'dropped.',
      },
    },
  )

  .patch(
    '/workspaces/:workspaceId/project-templates/:templateId',
    ({ body, standing, params }) =>
      updateProjectTemplate(standing.workspaceId, params.templateId, body),
    {
      workspaceManager: true,
      params: workspaceTemplateParams,
      body: updateProjectTemplateBody,
      response: { 200: ProjectTemplateResponse, ...errors(400, 401, 404) },
      detail: {
        summary: 'Update a project template',
        description:
          'Rename a project template, change its description or the teams it is open to. ' +
          'What it holds stays as saved. `teamIds` null opens it to every team of the ' +
          'workspace.',
      },
    },
  )

  .delete(
    '/workspaces/:workspaceId/project-templates/:templateId',
    async ({ standing, params }) => {
      await unpublishTemplate(standing.workspaceId, params.templateId);
      await deleteProjectTemplate(standing.workspaceId, params.templateId);
      return noContent();
    },
    {
      workspaceManager: true,
      params: workspaceTemplateParams,
      response: { 204: t.Void(), ...errors(400, 401, 403, 404, 409, 429, 502) },
      detail: {
        summary: 'Delete a project template',
        description:
          'Delete a project template, after taking its page in the gallery down. Projects ' +
          'created from it are not changed.',
      },
    },
  )

  .get(
    '/teams/:teamId/project-templates',
    ({ membership }) => listTeamTemplates(membership.teamId),
    {
      teamManager: true,
      params: teamParams,
      response: { 200: ProjectTemplateListResponse, ...errors(401, 403, 404) },
      detail: {
        summary: 'List the project templates of a team',
        description:
          "The project templates of the team's workspace open to the team, by name. Pass " +
          'its id as templateId to create_project to create a project from it.',
        ...mcpTool('list_project_templates'),
      },
    },
  )

  .get(
    '/teams/:teamId/project-templates/:templateId',
    ({ membership, params }) => getTeamTemplate(membership.teamId, params.templateId),
    {
      teamManager: true,
      params: teamTemplateParams,
      response: { 200: ProjectTemplateDetailResponse, ...errors(400, 401, 403, 404) },
      detail: {
        summary: 'Get a project template',
        description:
          'What a project template open to the team holds: its states, issue types, labels, ' +
          'custom fields, issue templates, views, dashboards, actions, settings, the ' +
          'sections it turns on and its estimates.',
        ...mcpTool('get_project_template'),
      },
    },
  );
