import { db, chatAttachment } from '@repo/db';
import { eq, sql } from 'drizzle-orm';
import { HttpError, iso, num } from '#shared/lib';
import { getObject } from '#shared/s3';
import { isTableFilename, parseImportFile } from './parse';

// Data access for chat attachments. File bytes live in the S3-compatible object
// store (#shared/s3); these rows hold the metadata and the object key. publicId is
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
  const [row] = await db.insert(chatAttachment).values(input).returning();
  return mapRow(row);
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

export interface ChatAttachmentContent {
  table?: { headers: string[]; sampleRows: string[][]; totalRows: number };
  text?: string;
}

function isTextLike(row: ChatAttachmentRow): boolean {
  if (/^(text\/|application\/(json|xml))/.test(row.contentType)) return true;
  return /\.(txt|md|log|json|xml|ya?ml)$/i.test(row.filename);
}

// The content of a stored file in the shape the read route answers with: a table
// for a spreadsheet or document, the full text for a text file, nothing for a
// binary one (its download url is in the metadata either way). A text file is
// returned whole: what it costs in context is the user's call, and the chat
// shows the conversation's context size.
export async function readChatAttachmentContent(
  row: ChatAttachmentRow,
): Promise<ChatAttachmentContent> {
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
  if (isTextLike(row)) return { text: bytes.toString('utf8') };
  return {};
}
