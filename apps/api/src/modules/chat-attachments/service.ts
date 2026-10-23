import { db, chatAttachment } from '@repo/db';
import { eq, sql } from 'drizzle-orm';
import { HttpError, iso, num } from '#shared/lib';
import { getObject } from '@repo/storage';
import { isTableFilename, parseImportFile } from './parse';
import { pdfToMarkdown } from './pdf';
import {
  assertAttachmentStorageCapacity,
  lockAttachmentStorage,
} from '#modules/attachments/storage';

// Data access for chat attachments. File bytes live in the S3-compatible object
// store (@repo/storage); these rows hold the metadata and the object key. publicId is
// the unguessable id used in the public download URL and in the marker a chat
// message carries for an attached file.

export interface ChatAttachmentRow {
  id: number;
  publicId: string;
  projectId: number;
  uploadedByUserId: string | null;
  s3Key: string;
  filename: string;
  contentType: string;
  sizeBytes: number;
  createdAt: string;
}

function mapRow(row: typeof chatAttachment.$inferSelect): ChatAttachmentRow {
  return {
    id: row.id,
    publicId: row.publicId,
    projectId: row.projectId,
    uploadedByUserId: row.uploadedByUserId,
    s3Key: row.s3Key,
    filename: row.filename,
    contentType: row.contentType,
    sizeBytes: num(row.sizeBytes),
    createdAt: iso(row.createdAt),
  };
}

export async function createChatAttachment(input: {
  projectId: number;
  uploadedByUserId: string | null;
  s3Key: string;
  filename: string;
  contentType: string;
  sizeBytes: number;
}): Promise<ChatAttachmentRow> {
  return db.transaction(async (tx) => {
    await lockAttachmentStorage(tx, input.projectId);
    await assertAttachmentStorageCapacity(input.projectId, input.sizeBytes, 0, tx);
    const [row] = await tx.insert(chatAttachment).values(input).returning();
    return mapRow(row);
  });
}

export async function getChatAttachmentByPublicId(
  publicId: string,
): Promise<ChatAttachmentRow | null> {
  const rows = await db.select().from(chatAttachment).where(eq(chatAttachment.publicId, publicId));
  return rows[0] ? mapRow(rows[0]) : null;
}

export async function getChatAttachmentProjectId(publicId: string): Promise<number | null> {
  const rows = await db
    .select({ projectId: chatAttachment.projectId })
    .from(chatAttachment)
    .where(eq(chatAttachment.publicId, publicId));
  return rows[0]?.projectId ?? null;
}

// Bytes currently stored for a project as chat attachments. Read before an upload
// to enforce the instance project quota.
export async function getProjectChatAttachmentBytes(projectId: number): Promise<number> {
  const rows = await db
    .select({ total: sql<string>`coalesce(sum(${chatAttachment.sizeBytes}), 0)` })
    .from(chatAttachment)
    .where(eq(chatAttachment.projectId, projectId));
  return num(rows[0]?.total ?? 0);
}

export async function readAttachmentBytes(s3Key: string): Promise<Buffer> {
  const obj = await getObject(s3Key).catch(() => null);
  if (!obj) throw new HttpError(404, 'The uploaded file is gone from the object store');
  return Buffer.from(await new Response(obj.body).arrayBuffer());
}

export interface AttachmentContent {
  table?: { headers: string[]; sampleRows: string[][]; totalRows: number };
  text?: string;
}

type StoredFile = Pick<ChatAttachmentRow, 's3Key' | 'filename' | 'contentType'>;

function isTextLike(row: StoredFile): boolean {
  if (/^(text\/|application\/(json|xml))/.test(row.contentType)) return true;
  return /\.(txt|md|log|json|xml|ya?ml)$/i.test(row.filename);
}

function isPdf(row: StoredFile): boolean {
  return row.contentType === 'application/pdf' || /\.pdf$/i.test(row.filename);
}

function isReadableFile(row: StoredFile): boolean {
  return isTableFilename(row.filename) || isTextLike(row) || isPdf(row);
}

// The content of a stored file, chat or issue attachment alike: a table for a
// spreadsheet or document, the full text for a text file or a PDF, nothing for any
// other file (its download url is in the metadata either way). A text is returned
// whole: what it costs in context is the user's call, and the chat shows the
// conversation's context size.
export async function readAttachmentContent(row: StoredFile): Promise<AttachmentContent> {
  if (!isReadableFile(row)) return {};
  const bytes = await readAttachmentBytes(row.s3Key);
  if (isTableFilename(row.filename)) {
    const parsed = await parseImportFile(bytes, row.filename);
    return {
      table: {
        headers: parsed.headers,
        sampleRows: parsed.rows.slice(0, 10),
        totalRows: parsed.totalRows,
      },
    };
  }
  if (isPdf(row)) return { text: await pdfToMarkdown(bytes) };
  return { text: bytes.toString('utf8') };
}
