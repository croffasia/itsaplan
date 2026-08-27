import { Elysia } from 'elysia';
import { randomUUID, createHash } from 'node:crypto';
import { authContext } from '#shared/auth-context';
import { guards, entityGuard } from '#shared/guards';
import { HttpError } from '#shared/lib';
import { putObject, getObject } from '#shared/s3';
import { mcpTool } from '#mcp/generate';
import { accessErrors, commonErrors, errors } from '#shared/responses';
import { requireUser } from '#shared/access';
import {
  getStorageSettings,
  mimeAllowed,
  MB,
  type StorageSettings,
} from '#modules/settings/service';
import { getProjectAttachmentBytes } from '#modules/attachments/service';
import {
  ChatAttachmentContentResponse,
  ChatAttachmentResponse,
  projectKeyParams,
  publicIdParams,
  rawAttachmentQuery,
  uploadChatAttachmentBody,
} from './model';
import {
  createChatAttachment,
  getChatAttachmentByPublicId,
  getChatAttachmentProjectId,
  getProjectChatAttachmentBytes,
  readChatAttachmentContent,
  type ChatAttachmentRow,
} from './service';

// Chat attachments: files uploaded in an agent chat. The upload and read routes
// are MCP tools, so an internal agent and an external MCP client can both drop a
// file and read one back; the download route is public, like an issue
// attachment's, so the link a chat message renders works for anyone viewing it.

// The upload limits are instance settings, read per request. The quota counts
// both issue and chat attachments, the two tenants of a project's stored bytes.
async function assertUploadAllowed(
  limits: StorageSettings,
  projectId: number,
  size: number,
  contentType: string,
): Promise<void> {
  if (size > limits.maxAttachmentMb * MB) {
    throw new HttpError(413, `File exceeds the ${limits.maxAttachmentMb} MB limit`);
  }
  if (!mimeAllowed(contentType, limits.attachmentMimeTypes)) {
    throw new HttpError(400, `Files of type "${contentType}" are not accepted on this instance`);
  }
  if (limits.projectQuotaMb > 0) {
    const used =
      (await getProjectAttachmentBytes(projectId)) +
      (await getProjectChatAttachmentBytes(projectId));
    if (used + size > limits.projectQuotaMb * MB) {
      throw new HttpError(
        413,
        `The project has used its ${limits.projectQuotaMb} MB storage quota. Delete attachments to free space.`,
      );
    }
  }
}

// Object keys are grouped by project so a project's bytes sit under one prefix in
// the bucket, which is what makes per-project listing, cleanup, and policies
// possible. The original filename stays the last key segment so the extension is
// visible in the bucket.
function chatAttachmentKey(projectId: number, filename: string): string {
  const safeName = filename.replace(/[^\w.-]+/g, '_').slice(-100);
  return `projects/${projectId}/chat/${randomUUID()}-${safeName}`;
}

// Public shape: never exposes the internal serial id or the object key. `url` is
// the public, no-auth download route.
function chatAttachmentDto(a: ChatAttachmentRow) {
  return {
    id: a.publicId,
    filename: a.filename,
    contentType: a.contentType,
    sizeBytes: a.sizeBytes,
    createdAt: a.createdAt,
    url: `/chat-attachments/${a.publicId}/raw`,
  };
}

export const chatAttachmentRoutes = new Elysia({
  name: 'chat-attachments',
  detail: { tags: ['Chat attachments'] },
})
  .use(authContext)
  .use(guards)
  .macro({
    chatAttachment: entityGuard('work_items', 'Attachment not found', (p) =>
      getChatAttachmentProjectId(p.publicId),
    ),
  })

  // Stores one file for the chat. The bytes arrive as base64 rather than
  // multipart, so the chat composer and an MCP client call the same route.
  .post(
    '/projects/:projectKey/chat-attachments',
    async ({ body, set, project, user }) => {
      const bytes = Buffer.from(body.contentBase64, 'base64');
      if (bytes.length === 0) {
        throw new HttpError(400, 'contentBase64 is empty or not valid base64');
      }
      const filename = body.filename;
      const contentType = body.contentType || 'application/octet-stream';
      await assertUploadAllowed(await getStorageSettings(), project.id, bytes.length, contentType);

      const key = chatAttachmentKey(project.id, filename);
      try {
        await putObject(key, bytes, contentType);
      } catch (err) {
        throw new HttpError(502, `Object store error: ${err instanceof Error ? err.message : err}`);
      }

      const row = await createChatAttachment({
        projectId: project.id,
        uploadedByUserId: requireUser(user).id,
        s3Key: key,
        filename,
        contentType,
        sizeBytes: bytes.length,
      });
      set.status = 201;
      return chatAttachmentDto(row);
    },
    {
      body: uploadChatAttachmentBody,
      params: projectKeyParams,
      permission: ['work_items', 'create'],
      response: { 201: ChatAttachmentResponse, ...commonErrors, ...errors(413, 502) },
      detail: {
        summary: 'Upload a chat attachment',
        description:
          'Store a file for the agent chat: a spreadsheet to import issues from, a spec, or a log. ' +
          'Send the bytes as base64 in `contentBase64`. Read it back with read_chat_attachment.',
        ...mcpTool('upload_chat_attachment'),
      },
    },
  )

  // Reads a stored file back: its metadata and, when the file holds one, its
  // content — a parsed table for a spreadsheet or document, an excerpt for a
  // text file.
  .get(
    '/chat-attachments/:publicId',
    async ({ params }) => {
      const row = await getChatAttachmentByPublicId(params.publicId);
      if (!row) throw new HttpError(404, 'Attachment not found');
      return { ...chatAttachmentDto(row), ...(await readChatAttachmentContent(row)) };
    },
    {
      params: publicIdParams,
      chatAttachment: 'read',
      response: { 200: ChatAttachmentContentResponse, ...accessErrors, ...errors(400) },
      detail: {
        summary: 'Read a chat attachment',
        description:
          'Read a file uploaded in the chat: its metadata and, for a spreadsheet or document ' +
          '(.xlsx, .csv, .docx), the column headers and first rows; for a text file, its first ' +
          'characters. The id comes from the [file: "name" (attachment id: …)] marker in the ' +
          "user's message. To turn a table into issues, map its columns with prepare_issue_import.",
        ...mcpTool('read_chat_attachment'),
      },
    },
  )

  // Public download URL: unauthenticated so the link rendered in a chat message
  // works for anyone who can see the conversation. The publicId is an
  // unguessable uuid.
  .get(
    '/chat-attachments/:publicId/raw',
    async ({ params, query, request }) => {
      const row = await getChatAttachmentByPublicId(params.publicId);
      if (!row) throw new HttpError(404, 'Attachment not found');

      // The etag is a digest of the key rather than the key itself: this route is
      // public, and the key carries the project id and the stored filename.
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
      detail: { summary: 'Download a chat attachment (public, no auth)' },
    },
  );
