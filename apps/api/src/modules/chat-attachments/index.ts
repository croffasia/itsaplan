import { Elysia } from 'elysia';
import { authContext } from '#shared/auth-context';
import { guards, entityGuard } from '#shared/guards';
import { HttpError } from '#shared/lib';
import { mcpTool } from '#mcp/generate';
import { accessErrors, commonErrors, errors } from '#shared/responses';
import { requireUser } from '#shared/access';
import {
  assertAttachmentUploadAllowed,
  attachmentObjectKey,
  attachmentObjectResponse,
  deleteAttachmentObject,
  safeAttachmentFilename,
  storeAttachmentObject,
} from '#modules/attachments/storage';
import {
  ChatAttachmentContentResponse,
  ChatAttachmentResponse,
  projectKeyParams,
  publicIdParams,
  rawAttachmentQuery,
  uploadChatAttachmentBody,
} from './model';
import { pdfToMarkdown } from './pdf';
import {
  createChatAttachment,
  getChatAttachmentByPublicId,
  getChatAttachmentProjectId,
  readAttachmentContent,
  type ChatAttachmentRow,
} from './service';

// Chat attachments: files uploaded in an agent chat. The upload and read routes
// are MCP tools, so an internal agent and an external MCP client can both drop a
// file and read one back; the download route is public, like an issue
// attachment's, so the link a chat message renders works for anyone viewing it.

// A browser reports no type for a .md or .txt file on some platforms, and the
// instance allowlist matches on the type, so the extension answers for it.
const EXTENSION_TYPES: Record<string, string> = {
  md: 'text/markdown',
  txt: 'text/plain',
};

// Object keys are grouped by project so a project's bytes sit under one prefix in
// the bucket, which is what makes per-project listing, cleanup, and policies
// possible. The original filename stays the last key segment so the extension is
// visible in the bucket.
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
    chatAttachment: entityGuard('ai_agents', 'Attachment not found', (p) =>
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
      let filename = safeAttachmentFilename(body.filename);
      const extension = filename.toLowerCase().split('.').pop() ?? '';
      let contentType =
        body.contentType || EXTENSION_TYPES[extension] || 'application/octet-stream';
      await assertAttachmentUploadAllowed(project.id, bytes.length, contentType);

      // A PDF is stored as the Markdown it converts to: the original is
      // discarded, so the row, the download link, and the agent all see text.
      let content = bytes;
      if (/\.pdf$/i.test(filename) || contentType === 'application/pdf') {
        content = Buffer.from(await pdfToMarkdown(bytes), 'utf8');
        filename = filename.replace(/\.pdf$/i, '') + '.md';
        contentType = 'text/markdown';
        await assertAttachmentUploadAllowed(project.id, content.length, contentType);
      }

      const key = attachmentObjectKey(project.id, 'chat', null, filename);
      await storeAttachmentObject(key, content, contentType);

      let row;
      try {
        row = await createChatAttachment({
          projectId: project.id,
          uploadedByUserId: requireUser(user).id,
          s3Key: key,
          filename,
          contentType,
          sizeBytes: content.length,
        });
      } catch (error) {
        await deleteAttachmentObject(key);
        throw error;
      }
      set.status = 201;
      return chatAttachmentDto(row);
    },
    {
      body: uploadChatAttachmentBody,
      params: projectKeyParams,
      permission: ['ai_agents', 'read'],
      response: { 201: ChatAttachmentResponse, ...commonErrors, ...errors(413, 502) },
      detail: {
        summary: 'Upload a chat attachment',
        description:
          'Store a file for the agent chat: a spreadsheet to import issues from, a spec, or a log. ' +
          'A PDF is converted to Markdown and stored as a .md file; a scanned PDF is refused. ' +
          'Send the bytes as base64 in `contentBase64`. Read it back with read_chat_attachment.',
        ...mcpTool('upload_chat_attachment'),
      },
    },
  )

  // Reads a stored file back: its metadata and, when the file holds one, its
  // content — a parsed table for a spreadsheet or document, the full text for a
  // text file.
  .get(
    '/chat-attachments/:publicId',
    async ({ params }) => {
      const row = await getChatAttachmentByPublicId(params.publicId);
      if (!row) throw new HttpError(404, 'Attachment not found');
      return { ...chatAttachmentDto(row), ...(await readAttachmentContent(row)) };
    },
    {
      params: publicIdParams,
      chatAttachment: 'read',
      response: { 200: ChatAttachmentContentResponse, ...accessErrors, ...errors(400) },
      detail: {
        summary: 'Read a chat attachment',
        description:
          'Read a file the person attached in the chat. A [file: "name" (attachment id: …)] ' +
          'marker in their message means that file is attached: it is stored in the chat and ' +
          'is not on your filesystem, so read it with this tool and the id from the marker — ' +
          'never look for it on disk. Answers with the file metadata and, for a spreadsheet or ' +
          'document (.xlsx, .csv, .docx), the column headers and first rows; for a text file ' +
          '(.md, .txt, and a PDF converted to Markdown on upload), its full text. To turn a ' +
          'table into issues, map its columns with prepare_issue_import.',
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
      detail: { summary: 'Download a chat attachment (public, no auth)' },
    },
  );
