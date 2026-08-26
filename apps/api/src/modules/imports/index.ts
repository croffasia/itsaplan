import { Elysia, t } from 'elysia';
import { randomUUID } from 'node:crypto';
import { noContent } from '#shared/http';
import { authContext } from '#shared/auth-context';
import { guards, entityGuard } from '#shared/guards';
import { HttpError } from '#shared/lib';
import { putObject } from '#shared/s3';
import { accessErrors, commonErrors, errors } from '#shared/responses';
import { requireUser } from '#shared/access';
import { getStorageSettings, MB, type StorageSettings } from '#modules/settings/service';
import { getProjectAttachmentBytes } from '#modules/attachments/service';
import { getProjectById } from '#modules/projects/service';
import {
  ConfirmResponse,
  ImportResponse,
  projectKeyParams,
  importIdParams,
  uploadImportBody,
} from './model';
import { assertImportFilename } from './parse';
import {
  cancelImport,
  confirmImport,
  createImport,
  getImport,
  getImportProjectId,
  readImportTable,
} from './service';

// Imports: a file uploaded so an agent can turn its rows into issues. The upload
// stores bytes and a pending row; the agent maps columns; creation happens only on
// the confirm route, called by the UI after the user approves the preview.

async function assertUploadAllowed(
  limits: StorageSettings,
  projectId: number,
  size: number,
): Promise<void> {
  if (size > limits.maxAttachmentMb * MB) {
    throw new HttpError(413, `File exceeds the ${limits.maxAttachmentMb} MB limit`);
  }
  if (limits.projectQuotaMb > 0) {
    const used = await getProjectAttachmentBytes(projectId);
    if (used + size > limits.projectQuotaMb * MB) {
      throw new HttpError(
        413,
        `The project has used its ${limits.projectQuotaMb} MB storage quota.`,
      );
    }
  }
}

function importKey(projectId: number, filename: string): string {
  const safeName = filename.replace(/[^\w.-]+/g, '_').slice(-100);
  return `projects/${projectId}/imports/${randomUUID()}-${safeName}`;
}

function importDto(row: Awaited<ReturnType<typeof getImport>>) {
  if (!row) throw new HttpError(404, 'Import not found');
  return row;
}

export const importRoutes = new Elysia({
  name: 'imports',
  detail: { tags: ['Imports'] },
})
  .use(authContext)
  .use(guards)
  .macro({
    importFile: entityGuard('work_items', 'Import not found', (p) =>
      getImportProjectId(p.importId),
    ),
  })

  // Multipart upload of one file. The extension decides the parser, so it is
  // checked here before anything is stored.
  .post(
    '/projects/:projectKey/imports',
    async ({ body, set, project, user }) => {
      const file = body.file;
      if (!(file instanceof File)) throw new HttpError(400, 'No file uploaded (form field "file")');
      if (file.size === 0) throw new HttpError(400, 'Uploaded file is empty');
      const filename = file.name || 'file';
      assertImportFilename(filename);
      await assertUploadAllowed(await getStorageSettings(), project.id, file.size);

      const contentType = file.type || 'application/octet-stream';
      const key = importKey(project.id, filename);
      try {
        await putObject(key, Buffer.from(await file.arrayBuffer()), contentType);
      } catch (err) {
        throw new HttpError(502, `Object store error: ${err instanceof Error ? err.message : err}`);
      }

      const row = await createImport({
        projectId: project.id,
        createdByUserId: requireUser(user).id,
        s3Key: key,
        filename,
        contentType,
        sizeBytes: file.size,
      });
      set.status = 201;
      return row;
    },
    {
      body: uploadImportBody,
      params: projectKeyParams,
      permission: ['work_items', 'create'],
      response: { 201: ImportResponse, ...commonErrors, ...errors(413, 502) },
      detail: { summary: 'Upload a file for issue import' },
    },
  )

  .get(
    '/imports/:importId',
    async ({ params }) => {
      const row = importDto(await getImport(params.importId));
      // The head of the parsed table rides along, so the review card draws real
      // rows. A file that stopped parsing (deleted object, bad content) leaves the
      // preview off rather than failing the read.
      const preview = await readImportTable(params.importId)
        .then((parsed) => ({
          headers: parsed.headers,
          rows: parsed.rows.slice(0, 5),
          totalRows: parsed.totalRows,
        }))
        .catch(() => undefined);
      return { ...row, ...(preview ? { preview } : {}) };
    },
    {
      params: importIdParams,
      importFile: 'read',
      response: { 200: ImportResponse, ...accessErrors },
      detail: { summary: 'View an import draft' },
    },
  )

  // Creates one issue per mappable row. The mapping was saved by the agent; this
  // route is what the preview's Confirm button calls — the model itself cannot
  // create anything through it.
  .post(
    '/imports/:importId/confirm',
    async ({ params, projectId, user }) => {
      // The entity guard resolved the owning project's id; the confirm flow needs
      // the full project for sequence keys and validation.
      const project = await getProjectById(projectId);
      if (!project) throw new HttpError(404, 'Import not found');
      return confirmImport(params.importId, project, requireUser(user).id);
    },
    {
      params: importIdParams,
      importFile: 'create',
      response: { 200: ConfirmResponse, ...commonErrors, ...errors(409, 502) },
      detail: { summary: 'Confirm an import and create its issues' },
    },
  )

  .post(
    '/imports/:importId/cancel',
    async ({ params }) => {
      await cancelImport(params.importId);
      return noContent();
    },
    {
      params: importIdParams,
      importFile: 'edit',
      response: { 204: t.Void(), ...accessErrors, ...errors(409) },
      detail: { summary: 'Cancel an import draft' },
    },
  );
