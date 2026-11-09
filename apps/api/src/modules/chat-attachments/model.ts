import { t } from 'elysia';
import { AttachmentContent } from '../attachments/model';

export { projectKeyParams } from '../issues/model';
export { publicIdParams, rawAttachmentQuery } from '../attachments/model';

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

export const ChatAttachmentContentResponse = t.Composite([
  ChatAttachmentResponse,
  AttachmentContent,
]);
