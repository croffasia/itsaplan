import { db, noteBoardImage } from '@repo/db';
import { and, eq } from 'drizzle-orm';
import { iso, num } from '../shared/lib';

export interface NoteBoardImageRow {
  id: string;
  boardId: number;
  uploadedByUserId: string | null;
  s3Key: string;
  filename: string;
  contentType: string;
  sizeBytes: number;
  createdAt: string;
}

function mapNoteBoardImage(row: typeof noteBoardImage.$inferSelect): NoteBoardImageRow {
  return {
    id: row.publicId,
    boardId: row.boardId,
    uploadedByUserId: row.uploadedByUserId,
    s3Key: row.s3Key,
    filename: row.filename,
    contentType: row.contentType,
    sizeBytes: num(row.sizeBytes),
    createdAt: iso(row.createdAt),
  };
}

export async function createNoteBoardImage(input: {
  boardId: number;
  uploadedByUserId: string;
  s3Key: string;
  filename: string;
  contentType: string;
  sizeBytes: number;
}): Promise<NoteBoardImageRow> {
  const [row] = await db.insert(noteBoardImage).values(input).returning();
  return mapNoteBoardImage(row);
}

export async function getNoteBoardImage(
  boardId: number,
  publicId: string,
): Promise<NoteBoardImageRow | null> {
  const [row] = await db
    .select()
    .from(noteBoardImage)
    .where(and(eq(noteBoardImage.boardId, boardId), eq(noteBoardImage.publicId, publicId)));
  return row ? mapNoteBoardImage(row) : null;
}

export async function deleteNoteBoardImage(
  boardId: number,
  publicId: string,
): Promise<NoteBoardImageRow | null> {
  const [row] = await db
    .delete(noteBoardImage)
    .where(and(eq(noteBoardImage.boardId, boardId), eq(noteBoardImage.publicId, publicId)))
    .returning();
  return row ? mapNoteBoardImage(row) : null;
}

export async function listNoteBoardImageKeys(boardId: number): Promise<string[]> {
  const rows = await db
    .select({ s3Key: noteBoardImage.s3Key })
    .from(noteBoardImage)
    .where(eq(noteBoardImage.boardId, boardId));
  return rows.map((row) => row.s3Key);
}
