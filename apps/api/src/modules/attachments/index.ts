import { Elysia, t } from 'elysia';
import { randomUUID, createHash } from 'node:crypto';
import { noContent } from '#shared/http';
import { authContext } from '#shared/auth-context';
import { entityGuard } from '#shared/guards';
import { HttpError } from '#shared/lib';
import { putObject, getObject, deleteObject } from '#shared/s3';
import { assertPublicHttpUrl } from '#shared/net';
import { mcpTool } from '#mcp/generate';
import { accessErrors, commonErrors, errors } from '#shared/responses';
import { getIssueProjectId } from '#modules/issues/service';
import {
  getStorageSettings,
  mimeAllowed,
  MB,
  type StorageSettings,
} from '#modules/settings/service';
import {
  AttachmentResponse,
  AttachmentListResponse,
  importAttachmentBody,
  issueParams,
  rawAttachmentQuery,
  uploadAttachmentBody,
} from './model';
import {
  createAttachment,
  listAttachments,
  getAttachmentByPublicId,
  replaceAttachmentContent,
  deleteAttachmentByPublicId,
  removeAttachmentEmbeds,
  getProjectAttachmentBytes,
  type AttachmentRow,
} from './service';

// The upload limits are instance settings (see modules/settings/service.ts), read per
// request so a change in god mode takes effect without a restart.
async function assertUploadAllowed(
  limits: StorageSettings,
  projectId: number,
  size: number,
  contentType: string,
  // Bytes the new file takes the place of, which the quota gets back.
  replacedBytes = 0,
): Promise<void> {
  if (size > limits.maxAttachmentMb * MB) {
    throw new HttpError(413, `File exceeds the ${limits.maxAttachmentMb} MB limit`);
  }
  if (!mimeAllowed(contentType, limits.attachmentMimeTypes)) {
    throw new HttpError(400, `Files of type "${contentType}" are not accepted on this instance`);
  }
  if (limits.projectQuotaMb > 0) {
    const used = (await getProjectAttachmentBytes(projectId)) - replacedBytes;
    if (used + size > limits.projectQuotaMb * MB) {
      throw new HttpError(
        413,
        `The project has used its ${limits.projectQuotaMb} MB storage quota. Delete attachments to free space.`,
      );
    }
  }
}

// A failed write to the object store is nothing the caller can fix, so it is
// logged with what it takes to find the object and reported as a bad gateway.
async function storeObject(key: string, bytes: Buffer, contentType: string): Promise<void> {
  try {
    await putObject(key, bytes, contentType);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(
      `[planner] object store PUT failed (bucket=${process.env.S3_BUCKET}, key=${key}, size=${bytes.length}):`,
      err,
    );
    throw new HttpError(502, `Object store error: ${msg}`);
  }
}

// Object keys are grouped by project so a project's bytes sit under one prefix in
// the bucket, which is what makes per-project listing, cleanup, and policies
// possible. Keys already stored keep their old form; the full key lives in the row.
function attachmentKey(projectId: number, issueId: number, filename: string): string {
  // Keep the original filename as the last key segment so the extension is visible
  // in the bucket and to any tool that sniffs the key by suffix.
  const safeName = filename.replace(/[^\w.-]+/g, '_').slice(-100);
  return `projects/${projectId}/attachments/${issueId}/${randomUUID()}-${safeName}`;
}

// Public shape returned to the UI: never exposes the internal serial id or the
// object key. `url` is the public, no-auth download route — it can be embedded in
// an issue description and fetched by external services.
function attachmentDto(a: AttachmentRow) {
  return {
    id: a.publicId,
    filename: a.filename,
    contentType: a.contentType,
    sizeBytes: a.sizeBytes,
    createdAt: a.createdAt,
    url: `/attachments/${a.publicId}/raw`,
  };
}

export const attachmentRoutes = new Elysia({
  name: 'attachments',
  detail: { tags: ['Attachments'] },
})
  .use(authContext)
  // Guards for the attachment routes, keyed by how they address the work item:
  // `issueAttachment` for /issues/:issueId/attachments, `attachment` for
  // /attachments/:publicId. Both assert a work_items action on the owning project.
  .macro({
    issueAttachment: entityGuard('work_items', 'Issue not found', (p) =>
      getIssueProjectId(Number(p.issueId)),
    ),
    attachment: entityGuard('work_items', 'Attachment not found', async (p) => {
      const existing = await getAttachmentByPublicId(p.publicId);
      if (!existing) return null;
      return getIssueProjectId(existing.issueId);
    }),
  })
  .get(
    '/issues/:issueId/attachments',
    async ({ params }) => {
      const rows = await listAttachments(params.issueId);
      return rows.map(attachmentDto);
    },
    {
      params: issueParams,
      issueAttachment: 'read',
      response: { 200: AttachmentListResponse, ...commonErrors },
      detail: {
        summary: 'List attachments',
        description: "List an issue's attachments by its numeric id.",
        ...mcpTool('list_attachments'),
      },
    },
  )

  // Accepts a multipart form with a single "file" field, stores the bytes in the
  // object store, and records the metadata. Returns the attachment DTO.
  .post(
    '/issues/:issueId/attachments',
    async ({ params, body, set, projectId }) => {
      const issueId = params.issueId;
      const file = body.file;
      if (!(file instanceof File)) throw new HttpError(400, 'No file uploaded (form field "file")');
      if (file.size === 0) throw new HttpError(400, 'Uploaded file is empty');

      const filename = file.name || 'file';
      const contentType = file.type || 'application/octet-stream';
      await assertUploadAllowed(await getStorageSettings(), projectId, file.size, contentType);

      const key = attachmentKey(projectId, issueId, filename);
      await storeObject(key, Buffer.from(await file.arrayBuffer()), contentType);

      const row = await createAttachment({
        issueId,
        s3Key: key,
        filename,
        contentType,
        sizeBytes: file.size,
      });
      set.status = 201;
      return attachmentDto(row);
    },
    {
      body: uploadAttachmentBody,
      params: issueParams,
      issueAttachment: 'create',
      response: { 201: AttachmentResponse, ...commonErrors, ...errors(413, 502) },
      detail: { summary: 'Upload an attachment' },
    },
  )

  // Adds an attachment from a URL or inline base64, for callers that cannot send a
  // multipart file (internal agents). Exactly one of url / contentBase64 is given.
  // A URL is fetched server-side, so it is SSRF-guarded (https only in prod, no
  // private/local hosts, no redirects) and size-capped like a direct upload.
  .post(
    '/issues/:issueId/attachments/import',
    async ({ params, body, set, projectId }) => {
      const issueId = params.issueId;
      const { filename, url, contentBase64 } = body;
      if ((url == null) === (contentBase64 == null)) {
        throw new HttpError(400, 'Provide exactly one of url or contentBase64');
      }
      const limits = await getStorageSettings();

      let bytes: Buffer;
      let contentType: string;
      if (url != null) {
        const target = await assertPublicHttpUrl(url);
        let res: Response;
        try {
          res = await fetch(target, { redirect: 'manual', signal: AbortSignal.timeout(15000) });
        } catch {
          throw new HttpError(400, 'Could not fetch the url');
        }
        if (res.status >= 300 && res.status < 400) {
          throw new HttpError(400, 'The url redirects; provide the final url');
        }
        if (!res.ok) throw new HttpError(400, `Could not fetch the url (status ${res.status})`);
        const declared = Number(res.headers.get('content-length') ?? '');
        if (declared && declared > limits.maxAttachmentMb * MB) {
          throw new HttpError(413, `File exceeds the ${limits.maxAttachmentMb} MB limit`);
        }
        bytes = Buffer.from(await res.arrayBuffer());
        contentType =
          body.contentType ||
          res.headers.get('content-type')?.split(';')[0]?.trim() ||
          'application/octet-stream';
      } else {
        bytes = Buffer.from(contentBase64 as string, 'base64');
        if (bytes.length === 0)
          throw new HttpError(400, 'contentBase64 is empty or not valid base64');
        contentType = body.contentType || 'application/octet-stream';
      }

      if (bytes.length === 0) throw new HttpError(400, 'The file is empty');
      await assertUploadAllowed(limits, projectId, bytes.length, contentType);

      const key = attachmentKey(projectId, issueId, filename);
      await storeObject(key, bytes, contentType);

      const row = await createAttachment({
        issueId,
        s3Key: key,
        filename,
        contentType,
        sizeBytes: bytes.length,
      });
      set.status = 201;
      return attachmentDto(row);
    },
    {
      params: issueParams,
      body: importAttachmentBody,
      issueAttachment: 'create',
      response: { 201: AttachmentResponse, ...commonErrors, ...errors(413, 502) },
      detail: {
        summary: 'Add an attachment from a URL or base64',
        description: 'Attach a file to an issue without a multipart upload.',
        ...mcpTool('add_attachment'),
      },
    },
  )

  // Swaps the bytes behind an attachment, keeping its publicId and so its URL:
  // an edited image (annotated, cropped) stays the same attachment and every
  // embed of it in a description shows the new version. The old object is
  // dropped, and the raw route serves the new bytes because it revalidates.
  .put(
    '/attachments/:publicId',
    async ({ params, body, projectId }) => {
      const existing = await getAttachmentByPublicId(params.publicId);
      if (!existing) throw new HttpError(404, 'Attachment not found');

      const file = body.file;
      if (!(file instanceof File)) throw new HttpError(400, 'No file uploaded (form field "file")');
      if (file.size === 0) throw new HttpError(400, 'Uploaded file is empty');

      const filename = file.name || existing.filename;
      const contentType = file.type || 'application/octet-stream';
      await assertUploadAllowed(
        await getStorageSettings(),
        projectId,
        file.size,
        contentType,
        existing.sizeBytes,
      );

      const key = attachmentKey(projectId, existing.issueId, filename);
      await storeObject(key, Buffer.from(await file.arrayBuffer()), contentType);

      const row = await replaceAttachmentContent(params.publicId, {
        s3Key: key,
        filename,
        contentType,
        sizeBytes: file.size,
      });
      if (!row) throw new HttpError(404, 'Attachment not found');

      // The row already points at the new object, so a failed delete only
      // orphans the old bytes.
      await deleteObject(existing.s3Key).catch((err) => {
        console.error(
          `[planner] failed to delete object ${existing.s3Key}:`,
          err instanceof Error ? err.message : err,
        );
      });
      return attachmentDto(row);
    },
    {
      body: uploadAttachmentBody,
      attachment: 'edit',
      response: { 200: AttachmentResponse, ...commonErrors, ...errors(413, 502) },
      detail: { summary: "Replace an attachment's file" },
    },
  )

  .delete(
    '/attachments/:publicId',
    async ({ params }) => {
      const row = await deleteAttachmentByPublicId(params.publicId);
      if (!row) throw new HttpError(404, 'Attachment not found');
      // Strip any embed of this attachment from the issue description and its
      // markdown field values, so no broken image is left behind.
      await removeAttachmentEmbeds(row.issueId, row.publicId);
      // Row is already gone; a failed object delete only orphans bytes, so don't
      // fail the request over it.
      await deleteObject(row.s3Key).catch((err) => {
        console.error(
          `[planner] failed to delete object ${row.s3Key}:`,
          err instanceof Error ? err.message : err,
        );
      });
      return noContent();
    },
    {
      attachment: 'delete',
      response: { 204: t.Void(), ...accessErrors },
      detail: {
        summary: 'Delete an attachment',
        description: 'Delete an attachment. Irreversible.',
        ...mcpTool('delete_attachment'),
      },
    },
  )

  // Public download/preview URL: unauthenticated so it works in <img>/<video>
  // tags and can be fetched by external services. The publicId is an unguessable
  // uuid. `?download=1` forces a download instead of inline rendering.
  .get(
    '/attachments/:publicId/raw',
    async ({ params, query, request }) => {
      const row = await getAttachmentByPublicId(params.publicId);
      if (!row) throw new HttpError(404, 'Attachment not found');

      // The bytes behind a publicId can be replaced, so the response is
      // revalidated instead of cached for good. Every write stores the file
      // under a key with a fresh uuid, so a digest of the key changes with the
      // bytes. It is the digest, not the key, because this route is public and
      // the key carries the project id, the issue id and the stored filename.
      const etag = `"${createHash('sha256').update(row.s3Key).digest('base64url').slice(0, 22)}"`;
      if (request.headers.get('if-none-match') === etag) {
        return new Response(null, { status: 304, headers: { ETag: etag } });
      }

      let obj;
      try {
        obj = await getObject(row.s3Key);
      } catch (err) {
        throw new HttpError(404, err instanceof Error ? err.message : 'Object not found');
      }

      // The bytes and their content type are attacker-controlled, and this route
      // is public and same-origin as the planner UI, so serving an HTML or SVG
      // file inline would be stored XSS. Defenses: X-Content-Type-Options:nosniff
      // stops MIME sniffing, and inline rendering is allowed only for a strict
      // media allowlist (raster images, video, audio). Everything else — html,
      // svg, xml, scripts — is forced to download and cannot execute.
      const ct = row.contentType || obj.contentType;
      const inlineSafe = /^(image\/(png|jpe?g|gif|webp|avif|bmp)|video\/|audio\/)/i.test(ct);
      const inline = inlineSafe && query.download == null;
      const headers: Record<string, string> = {
        'Content-Type': ct,
        'Content-Disposition': `${inline ? 'inline' : 'attachment'}; filename*=UTF-8''${encodeURIComponent(row.filename)}`,
        'X-Content-Type-Options': 'nosniff',
        'Cache-Control': 'no-cache',
        ETag: etag,
      };
      if (obj.contentLength != null) headers['Content-Length'] = String(obj.contentLength);
      if (!inline) headers['Content-Security-Policy'] = "default-src 'none'; sandbox";
      return new Response(obj.body, { headers });
    },
    {
      query: rawAttachmentQuery,
      // Public route: no 401/403. Returns a raw Response (bytes), so no typed 200
      // body — Elysia cannot validate a raw Response. Only the 404 it can throw.
      response: { ...errors(404) },
      detail: { summary: 'Download or preview an attachment (public, no auth)' },
    },
  );
