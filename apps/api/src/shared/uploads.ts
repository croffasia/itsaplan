import { randomUUID } from 'node:crypto';
import { db, issue, issueAttachment, noteBoard, noteBoardImage, projectFile } from '@repo/db';
import { eq, sql } from 'drizzle-orm';
import { deleteObject, putObject } from './s3';
import { HttpError, num } from './lib';
import { getStorageSettings, mimeAllowed, MB } from '../settings/storage';

async function projectStorageBytes(projectId: number): Promise<number> {
  const [attachmentRows, fileRows, noteImageRows] = await Promise.all([
    db
      .select({ total: sql<string>`coalesce(sum(${issueAttachment.sizeBytes}), 0)` })
      .from(issueAttachment)
      .innerJoin(issue, eq(issue.id, issueAttachment.issueId))
      .where(eq(issue.projectId, projectId)),
    db
      .select({ total: sql<string>`coalesce(sum(${projectFile.sizeBytes}), 0)` })
      .from(projectFile)
      .where(eq(projectFile.projectId, projectId)),
    db
      .select({ total: sql<string>`coalesce(sum(${noteBoardImage.sizeBytes}), 0)` })
      .from(noteBoardImage)
      .innerJoin(noteBoard, eq(noteBoard.id, noteBoardImage.boardId))
      .where(eq(noteBoard.projectId, projectId)),
  ]);
  return (
    num(attachmentRows[0]?.total ?? 0) +
    num(fileRows[0]?.total ?? 0) +
    num(noteImageRows[0]?.total ?? 0)
  );
}

export async function assertUploadAllowed(
  projectId: number,
  size: number,
  contentType: string,
  replacedBytes = 0,
): Promise<void> {
  const limits = await getStorageSettings();
  if (size > limits.maxAttachmentMb * MB) {
    throw new HttpError(413, `File exceeds the ${limits.maxAttachmentMb} MB limit`);
  }
  if (!mimeAllowed(contentType, limits.attachmentMimeTypes)) {
    throw new HttpError(400, `Files of type "${contentType}" are not accepted on this instance`);
  }
  if (limits.projectQuotaMb > 0) {
    const used = (await projectStorageBytes(projectId)) - replacedBytes;
    if (used + size > limits.projectQuotaMb * MB) {
      throw new HttpError(
        413,
        `The project has used its ${limits.projectQuotaMb} MB storage quota. Delete files or attachments to free space.`,
      );
    }
  }
}

export function uploadObjectKey(projectId: number, folder: string, filename: string): string {
  const safeName = filename.replace(/[^\w.-]+/g, '_').slice(-100) || 'file';
  return `projects/${projectId}/${folder}/${randomUUID()}-${safeName}`;
}

export async function storeUploadedObject(
  key: string,
  bytes: Buffer,
  contentType: string,
): Promise<void> {
  try {
    await putObject(key, bytes, contentType);
  } catch (err) {
    console.error(
      `[planner] object store PUT failed (bucket=${process.env.S3_BUCKET}, key=${key}, size=${bytes.length}):`,
      err,
    );
    throw new HttpError(502, 'Could not store the file');
  }
}

export async function discardUploadedObject(key: string): Promise<void> {
  await deleteObject(key).catch((err) => {
    console.error(`[planner] failed to delete object ${key}:`, err);
  });
}
