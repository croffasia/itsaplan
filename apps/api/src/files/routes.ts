import { Elysia, t } from 'elysia';
import { authContext } from '../shared/auth-context';
import { requireUser } from '../shared/access';
import { entityGuard, guards } from '../shared/guards';
import { HttpError } from '../shared/lib';
import { noContent } from '../shared/http';
import { ErrorResponse } from '../shared/responses';
import { getObject } from '../shared/s3';
import { getCrmCustomerInProject, getCrmCustomerProjectId } from '../crm/store';
import {
  assertUploadAllowed,
  discardUploadedObject,
  storeUploadedObject,
  uploadObjectKey,
} from '../shared/uploads';
import {
  createProjectFile,
  deleteProjectFile,
  getProjectFileByPublicId,
  getProjectFileProjectId,
  listProjectFiles,
  type ProjectFileRow,
} from './store';

const ProjectFileResponse = t.Object({
  id: t.String(),
  filename: t.String(),
  contentType: t.String(),
  sizeBytes: t.Number(),
  uploadedByName: t.Nullable(t.String()),
  customerId: t.Nullable(t.String()),
  createdAt: t.String(),
});

function projectFileDto(row: ProjectFileRow) {
  return {
    id: row.publicId,
    filename: row.filename,
    contentType: row.contentType,
    sizeBytes: row.sizeBytes,
    uploadedByName: row.uploadedByName,
    customerId: row.customerId,
    createdAt: row.createdAt,
  };
}

async function storeProjectFile(
  projectId: number,
  userId: string,
  file: File,
  crmCustomerId?: number,
): Promise<ProjectFileRow> {
  if (file.size === 0) throw new HttpError(400, 'Uploaded file is empty');

  const filename = file.name || 'file';
  const contentType = file.type || 'application/octet-stream';
  await assertUploadAllowed(projectId, file.size, contentType);

  const key = uploadObjectKey(projectId, 'files', filename);
  await storeUploadedObject(key, Buffer.from(await file.arrayBuffer()), contentType);
  try {
    return await createProjectFile({
      projectId,
      crmCustomerId,
      uploadedByUserId: userId,
      s3Key: key,
      filename,
      contentType,
      sizeBytes: file.size,
    });
  } catch (error) {
    await discardUploadedObject(key);
    throw error;
  }
}

export const fileRoutes = new Elysia({ name: 'files', detail: { tags: ['Files'] } })
  .use(authContext)
  .use(guards)
  .macro({
    projectFile: entityGuard('files', 'File not found', (params) =>
      getProjectFileProjectId(params.publicId),
    ),
    crmCustomer: entityGuard('crm', 'Customer not found', (params) =>
      getCrmCustomerProjectId(params.customerId),
    ),
  })
  .get(
    '/projects/:projectKey/files',
    async ({ project }) => (await listProjectFiles(project.id)).map(projectFileDto),
    {
      permission: ['files', 'read'],
      response: {
        200: t.Array(ProjectFileResponse),
        401: ErrorResponse,
        403: ErrorResponse,
        404: ErrorResponse,
      },
      detail: { summary: "List a project's files" },
    },
  )
  .post(
    '/projects/:projectKey/files',
    async ({ project, user, body, set }) => {
      const file = body.file;
      if (!(file instanceof File)) throw new HttpError(400, 'No file uploaded (form field "file")');
      const row = await storeProjectFile(project.id, requireUser(user).id, file);
      set.status = 201;
      return projectFileDto(row);
    },
    {
      permission: ['files', 'create'],
      body: t.Object({ file: t.File() }),
      response: {
        201: ProjectFileResponse,
        400: ErrorResponse,
        401: ErrorResponse,
        403: ErrorResponse,
        404: ErrorResponse,
        413: ErrorResponse,
        502: ErrorResponse,
      },
      detail: { summary: 'Upload a project file' },
    },
  )
  .post(
    '/projects/:projectKey/crm/customers/:customerId/files',
    async ({ project, user, params, body, set }) => {
      const file = body.file;
      if (!(file instanceof File)) throw new HttpError(400, 'No file uploaded (form field "file")');
      const customer = await getCrmCustomerInProject(params.customerId, project.id);
      if (!customer) throw new HttpError(404, 'Customer not found');

      const row = await storeProjectFile(project.id, requireUser(user).id, file, customer.id);
      set.status = 201;
      return projectFileDto(row);
    },
    {
      permission: ['files', 'create'],
      crmCustomer: 'edit',
      params: t.Object({ projectKey: t.String(), customerId: t.String({ format: 'uuid' }) }),
      body: t.Object({ file: t.File() }),
      response: {
        201: ProjectFileResponse,
        400: ErrorResponse,
        401: ErrorResponse,
        403: ErrorResponse,
        404: ErrorResponse,
        413: ErrorResponse,
        502: ErrorResponse,
      },
      detail: { summary: 'Upload a file linked to a CRM customer' },
    },
  )
  .get(
    '/files/:publicId/raw',
    async ({ params }) => {
      const row = await getProjectFileByPublicId(params.publicId);
      if (!row) throw new HttpError(404, 'File not found');

      let object;
      try {
        object = await getObject(row.s3Key);
      } catch {
        throw new HttpError(404, 'File content not found');
      }

      const headers: Record<string, string> = {
        'Content-Type': row.contentType,
        'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(row.filename)}`,
        'Content-Security-Policy': "default-src 'none'; sandbox",
        'X-Content-Type-Options': 'nosniff',
        'Cache-Control': 'private, no-store',
      };
      if (object.contentLength != null) headers['Content-Length'] = String(object.contentLength);
      return new Response(object.body, { headers });
    },
    {
      projectFile: 'read',
      response: {
        401: ErrorResponse,
        403: ErrorResponse,
        404: ErrorResponse,
      },
      detail: { summary: 'Download a project file' },
    },
  )
  .delete(
    '/files/:publicId',
    async ({ params }) => {
      const row = await deleteProjectFile(params.publicId);
      if (!row) throw new HttpError(404, 'File not found');
      await discardUploadedObject(row.s3Key);
      return noContent();
    },
    {
      projectFile: 'delete',
      response: {
        204: t.Void(),
        401: ErrorResponse,
        403: ErrorResponse,
        404: ErrorResponse,
      },
      detail: { summary: 'Delete a project file' },
    },
  );
