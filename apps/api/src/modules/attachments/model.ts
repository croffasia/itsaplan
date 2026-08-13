import { t } from 'elysia';

// Wire shape produced by attachmentDto (see the controller for what it omits).
export const AttachmentResponse = t.Object({
  id: t.String(),
  filename: t.String(),
  contentType: t.String(),
  sizeBytes: t.Number(),
  createdAt: t.String(),
  url: t.String(),
});

export const AttachmentListResponse = t.Array(AttachmentResponse);

export const issueParams = t.Object({ issueId: t.Numeric() });

export const uploadAttachmentBody = t.Object({ file: t.File() });

export const importAttachmentBody = t.Object({
  filename: t.String({ minLength: 1 }),
  url: t.Optional(t.String()),
  contentBase64: t.Optional(t.String()),
  contentType: t.Optional(t.String()),
});

export const rawAttachmentQuery = t.Object({ download: t.Optional(t.String()) });
