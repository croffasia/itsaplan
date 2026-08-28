import {
  db,
  chatAttachment,
  issue,
  issueImport,
  label,
  projectColumn,
  projectMember,
  user,
} from '@repo/db';
import { and, asc, eq, inArray, sql } from 'drizzle-orm';
import { HttpError, iso, num } from '#shared/lib';
import { createIssue } from '#modules/issues/service';
import type { ProjectRow } from '#modules/projects/service';
import { readAttachmentBytes } from '#modules/chat-attachments/service';
import { parseImportFile, type ParsedSheet } from '#modules/chat-attachments/parse';
import {
  applyMapping,
  duplicateTitle,
  titleKey,
  titleKeys,
  validateMapping,
  type ImportMapping,
} from './mapping';

// Data access for issue imports and the confirm flow. An import is only the state
// of the draft — the status and the column mapping an agent saved; the file itself
// is the referenced chat attachment, so a file can exist without being an import.
// Everything below addresses a draft by its public id and loads what it needs
// itself — callers pass ids, never storage keys.

export type IssueImportStatus = 'mapped' | 'confirmed' | 'canceled' | 'failed';

export interface IssueImportRow {
  id: string;
  projectId: number;
  filename: string;
  contentType: string;
  sizeBytes: number;
  status: IssueImportStatus;
  mapping: ImportMapping | null;
  errorText: string | null;
  createdAt: string;
}

// drizzle keys a joined row by table name.
interface JoinedRow {
  issue_import: typeof issueImport.$inferSelect;
  chat_attachment: typeof chatAttachment.$inferSelect;
}

function mapRow({ issue_import: row, chat_attachment: file }: JoinedRow): IssueImportRow {
  return {
    id: row.publicId,
    projectId: row.projectId,
    filename: file.filename,
    contentType: file.contentType,
    sizeBytes: num(file.sizeBytes),
    status: row.status as IssueImportStatus,
    mapping: (row.mapping as ImportMapping | null) ?? null,
    errorText: row.errorText,
    createdAt: iso(row.createdAt),
  };
}

function selectJoined() {
  return db
    .select()
    .from(issueImport)
    .innerJoin(chatAttachment, eq(chatAttachment.id, issueImport.attachmentId));
}

export async function getImport(publicId: string): Promise<IssueImportRow | null> {
  const rows = await selectJoined().where(eq(issueImport.publicId, publicId));
  return rows[0] ? mapRow(rows[0]) : null;
}

async function requireImport(publicId: string): Promise<JoinedRow> {
  const rows = await selectJoined().where(eq(issueImport.publicId, publicId));
  if (!rows[0]) throw new HttpError(404, 'Import not found');
  return rows[0];
}

// Creates the draft the review card renders: the agent's column mapping against
// an uploaded chat attachment. Every named column must exist in the file. The
// draft is born 'mapped' — the review card only exists once a mapping does.
export async function createMappedImport(
  projectId: number,
  attachmentPublicId: string,
  input: unknown,
): Promise<IssueImportRow> {
  const attachments = await db
    .select()
    .from(chatAttachment)
    .where(eq(chatAttachment.publicId, attachmentPublicId));
  const attachment = attachments[0];
  if (!attachment || attachment.projectId !== projectId) {
    throw new HttpError(404, 'Attachment not found');
  }
  const mapping = validateMapping(input);
  const parsed = await readStoredFile(attachment.s3Key, attachment.filename);
  for (const field of Object.values(mapping)) {
    if (!parsed.headers.some((header) => header.toLowerCase() === field.toLowerCase())) {
      throw new HttpError(400, `Column "${field}" is not in the file`);
    }
  }
  const [row] = await db
    .insert(issueImport)
    .values({ projectId, attachmentId: attachment.id, mapping, status: 'mapped' })
    .returning();
  return mapRow({ issue_import: row, chat_attachment: attachment });
}

// The table of the draft's file, for the preview the review route attaches.
export async function readImportTable(publicId: string): Promise<ParsedSheet> {
  const row = await requireImport(publicId);
  return readStoredFile(row.chat_attachment.s3Key, row.chat_attachment.filename);
}

// Which of the file's titles the project already holds, archived issues included:
// their title is taken just as much. Only the file's own titles are asked for — a
// project's issue list has no bound, and `issue_project_title_idx` answers this
// shape of query without reading it.
export async function existingTitles(projectId: number, keys: string[]): Promise<Set<string>> {
  if (keys.length === 0) return new Set();
  const rows = await db
    .select({ title: issue.title })
    .from(issue)
    .where(and(eq(issue.projectId, projectId), inArray(sql`lower(btrim(${issue.title}))`, keys)));
  return new Set(rows.map((row) => titleKey(row.title)));
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
  if (row.issue_import.status !== 'mapped' || !row.issue_import.mapping) {
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

  const mapping = row.issue_import.mapping as ImportMapping;
  const [parsed, ctx] = await Promise.all([
    readStoredFile(row.chat_attachment.s3Key, row.chat_attachment.filename),
    mappingContext(project.id),
  ]);
  const applied = applyMapping(parsed, mapping, ctx);
  const taken = await existingTitles(project.id, titleKeys(parsed, mapping));
  if (!ctx.defaultColumnId)
    throw new HttpError(400, 'The project has no workflow column to create issues in');

  const result: ConfirmResult = { imported: [], skipped: [] };
  try {
    for (const item of applied) {
      if (item.reason || !item.draft) {
        result.skipped.push({ row: item.rowNumber, reason: item.reason! });
        continue;
      }
      // The same check the preview showed, with `taken` growing as rows are created.
      const duplicate = duplicateTitle(item.draft.title, taken);
      if (duplicate) {
        result.skipped.push({ row: item.rowNumber, reason: duplicate });
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
    throw err;
  }
  return result;
}

export async function cancelImport(publicId: string): Promise<void> {
  const row = await requireImport(publicId);
  if (row.issue_import.status !== 'mapped') {
    throw new HttpError(409, 'Only an import waiting for review can be canceled');
  }
  await setStatus(publicId, 'canceled');
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

async function readStoredFile(s3Key: string, filename: string): Promise<ParsedSheet> {
  return parseImportFile(await readAttachmentBytes(s3Key), filename);
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
