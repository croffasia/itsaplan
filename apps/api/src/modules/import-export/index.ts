import { Elysia, t } from 'elysia';
import { authContext } from '#shared/auth-context';
import { guards, entityGuard, assertMcpAllowed, requiresPermission } from '#shared/guards';
import { assertPermission, requireUser } from '#shared/access';
import { HttpError } from '#shared/lib';
import { accessErrors, commonErrors, errors } from '#shared/responses';
import {
  ImportJobResponse,
  TestConnectionResponse,
  PlanePreviewResponse,
  LinearTestConnectionResponse,
  LinearPreviewResponse,
  JiraTestConnectionResponse,
  TrelloTestConnectionResponse,
  SourcePreviewResponse,
  ProjectExportResponse,
  createImportJobBody,
  importJobParams,
  testConnectionBody,
  planePreviewBody,
  linearConnectionBody,
  linearPreviewBody,
  jiraConnectionBody,
  jiraPreviewBody,
  trelloConnectionBody,
  trelloPreviewBody,
} from './model';
import {
  cancelImportJob,
  createImportJob,
  getImportJobDto,
  getImportJobProjectId,
  listImportJobs,
  pauseImportJob,
  resumeImportJob,
  testPlaneConnection,
  testPlaneStatesPreview,
} from './service';
import { exportProject } from './export';
import { previewLinearStates, testLinearConnection } from './linear';
import { previewJiraStates, testJiraConnection } from './jira';
import { previewTrelloStates, testTrelloConnection } from './trello';

// Import jobs bring issues from an external tracker into a project. Creating one
// stores an encrypted credential and leaves it 'pending' for the worker
// (apps/worker/src/import-worker.ts) to drive through its phases; this module never
// touches the worker's queue directly, only the import_job/import_record rows it reads
// and writes too.

export const importExportRoutes = new Elysia({
  name: 'import-export',
  detail: { tags: ['Import/Export'] },
})
  .use(authContext)
  .use(guards)
  .macro({
    importJobEntity: entityGuard('import_export', 'Import job not found', (p) =>
      getImportJobProjectId(Number(p.id)),
    ),
  })

  .post(
    '/projects/:projectKey/import-jobs/test-connection',
    ({ body }) => testPlaneConnection(body.baseUrl, body.workspaceSlug, body.apiToken),
    {
      permission: ['import_export', 'create'],
      body: testConnectionBody,
      response: { 200: TestConnectionResponse, ...commonErrors, ...errors(502) },
      detail: {
        summary: 'Test a Plane connection',
        description:
          'Validate a base URL, workspace slug, and API token against the source live, without ' +
          'storing anything. Returns the projects of the workspace to pick a source project from.',
      },
    },
  )

  .post(
    '/projects/:projectKey/import-jobs/plane-preview',
    ({ body }) =>
      testPlaneStatesPreview(body.baseUrl, body.workspaceSlug, body.apiToken, body.planeProjectId),
    {
      permission: ['import_export', 'create'],
      body: planePreviewBody,
      response: { 200: PlanePreviewResponse, ...commonErrors, ...errors(502) },
      detail: {
        summary: 'Preview a Plane project before importing it',
        description:
          "Fetch the source project's states, each with the category One Health would " +
          'automatically map it to, for review before a job is created.',
      },
    },
  )

  .post(
    '/projects/:projectKey/import-jobs/linear-test-connection',
    ({ body }) => testLinearConnection(body.apiToken),
    {
      permission: ['import_export', 'create'],
      body: linearConnectionBody,
      response: { 200: LinearTestConnectionResponse, ...commonErrors, ...errors(502) },
      detail: {
        summary: 'Test a Linear API key',
        description:
          'Validate a Linear personal API key live, without storing anything. Returns the ' +
          'teams it can see, each with its projects, to pick what to import from.',
      },
    },
  )

  .post(
    '/projects/:projectKey/import-jobs/linear-preview',
    ({ body }) => previewLinearStates(body.apiToken, body.teamId),
    {
      permission: ['import_export', 'create'],
      body: linearPreviewBody,
      response: { 200: LinearPreviewResponse, ...commonErrors, ...errors(502) },
      detail: {
        summary: 'Preview a Linear team before importing from it',
        description:
          "Fetch the team's workflow states, each with the category One Health would " +
          'automatically map it to, for review before a job is created.',
      },
    },
  )

  .post(
    '/projects/:projectKey/import-jobs/jira-test-connection',
    ({ body }) => testJiraConnection(body),
    {
      permission: ['import_export', 'create'],
      body: jiraConnectionBody,
      response: { 200: JiraTestConnectionResponse, ...commonErrors, ...errors(502) },
      detail: {
        summary: 'Test a Jira Cloud connection',
        description:
          'Validate a Jira Cloud site, account email, and API token live, without storing ' +
          'anything. Returns the projects the account can browse.',
      },
    },
  )

  .post('/projects/:projectKey/import-jobs/jira-preview', ({ body }) => previewJiraStates(body), {
    permission: ['import_export', 'create'],
    body: jiraPreviewBody,
    response: { 200: SourcePreviewResponse, ...commonErrors, ...errors(502) },
    detail: {
      summary: 'Preview a Jira project before importing it',
      description:
        "Fetch the project's statuses, each with the category One Health would " +
        'automatically map it to, for review before a job is created.',
    },
  })

  .post(
    '/projects/:projectKey/import-jobs/trello-test-connection',
    ({ body }) => testTrelloConnection(body),
    {
      permission: ['import_export', 'create'],
      body: trelloConnectionBody,
      response: { 200: TrelloTestConnectionResponse, ...commonErrors, ...errors(502) },
      detail: {
        summary: 'Test a Trello API key and token',
        description:
          'Validate a Trello API key and token live, without storing anything. Returns the ' +
          'boards the token can see.',
      },
    },
  )

  .post(
    '/projects/:projectKey/import-jobs/trello-preview',
    ({ body }) => previewTrelloStates(body),
    {
      permission: ['import_export', 'create'],
      body: trelloPreviewBody,
      response: { 200: SourcePreviewResponse, ...commonErrors, ...errors(502) },
      detail: {
        summary: 'Preview a Trello board before importing it',
        description:
          "Fetch the board's lists, each with the category One Health would automatically " +
          'map it to, for review before a job is created.',
      },
    },
  )

  .get('/projects/:projectKey/import-jobs/export', ({ project }) => exportProject(project.id), {
    permission: ['import_export', 'create'],
    response: { 200: ProjectExportResponse, ...accessErrors },
    detail: {
      summary: "Export a project's data",
      description:
        "A self-contained snapshot of the project's states, labels, cycles, and issues " +
        '(with their comments and relations), as portable JSON. Not a live sync to any ' +
        'target — a download.',
    },
  })

  .post(
    '/projects/:projectKey/import-jobs',
    ({ project, body, user, set }) => {
      set.status = 201;
      return createImportJob(project.id, requireUser(user).id, body);
    },
    {
      permission: ['import_export', 'create'],
      body: createImportJobBody,
      response: { 201: ImportJobResponse, ...commonErrors },
      detail: {
        summary: 'Create an import job',
        description:
          "Create a Plane job, or a Linear, Jira or Trello one with source 'linear', 'jira' or 'trello'. Encrypt and store the " +
          "submitted credential and leave the job 'pending' for the worker.",
      },
    },
  )

  .get('/projects/:projectKey/import-jobs', ({ project }) => listImportJobs(project.id), {
    permission: ['import_export', 'read'],
    response: { 200: t.Array(ImportJobResponse), ...accessErrors },
    detail: { summary: "List a project's import jobs" },
  })

  // Fetches the row itself and asserts on it, like GET /issues/:issueId — the entity
  // guard would resolve the project id with a second query this handler doesn't need.
  .get(
    '/import-jobs/:id',
    async ({ params, user, request }) => {
      const job = await getImportJobDto(params.id);
      if (!job) throw new HttpError(404, 'Import job not found');
      await assertPermission(job.projectId, user, 'import_export', 'read');
      await assertMcpAllowed(job.projectId, request.headers);
      return job;
    },
    {
      params: importJobParams,
      response: { 200: ImportJobResponse, ...commonErrors },
      detail: {
        summary: 'Get an import job',
        description: 'Get the status and per-entity progress counts of an import job.',
        ...requiresPermission(['import_export', 'read']),
      },
    },
  )

  .post('/import-jobs/:id/pause', ({ params }) => pauseImportJob(params.id), {
    params: importJobParams,
    importJobEntity: 'edit',
    response: { 200: ImportJobResponse, ...accessErrors, ...errors(409) },
    detail: { summary: 'Pause an import job' },
  })

  .post('/import-jobs/:id/resume', ({ params }) => resumeImportJob(params.id), {
    params: importJobParams,
    importJobEntity: 'edit',
    response: { 200: ImportJobResponse, ...accessErrors, ...errors(409) },
    detail: { summary: 'Resume a paused import job' },
  })

  .post('/import-jobs/:id/cancel', ({ params }) => cancelImportJob(params.id), {
    params: importJobParams,
    importJobEntity: 'edit',
    response: { 200: ImportJobResponse, ...accessErrors, ...errors(409) },
    detail: { summary: 'Cancel an import job' },
  });
