import { randomUUID } from 'node:crypto';
import type { StorageDriver } from './driver';
import { createS3Driver } from './s3';
import { createSharePointDriver, sharePointConfigFromEnv } from './sharepoint';

export type { StorageDriver, StoredObject } from './driver';
export { createS3Driver } from './s3';
export { createSharePointDriver, sharePointConfigFromEnv } from './sharepoint';

// Object store for attachments — api's issue/chat/document/initiative attachments,
// avatars, skill files and the worker's imported issue attachments alike. Only the
// file bytes live here; the metadata and object key are rows in whichever table
// owns them (issue_attachment, chat_attachment, ...).
//
// STORAGE_DRIVER picks the backend: "s3" (the default; RustFS in the Compose
// stacks or any S3-compatible store) or "sharepoint" (a SharePoint document
// library / OneDrive through Microsoft Graph). A misconfigured driver throws on
// first use, naming the variables to set.

export function storageDriverName(env: NodeJS.ProcessEnv = process.env): 's3' | 'sharepoint' {
  const name = (env.STORAGE_DRIVER || 's3').trim().toLowerCase();
  if (name === 's3' || name === 'sharepoint') return name;
  throw new Error(`Unknown STORAGE_DRIVER '${env.STORAGE_DRIVER}': use "s3" or "sharepoint".`);
}

let cached: { name: string; driver: StorageDriver } | null = null;

function driver(): StorageDriver {
  const name = storageDriverName();
  if (cached?.name === name) return cached.driver;
  const created =
    name === 'sharepoint' ? createSharePointDriver(sharePointConfigFromEnv()) : createS3Driver();
  cached = { name, driver: created };
  return created;
}

export async function putObject(key: string, body: Buffer, contentType: string): Promise<void> {
  await driver().put(key, body, contentType);
}

// Returns a web ReadableStream of the object body so a route can stream it to
// the client without buffering the whole file (matters for video). contentType
// and contentLength fall back to sensible defaults when the object store omits them.
export async function getObject(
  key: string,
): Promise<{ body: ReadableStream; contentType: string; contentLength?: number }> {
  return driver().get(key);
}

// Reads a whole object into a UTF-8 string. For small text objects (skill
// markdown and references); do not use for large binaries — it buffers fully.
export async function getObjectText(key: string): Promise<string> {
  const { body } = await getObject(key);
  return new Response(body).text();
}

export async function deleteObject(key: string): Promise<void> {
  await driver().delete(key);
}

// Deletes several objects, best-effort (a failed delete only orphans bytes).
export async function deleteObjects(keys: string[]): Promise<void> {
  await Promise.all(
    keys.map((key) =>
      deleteObject(key).catch((err) => {
        console.error(`[storage] failed to delete object ${key}:`, err);
      }),
    ),
  );
}

// Keeps a filename usable as a path segment and free of control characters,
// falling back to a plain default when nothing usable is left.
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

// The object key an attachment is stored under: scoped by project and namespace,
// optionally by an owner within it (an issue id, say), and made unique with a
// uuid so re-uploading the same filename never collides with or overwrites
// an earlier version.
export function attachmentObjectKey(
  projectId: number,
  namespace: 'attachments' | 'chat' | 'documents' | 'initiatives',
  ownerId: number | null,
  filename: string,
): string {
  const safeName = safeAttachmentFilename(filename)
    .replace(/[^\w.-]+/g, '_')
    .slice(-100);
  const ownerPath = ownerId === null ? '' : `${ownerId}/`;
  return `projects/${projectId}/${namespace}/${ownerPath}${randomUUID()}-${safeName}`;
}
