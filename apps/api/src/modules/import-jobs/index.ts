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
  createImportJobBody,
  importJobParams,
  testConnectionBody,
  planePreviewBody,
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

// Import jobs bring issues from an external tracker into a project. Creating one
// stores an encrypted credential and leaves it 'pending' for the worker
// (apps/worker/src/import-worker.ts) to drive through its phases; this module never
// touches the worker's queue directly, only the import_job/import_record rows it reads
// and writes too.

export const importJobRoutes = new Elysia({
  name: 'import-jobs',
  detail: { tags: ['Import Jobs'] },
})
  .use(authContext)
  .use(guards)
  .macro({
    importJobEntity: entityGuard('import_jobs', 'Import job not found', (p) =>
      getImportJobProjectId(Number(p.id)),
    ),
  })

  .post(
    '/projects/:projectKey/import-jobs/test-connection',
    ({ body }) => testPlaneConnection(body.baseUrl, body.workspaceSlug, body.apiToken),
    {
      permission: ['import_jobs', 'create'],
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
      permission: ['import_jobs', 'create'],
      body: planePreviewBody,
      response: { 200: PlanePreviewResponse, ...commonErrors, ...errors(502) },
      detail: {
        summary: 'Preview a Plane project before importing it',
        description:
          "Fetch the source project's states, each with the category itsaplan would " +
          'automatically map it to, for review before a job is created.',
      },
    },
  )

  .post(
    '/projects/:projectKey/import-jobs',
    ({ project, body, user, set }) => {
      set.status = 201;
      return createImportJob(project.id, requireUser(user).id, body);
    },
    {
      permission: ['import_jobs', 'create'],
      body: createImportJobBody,
      response: { 201: ImportJobResponse, ...commonErrors },
      detail: {
        summary: 'Create a Plane import job',
        description:
          "Encrypt and store the submitted credential and leave the job 'pending' for the worker.",
      },
    },
  )

  .get('/projects/:projectKey/import-jobs', ({ project }) => listImportJobs(project.id), {
    permission: ['import_jobs', 'read'],
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
      await assertPermission(job.projectId, user, 'import_jobs', 'read');
      await assertMcpAllowed(job.projectId, request.headers);
      return job;
    },
    {
      params: importJobParams,
      response: { 200: ImportJobResponse, ...commonErrors },
      detail: {
        summary: 'Get an import job',
        description: 'Get the status and per-entity progress counts of an import job.',
        ...requiresPermission(['import_jobs', 'read']),
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
