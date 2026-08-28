import { Elysia, t } from 'elysia';
import { noContent } from '#shared/http';
import { authContext } from '#shared/auth-context';
import { guards, entityGuard } from '#shared/guards';
import { HttpError } from '#shared/lib';
import { accessErrors, commonErrors, errors } from '#shared/responses';
import { requireUser } from '#shared/access';
import { getProjectById } from '#modules/projects/service';
import { previewTable, titleKeys, type ImportField } from './mapping';
import { ConfirmResponse, ImportResponse, importIdParams } from './model';
import {
  cancelImport,
  confirmImport,
  existingTitles,
  getImport,
  getImportProjectId,
  readImportTable,
} from './service';

// Imports: a chat attachment an agent mapped into issues. The file is uploaded and
// read through the chat-attachments routes; the draft appears when the agent saves
// a mapping (the prepare_issue_import tool); creation happens only on the confirm
// route, called by the UI after the user approves the preview.

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

  .get(
    '/imports/:importId',
    async ({ params }) => {
      const row = importDto(await getImport(params.importId));
      // A file that stopped parsing (deleted object, bad content) leaves the preview
      // off rather than failing the read.
      const parsed = await readImportTable(params.importId).catch(() => undefined);
      if (!parsed) return row;
      const mapping = (row.mapping ?? {}) as Partial<Record<ImportField, string>>;
      const taken = await existingTitles(row.projectId, titleKeys(parsed, mapping));
      const preview = { ...previewTable(parsed, mapping, taken), totalRows: parsed.totalRows };
      return { ...row, preview };
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
