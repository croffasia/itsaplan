import { createHash, randomUUID } from 'node:crypto';
import {
  chatAttachment,
  db,
  documentAsset,
  issue,
  issueAttachment,
  projectDocument,
} from '@repo/db';
import { eq, sql } from 'drizzle-orm';
import { putObject, getObject, deleteObject } from '#shared/s3';
import { HttpError, num } from '#shared/lib';
import { getStorageSettings, mimeAllowed, MB } from '#modules/settings/service';

export type AttachmentStorageExecutor =
  typeof db | Parameters<Parameters<typeof db.transaction>[0]>[0];

const ATTACHMENT_QUOTA_LOCK_NAMESPACE = 1_145_390_932;

async function projectStoredBytes(
  executor: AttachmentStorageExecutor,
  projectId: number,
): Promise<number> {
  // Keep these sequential: callers commonly pass a transaction-bound executor,
  // and all three reads must observe the same post-lock snapshot/connection.
  const issues = await executor
    .select({ total: sql<string>`coalesce(sum(${issueAttachment.sizeBytes}), 0)` })
    .from(issueAttachment)
    .innerJoin(issue, eq(issue.id, issueAttachment.issueId))
    .where(eq(issue.projectId, projectId));
  const chats = await executor
    .select({ total: sql<string>`coalesce(sum(${chatAttachment.sizeBytes}), 0)` })
    .from(chatAttachment)
    .where(eq(chatAttachment.projectId, projectId));
  const documents = await executor
    .select({ total: sql<string>`coalesce(sum(${documentAsset.sizeBytes}), 0)` })
    .from(documentAsset)
    .innerJoin(projectDocument, eq(projectDocument.id, documentAsset.documentId))
    .where(eq(projectDocument.projectId, projectId));
  return num(issues[0]?.total ?? 0) + num(chats[0]?.total ?? 0) + num(documents[0]?.total ?? 0);
}

export async function assertAttachmentStorageCapacity(
  projectId: number,
  addedBytes: number,
  replacedBytes = 0,
  executor: AttachmentStorageExecutor = db,
): Promise<void> {
  const limits = await getStorageSettings();
  if (limits.projectQuotaMb <= 0) return;
  const used = (await projectStoredBytes(executor, projectId)) - replacedBytes;
  if (used + addedBytes > limits.projectQuotaMb * MB) {
    throw new HttpError(
      413,
      `The project has used its ${limits.projectQuotaMb} MB storage quota. Delete attachments to free space.`,
    );
  }
}

export async function lockAttachmentStorage(
  executor: AttachmentStorageExecutor,
  projectId: number,
): Promise<void> {
  await executor.execute(
    sql`select pg_advisory_xact_lock(${ATTACHMENT_QUOTA_LOCK_NAMESPACE}, ${projectId})`,
  );
}

export async function assertAttachmentUploadAllowed(
  projectId: number,
  size: number,
  contentType: string,
  replacedBytes = 0,
): Promise<void> {
  await assertAttachmentFileAllowed(size, contentType);
  await assertAttachmentStorageCapacity(projectId, size, replacedBytes);
}

export async function assertAttachmentFileAllowed(
  size: number,
  contentType: string,
): Promise<void> {
  const limits = await getStorageSettings();
  if (size > limits.maxAttachmentMb * MB) {
    throw new HttpError(413, `File exceeds the ${limits.maxAttachmentMb} MB limit`);
  }
  if (!mimeAllowed(contentType, limits.attachmentMimeTypes)) {
    throw new HttpError(400, `Files of type "${contentType}" are not accepted on this instance`);
  }
}

export function safeAttachmentFilename(input: string, fallback = 'file'): string {
  const basename = input.split(/[\\/]/).pop() ?? '';
  const printable = [...basename]
    .map((character) => {
      const code = character.charCodeAt(0);
      return code < 32 || code === 127 ? '_' : character;
    })
    .join('')
    .trim();
  const filename = printable.slice(-255);
  return filename && filename !== '.' && filename !== '..' ? filename : fallback;
}

export function attachmentObjectKey(
  projectId: number,
  namespace: 'attachments' | 'chat' | 'documents',
  ownerId: number | null,
  filename: string,
): string {
  const safeName = safeAttachmentFilename(filename)
    .replace(/[^\w.-]+/g, '_')
    .slice(-100);
  const ownerPath = ownerId === null ? '' : `${ownerId}/`;
  return `projects/${projectId}/${namespace}/${ownerPath}${randomUUID()}-${safeName}`;
}

export async function storeAttachmentObject(
  key: string,
  bytes: Buffer,
  contentType: string,
): Promise<void> {
  try {
    await putObject(key, bytes, contentType);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(
      `[planner] object store PUT failed (bucket=${process.env.S3_BUCKET}, key=${key}, size=${bytes.length}):`,
      error,
    );
    throw new HttpError(502, `Object store error: ${message}`);
  }
}

export async function cloneAttachmentObject(
  sourceKey: string,
  targetKey: string,
  contentType: string,
): Promise<void> {
  const source = await getObject(sourceKey).catch((error) => {
    throw new HttpError(
      502,
      `Could not read the source asset: ${error instanceof Error ? error.message : String(error)}`,
    );
  });
  const bytes = Buffer.from(await new Response(source.body).arrayBuffer());
  await storeAttachmentObject(targetKey, bytes, contentType || source.contentType);
}

export async function deleteAttachmentObject(key: string): Promise<void> {
  await deleteObject(key).catch((error) => {
    console.error(
      `[planner] failed to delete object ${key}:`,
      error instanceof Error ? error.message : error,
    );
  });
}

export function attachmentEtag(s3Key: string): string {
  return `"${createHash('sha256').update(s3Key).digest('base64url').slice(0, 22)}"`;
}

export function attachmentResponseHeaders(input: {
  contentType: string;
  filename: string;
  contentLength?: number;
  etag: string;
  download: boolean;
}): Record<string, string> {
  const inlineSafe = /^(image\/(png|jpe?g|gif|webp|avif|bmp)|video\/|audio\/)/i.test(
    input.contentType,
  );
  const inline = inlineSafe && !input.download;
  const headers: Record<string, string> = {
    'Content-Type': input.contentType,
    'Content-Disposition': `${inline ? 'inline' : 'attachment'}; filename*=UTF-8''${encodeURIComponent(input.filename)}`,
    'X-Content-Type-Options': 'nosniff',
    'Cache-Control': 'private, no-cache',
    ETag: input.etag,
  };
  if (input.contentLength !== undefined) headers['Content-Length'] = String(input.contentLength);
  if (!inline) headers['Content-Security-Policy'] = "default-src 'none'; sandbox";
  return headers;
}
