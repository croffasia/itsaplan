import { db, issueImport, label, projectColumn, projectMember, user } from '@repo/db';
import { and, asc, eq } from 'drizzle-orm';
import { HttpError, iso } from '#shared/lib';
import { deleteObject, getObject } from '#shared/s3';
import { createIssue } from '#modules/issues/service';
import type { ProjectRow } from '#modules/projects/service';
import { applyMapping, validateMapping, type ImportMapping } from './mapping';
import { parseImportFile, type ParsedSheet } from './parse';

// Data access for issue imports and the confirm flow. The file bytes live in the
// object store under projects/<id>/imports/; the row holds the metadata, the
// status, and the column mapping saved by the agent. Everything below addresses a
// draft by its public id and loads what it needs itself — callers pass ids, never
// storage keys.

export type IssueImportStatus = 'pending' | 'mapped' | 'confirmed' | 'canceled' | 'failed';

export interface IssueImportRow {
  id: string;
  projectId: number;
  createdByUserId: string | null;
  filename: string;
  contentType: string;
  sizeBytes: number;
  status: IssueImportStatus;
  mapping: ImportMapping | null;
  errorText: string | null;
  createdAt: string;
}

type SelectRow = typeof issueImport.$inferSelect;

function mapRow(row: SelectRow): IssueImportRow {
  return {
    id: row.publicId,
    projectId: row.projectId,
    createdByUserId: row.createdByUserId,
    filename: row.filename,
    contentType: row.contentType,
    sizeBytes: Number(row.sizeBytes),
    status: row.status as IssueImportStatus,
    mapping: (row.mapping as ImportMapping | null) ?? null,
    errorText: row.errorText,
    createdAt: iso(row.createdAt),
  };
}

export async function createImport(input: {
  projectId: number;
  createdByUserId: string | null;
  s3Key: string;
  filename: string;
  contentType: string;
  sizeBytes: number;
}): Promise<IssueImportRow> {
  const [row] = await db.insert(issueImport).values(input).returning();
  return mapRow(row);
}

export async function getImport(publicId: string): Promise<IssueImportRow | null> {
  const rows = await db.select().from(issueImport).where(eq(issueImport.publicId, publicId));
  return rows[0] ? mapRow(rows[0]) : null;
}

async function requireImport(publicId: string): Promise<SelectRow> {
  const rows = await db.select().from(issueImport).where(eq(issueImport.publicId, publicId));
  if (!rows[0]) throw new HttpError(404, 'Import not found');
  return rows[0];
}

// The draft must still be open to change. A confirmed one records what was
// created, a canceled one was refused by hand, and a failed one may already hold
// created issues from the run that failed — re-running it would duplicate them,
// so the file has to be uploaded again instead.
function assertOpen(status: IssueImportStatus): void {
  if (status === 'confirmed') throw new HttpError(409, 'This import was already confirmed');
  if (status === 'canceled') throw new HttpError(409, 'This import was canceled');
  if (status === 'failed')
    throw new HttpError(409, 'This import failed; upload the file again to start over');
}

export async function cancelImport(publicId: string): Promise<void> {
  const row = await requireImport(publicId);
  assertOpen(row.status as IssueImportStatus);
  await setStatus(publicId, 'canceled');
  removeStoredFile(row.s3Key);
}

// Saves the agent's column mapping after checking every named column exists.
export async function saveMapping(
  publicId: string,
  input: unknown,
): Promise<{ headers: string[]; totalRows: number }> {
  const row = await requireImport(publicId);
  assertOpen(row.status as IssueImportStatus);
  const mapping = validateMapping(input);
  const parsed = await readStoredFile(row);
  for (const field of Object.values(mapping)) {
    if (!parsed.headers.some((header) => header.toLowerCase() === field.toLowerCase())) {
      throw new HttpError(400, `Column "${field}" is not in the file`);
    }
  }
  await db
    .update(issueImport)
    .set({ mapping, status: 'mapped', errorText: null, updatedAt: new Date() })
    .where(eq(issueImport.publicId, publicId));
  return { headers: parsed.headers, totalRows: parsed.totalRows };
}

// The table of a stored import file, for the agent's read_import_file tool and for
// the preview the review route attaches.
export async function readImportTable(publicId: string): Promise<ParsedSheet> {
  const row = await requireImport(publicId);
  return readStoredFile(row);
}

export interface ConfirmResult {
  imported: { key: string; title: string }[];
  skipped: { row: number; reason: string }[];
}

// Re-reads the file, applies the saved mapping, and creates one issue per mappable
// row through the same service an interactive create uses — sequence numbers,
// WIP limits, and validation all behave exactly as in the UI. A row that fails on
// its own is reported and skipped; a failure of the whole run marks the import
// failed and rethrows.
export async function confirmImport(
  publicId: string,
  project: ProjectRow,
  actorUserId: string,
): Promise<ConfirmResult> {
  const row = await requireImport(publicId);
  if (row.status !== 'mapped' || !row.mapping) {
    throw new HttpError(409, 'This import has no mapping to confirm');
  }
  // Claim the draft atomically: a second concurrent confirm finds nothing to
  // update and stops here instead of running the creation loop twice.
  const claimed = await db
    .update(issueImport)
    .set({ status: 'confirmed', updatedAt: new Date() })
    .where(and(eq(issueImport.publicId, publicId), eq(issueImport.status, 'mapped')))
    .returning({ id: issueImport.id });
  if (!claimed[0]) throw new HttpError(409, 'This import was already confirmed');

  const [parsed, ctx] = await Promise.all([readStoredFile(row), mappingContext(project.id)]);
  const applied = applyMapping(parsed, row.mapping as ImportMapping, ctx);
  if (!ctx.defaultColumnId)
    throw new HttpError(400, 'The project has no workflow column to create issues in');

  const result: ConfirmResult = { imported: [], skipped: [] };
  try {
    for (const item of applied) {
      if (item.reason || !item.draft) {
        result.skipped.push({ row: item.rowNumber, reason: item.reason! });
        continue;
      }
      const created = await createIssue(
        project,
        { ...item.draft, columnId: ctx.defaultColumnId },
        actorUserId,
      );
      result.imported.push({
        key: `${project.key}-${created.sequenceNumber}`,
        title: created.title,
      });
    }
  } catch (err) {
    await setStatus(publicId, 'failed', err instanceof Error ? err.message : String(err));
    removeStoredFile(row.s3Key);
    throw err;
  }
  // The rows are materialized as issues; the source file has served its purpose.
  removeStoredFile(row.s3Key);
  return result;
}

export async function getImportProjectId(publicId: string): Promise<number | null> {
  const rows = await db
    .select({ projectId: issueImport.projectId })
    .from(issueImport)
    .where(eq(issueImport.publicId, publicId));
  return rows[0]?.projectId ?? null;
}

async function setStatus(
  publicId: string,
  status: IssueImportStatus,
  errorText?: string,
): Promise<void> {
  await db
    .update(issueImport)
    .set({ status, ...(errorText !== undefined ? { errorText } : {}), updatedAt: new Date() })
    .where(eq(issueImport.publicId, publicId));
}

async function readStoredFile(row: SelectRow): Promise<ParsedSheet> {
  const obj = await getObject(row.s3Key).catch(() => null);
  if (!obj) throw new HttpError(404, 'The uploaded file is gone from the object store');
  const bytes = Buffer.from(await new Response(obj.body).arrayBuffer());
  return parseImportFile(bytes, row.filename);
}

// Best-effort, like every object-store delete here: the row is already terminal,
// so a failed delete only orphans bytes.
function removeStoredFile(s3Key: string): void {
  void deleteObject(s3Key).catch((err) => {
    console.error(
      `[planner] failed to delete import object ${s3Key}:`,
      err instanceof Error ? err.message : err,
    );
  });
}

// The labels, members, and first workflow column a mapping resolves values against.
async function mappingContext(projectId: number) {
  const [labels, members, columns] = await Promise.all([
    db.select({ id: label.id, name: label.name }).from(label).where(eq(label.projectId, projectId)),
    db
      .select({ userId: projectMember.userId, name: user.name, email: user.email })
      .from(projectMember)
      .innerJoin(user, eq(user.id, projectMember.userId))
      .where(eq(projectMember.projectId, projectId)),
    db
      .select({ id: projectColumn.id })
      .from(projectColumn)
      .where(eq(projectColumn.projectId, projectId))
      .orderBy(asc(projectColumn.position)),
  ]);
  return {
    labels,
    members,
    defaultColumnId: columns[0]?.id ?? null,
  };
}
