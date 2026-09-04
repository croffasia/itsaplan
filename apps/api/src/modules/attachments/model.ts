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

// The public id is a UUID column. Validating its format here turns a malformed id
// into a 400 instead of letting it reach Postgres and surface as a 500.
export const publicIdParams = t.Object({ publicId: t.String({ format: 'uuid' }) });

export const uploadAttachmentBody = t.Object({ file: t.File() });

export const importAttachmentBody = t.Object({
  filename: t.String({ minLength: 1 }),
  url: t.Optional(t.String()),
  contentBase64: t.Optional(t.String()),
  contentType: t.Optional(t.String()),
});

export const rawAttachmentQuery = t.Object({ download: t.Optional(t.String()) });
