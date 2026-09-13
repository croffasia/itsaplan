import { createHash } from 'node:crypto';
import {
  db,
  type DbExecutor,
  getStorageSettings,
  mimeAllowed,
  MB,
  projectStoredBytes,
  projectTeamId,
  teamStoredBytes,
} from '@repo/db';
import { putObject, getObject, deleteObject } from '@repo/storage';
import { HttpError } from '#shared/lib';
import { getLimits } from '#shared/limits';

// Re-exported so this stays the one place every attachment-owning module (issue,
// chat, document, initiative) imports the key/filename helpers from — the
// functions themselves live in @repo/storage so the worker can use them too.
export { safeAttachmentFilename, attachmentObjectKey } from '@repo/storage';
// Same reasoning: the worker takes this same advisory lock (by the same
// namespace constant) before it checks an imported attachment against the
// project's quota, so the two processes actually contend on one lock rather
// than each thinking it has exclusive access.
export { lockAttachmentStorage } from '@repo/db';

export async function assertAttachmentStorageCapacity(
  projectId: number,
  addedBytes: number,
  replacedBytes = 0,
  executor: DbExecutor = db,
): Promise<void> {
  const limits = await getStorageSettings();
  if (limits.projectQuotaMb > 0) {
    const used = (await projectStoredBytes(projectId, executor)) - replacedBytes;
    if (used + addedBytes > limits.projectQuotaMb * MB) {
      throw new HttpError(
        413,
        `The project has used its ${limits.projectQuotaMb} MB storage quota. Delete attachments to free space.`,
      );
    }
  }
  // The instance quota above is per project; a team may hold a ceiling of its own
  // across all of them. The team is read through the same executor: a project copy
  // checks the quota of a project its own transaction has not committed yet.
  const teamId = await projectTeamId(projectId, executor);
  if (teamId == null) throw new HttpError(404, 'Project not found');
  const { maxStorageBytes } = await getLimits({ teamId });
  if (maxStorageBytes > 0) {
    const used = (await teamStoredBytes(teamId, executor)) - replacedBytes;
    if (used + addedBytes > maxStorageBytes) {
      throw new HttpError(
        413,
        `The team has used its ${Math.round(maxStorageBytes / MB)} MB of storage. Delete attachments to free space.`,
      );
    }
  }
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

// An embed of a deleted attachment left in markdown would 404 once the object is
// gone. Strip any construct whose URL carries this attachment's publicId: a
// markdown image/link, or an inline <img>/<video>. The publicId is a uuid, so a
// URL substring match is specific to this one attachment.
export function stripAttachmentEmbeds(text: string, publicId: string): string {
  const id = publicId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return text
    .replace(new RegExp(`!?\\[[^\\]]*\\]\\([^)]*${id}[^)]*\\)`, 'g'), '')
    .replace(new RegExp(`<img\\b[^>]*${id}[^>]*>`, 'g'), '')
    .replace(new RegExp(`<video\\b[^>]*${id}[^>]*>(?:\\s*</video>)?`, 'g'), '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

// The body of a public raw-download route. The bytes behind a publicId can be
// replaced, so the response is revalidated instead of cached for good: every write
// stores the file under a key with a fresh uuid, so a digest of the key changes
// with the bytes. It is the digest, not the key, because these routes are public
// and the key carries the project id, the owner id and the stored filename.
//
// The bytes and their content type are attacker-controlled, and the routes are
// public and same-origin as the planner UI, so serving an HTML or SVG file inline
// would be stored XSS. attachmentResponseHeaders is what keeps them inert.
export async function attachmentObjectResponse(input: {
  s3Key: string;
  contentType: string;
  filename: string;
  request: Request;
  download: boolean;
}): Promise<Response> {
  const etag = attachmentEtag(input.s3Key);
  if (input.request.headers.get('if-none-match') === etag) {
    return new Response(null, { status: 304, headers: { ETag: etag } });
  }

  let obj;
  try {
    obj = await getObject(input.s3Key);
  } catch (err) {
    throw new HttpError(404, err instanceof Error ? err.message : 'Object not found');
  }

  return new Response(obj.body, {
    headers: attachmentResponseHeaders({
      contentType: input.contentType || obj.contentType,
      filename: input.filename,
      contentLength: obj.contentLength,
      etag,
      download: input.download,
    }),
  });
}
