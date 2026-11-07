import { Elysia, t } from 'elysia';
import { noContent } from '#shared/http';
import { authContext } from '#shared/auth-context';
import { assertMcpAllowed, assertProjectReachable, entityGuard } from '#shared/guards';
import { assertPermission } from '#shared/access';
import { HttpError } from '#shared/lib';
import { mcpImageTool, mcpTool } from '#mcp/generate';
import { accessErrors, commonErrors, errors } from '#shared/responses';
import { getIssueProjectId } from '#modules/issues/service';
import { viewFile } from '#modules/chat-attachments/service';
import {
  getInitiativeAttachment,
  getInitiativeAttachmentProjectId,
} from '#modules/initiatives/attachments';
import {
  AttachmentResponse,
  AttachmentListResponse,
  importAttachmentBody,
  issueParams,
  publicIdParams,
  rawAttachmentQuery,
  uploadAttachmentBody,
  viewAttachmentQuery,
  ViewAttachmentsResponse,
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
  attachmentObjectKey,
  attachmentObjectResponse,
  deleteAttachmentObject,
  readImportedFile,
  safeAttachmentFilename,
  storeAttachmentObject,
  viewAttachments,
  VIEWABLE_IMAGES,
} from './storage';

const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;

// Public shape returned to the UI: never exposes the internal serial id or the
// object key. `url` is the public, no-auth download route — it can be embedded in
// an issue description and fetched by external services.
function attachmentDto(a: Omit<AttachmentRow, 'id' | 'issueId'>) {
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
    // For /attachments/view, which takes the attachment of an issue or an initiative:
    // the checks entityGuard makes, for whichever of the two it is.
    viewableAttachment: {
      async resolve({ query, user, request }) {
        const id = String(query.attachment ?? '').match(UUID)?.[0];
        if (!id) throw new HttpError(404, 'Attachment not found');
        const issueRow = await getAttachmentByPublicId(id);
        if (issueRow) {
          const projectId = await getIssueProjectId(issueRow.issueId);
          if (projectId == null) throw new HttpError(404, 'Attachment not found');
          await assertPermission(projectId, user, 'work_items', 'read');
          await assertMcpAllowed(projectId, request.headers);
          return { viewed: { row: issueRow, dto: attachmentDto(issueRow) } };
        }
        const row = await getInitiativeAttachment(id);
        const projectId = await getInitiativeAttachmentProjectId(id);
        if (!row || projectId == null) throw new HttpError(404, 'Attachment not found');
        await assertPermission(projectId, user, 'initiatives', 'read');
        await assertProjectReachable(projectId, request, 'initiatives');
        const dto = { ...attachmentDto(row), url: `/initiative-attachments/${id}/raw` };
        return { viewed: { row, dto } };
      },
    },
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
      issueAttachment: 'edit',
      response: { 201: AttachmentResponse, ...commonErrors, ...errors(413, 502) },
      detail: { summary: 'Upload an attachment' },
    },
  )

  .post(
    '/issues/:issueId/attachments/import',
    async ({ params, body, set, projectId }) => {
      const issueId = params.issueId;
      const filename = safeAttachmentFilename(body.filename);
      const { bytes, contentType } = await readImportedFile(body);
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
      issueAttachment: 'edit',
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

  .get('/attachments/view', ({ viewed }) => viewFile(viewed.row, viewed.dto), {
    query: viewAttachmentQuery,
    viewableAttachment: true,
    response: { 200: ViewAttachmentsResponse, ...commonErrors, ...errors(502) },
    detail: {
      summary: 'View an attachment',
      description:
        'Open one attachment of an issue or an initiative, given the url a result carries ' +
        `for it or its id. An image comes back as the image itself (${VIEWABLE_IMAGES}). ` +
        'Any other file comes back in `others` with its url and, for a PDF or a text file, ' +
        'its full text; for a spreadsheet or document (.xlsx, .csv, .docx), its column ' +
        'headers and first rows. A scanned PDF has no text to read.',
      ...mcpImageTool('view_attachment'),
    },
  })

  .get(
    '/issues/:issueId/images',
    async ({ params }) => viewAttachments(await listAttachments(params.issueId), attachmentDto),
    {
      params: issueParams,
      issueAttachment: 'read',
      response: { 200: ViewAttachmentsResponse, ...commonErrors },
      detail: {
        summary: 'View the images of an issue',
        description:
          `Look at the images attached to an issue, by its numeric id: ${VIEWABLE_IMAGES}. ` +
          'Every other attachment comes back in `others` with its url.',
        ...mcpImageTool('view_issue_images'),
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
      return attachmentObjectResponse({
        s3Key: row.s3Key,
        contentType: row.contentType,
        filename: row.filename,
        request,
        download: query.download != null,
      });
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
