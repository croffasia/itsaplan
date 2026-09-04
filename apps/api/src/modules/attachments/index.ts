import { Elysia, t } from 'elysia';
import { noContent } from '#shared/http';
import { authContext } from '#shared/auth-context';
import { entityGuard } from '#shared/guards';
import { HttpError } from '#shared/lib';
import { getObject } from '#shared/s3';
import { assertPublicHttpUrl } from '#shared/net';
import { mcpTool } from '#mcp/generate';
import { accessErrors, commonErrors, errors } from '#shared/responses';
import { getIssueProjectId } from '#modules/issues/service';
import { getStorageSettings, MB } from '#modules/settings/service';
import {
  AttachmentResponse,
  AttachmentListResponse,
  importAttachmentBody,
  issueParams,
  publicIdParams,
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
  type AttachmentRow,
} from './service';
import {
  assertAttachmentUploadAllowed,
  attachmentEtag,
  attachmentObjectKey,
  attachmentResponseHeaders,
  deleteAttachmentObject,
  safeAttachmentFilename,
  storeAttachmentObject,
} from './storage';

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

      const filename = safeAttachmentFilename(file.name);
      const contentType = file.type || 'application/octet-stream';
      await assertAttachmentUploadAllowed(projectId, file.size, contentType);

      const key = attachmentObjectKey(projectId, 'attachments', issueId, filename);
      await storeAttachmentObject(key, Buffer.from(await file.arrayBuffer()), contentType);

      let row;
      try {
        row = await createAttachment({
          projectId,
          issueId,
          s3Key: key,
          filename,
          contentType,
          sizeBytes: file.size,
        });
      } catch (error) {
        await deleteAttachmentObject(key);
        throw error;
      }
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
      const filename = safeAttachmentFilename(body.filename);
      const { url, contentBase64 } = body;
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
      await assertAttachmentUploadAllowed(projectId, bytes.length, contentType);

      const key = attachmentObjectKey(projectId, 'attachments', issueId, filename);
      await storeAttachmentObject(key, bytes, contentType);

      let row;
      try {
        row = await createAttachment({
          projectId,
          issueId,
          s3Key: key,
          filename,
          contentType,
          sizeBytes: bytes.length,
        });
      } catch (error) {
        await deleteAttachmentObject(key);
        throw error;
      }
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

      const filename = safeAttachmentFilename(file.name, existing.filename);
      const contentType = file.type || 'application/octet-stream';
      await assertAttachmentUploadAllowed(projectId, file.size, contentType, existing.sizeBytes);

      const key = attachmentObjectKey(projectId, 'attachments', existing.issueId, filename);
      await storeAttachmentObject(key, Buffer.from(await file.arrayBuffer()), contentType);

      let replacement;
      try {
        replacement = await replaceAttachmentContent(params.publicId, projectId, {
          s3Key: key,
          filename,
          contentType,
          sizeBytes: file.size,
        });
        if (!replacement) throw new HttpError(404, 'Attachment not found');
      } catch (error) {
        await deleteAttachmentObject(key);
        throw error;
      }

      // The row already points at the new object, so a failed delete only
      // orphans the old bytes.
      await deleteAttachmentObject(replacement.replacedS3Key);
      return attachmentDto(replacement.attachment);
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
      await deleteAttachmentObject(row.s3Key);
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
      const etag = attachmentEtag(row.s3Key);
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
      const headers = attachmentResponseHeaders({
        contentType: row.contentType || obj.contentType,
        filename: row.filename,
        contentLength: obj.contentLength,
        etag,
        download: query.download != null,
      });
      return new Response(obj.body, { headers });
    },
    {
      params: publicIdParams,
      query: rawAttachmentQuery,
      // Public route: no 401/403. Returns a raw Response (bytes), so no typed 200
      // body — Elysia cannot validate a raw Response. Only the statuses it can throw.
      response: { ...errors(400, 404) },
      detail: { summary: 'Download or preview an attachment (public, no auth)' },
    },
  );
