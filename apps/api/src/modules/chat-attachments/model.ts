import { t } from 'elysia';

export { projectKeyParams } from '../issues/model';
export { rawAttachmentQuery } from '../attachments/model';

export const publicIdParams = t.Object({ publicId: t.String() });

// The upload carries its bytes as base64 rather than multipart, so the one route
// serves the chat composer and MCP callers alike (a tool call is a JSON body).
export const uploadChatAttachmentBody = t.Object({
  filename: t.String({ minLength: 1 }),
  contentBase64: t.String({ minLength: 1 }),
  contentType: t.Optional(t.String()),
});

// Wire shape produced by chatAttachmentDto (see the controller for what it omits).
export const ChatAttachmentResponse = t.Object({
  id: t.String(),
  filename: t.String(),
  contentType: t.String(),
  sizeBytes: t.Number(),
  createdAt: t.String(),
  url: t.String(),
});

// The read route answers with the metadata plus the content in the shape the
// file holds: a parsed table for a spreadsheet or document, the full text for
// a text file, neither for a binary one.
export const ChatAttachmentContentResponse = t.Object({
  id: t.String(),
  filename: t.String(),
  contentType: t.String(),
  sizeBytes: t.Number(),
  createdAt: t.String(),
  url: t.String(),
  table: t.Optional(
    t.Object({
      headers: t.Array(t.String()),
      sampleRows: t.Array(t.Array(t.String())),
      totalRows: t.Number(),
    }),
  ),
  text: t.Optional(t.String()),
});
