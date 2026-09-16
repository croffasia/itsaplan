import { t } from 'elysia';

export const documentParams = t.Object({
  projectKey: t.String(),
  documentId: t.Numeric(),
});

export const documentRevisionParams = t.Object({
  projectKey: t.String(),
  documentId: t.Numeric(),
  revisionId: t.Numeric(),
});

export const documentAssetParams = t.Object({
  projectKey: t.String(),
  documentId: t.Numeric(),
  publicId: t.String({ format: 'uuid' }),
});

const DocumentSummaryResponse = t.Object({
  id: t.Number(),
  projectId: t.Number(),
  parentId: t.Nullable(t.Number()),
  title: t.String(),
  icon: t.Nullable(t.String()),
  metadata: t.Record(t.String(), t.Any()),
  fullWidth: t.Boolean(),
  isPrivate: t.Boolean(),
  isLocked: t.Boolean(),
  isFavorite: t.Boolean(),
  archivedAt: t.Nullable(t.String()),
  position: t.Number(),
  version: t.Number(),
  ownerUserId: t.Nullable(t.String()),
  createdByUserId: t.Nullable(t.String()),
  updatedByUserId: t.Nullable(t.String()),
  createdAt: t.String(),
  updatedAt: t.String(),
});

export const DocumentResponse = t.Composite([
  DocumentSummaryResponse,
  t.Object({
    content: t.String(),
    contentJson: t.Nullable(t.Record(t.String(), t.Any())),
  }),
]);

export const DocumentSummaryListResponse = t.Array(DocumentSummaryResponse);

export const listDocumentsQuery = t.Object({
  q: t.Optional(t.String({ maxLength: 200 })),
  archived: t.Optional(
    t.Union([t.Literal('true'), t.Literal('false')], {
      description: "'true' lists archived pages; the default lists active pages.",
    }),
  ),
});

const documentFields = {
  title: t.Optional(t.String({ maxLength: 255 })),
  content: t.Optional(t.String({ maxLength: 250_000 })),
  contentJson: t.Optional(t.Nullable(t.Record(t.String(), t.Any()))),
  icon: t.Optional(t.Nullable(t.String({ maxLength: 64 }))),
  metadata: t.Optional(t.Record(t.String(), t.Any())),
  fullWidth: t.Optional(t.Boolean()),
};

export const createDocumentBody = t.Object({
  ...documentFields,
  parentId: t.Optional(t.Nullable(t.Integer({ minimum: 1 }))),
  isPrivate: t.Optional(t.Boolean()),
});

export const updateDocumentBody = t.Object({
  version: t.Integer({ minimum: 1 }),
  ...documentFields,
  parentId: t.Optional(t.Nullable(t.Integer({ minimum: 1 }))),
  position: t.Optional(t.Number()),
  previousSiblingId: t.Optional(t.Nullable(t.Integer({ minimum: 1 }))),
  nextSiblingId: t.Optional(t.Nullable(t.Integer({ minimum: 1 }))),
});

export const documentVersionBody = t.Object({
  version: t.Integer({ minimum: 1 }),
});

export const documentAccessBody = t.Object({
  version: t.Integer({ minimum: 1 }),
  isPrivate: t.Boolean(),
});

export const documentOwnershipBody = t.Object({
  version: t.Integer({ minimum: 1 }),
  ownerUserId: t.String({ minLength: 1 }),
});

export const duplicateDocumentBody = t.Object({
  version: t.Integer({ minimum: 1 }),
  title: t.Optional(t.String({ maxLength: 255 })),
  parentId: t.Optional(t.Nullable(t.Integer({ minimum: 1 }))),
});

export const updateDocumentPreferenceBody = t.Object({
  isFavorite: t.Boolean(),
});

export const DocumentPreferenceResponse = t.Object({ isFavorite: t.Boolean() });

export const documentIssueParams = t.Object({
  projectKey: t.String(),
  documentId: t.Numeric(),
  issueId: t.Numeric(),
});

export const issueDocumentsParams = t.Object({
  projectKey: t.String(),
  issueId: t.Numeric(),
});

export const linkDocumentIssueBody = t.Object({
  issueId: t.Integer({ minimum: 1 }),
});

export const documentInitiativeParams = t.Object({
  projectKey: t.String(),
  documentId: t.Numeric(),
  initiativeId: t.Numeric(),
});

export const initiativeDocumentsParams = t.Object({
  projectKey: t.String(),
  initiativeId: t.Numeric(),
});

export const linkDocumentInitiativeBody = t.Object({
  initiativeId: t.Integer({ minimum: 1 }),
});

export const DocumentIssueLinkResponse = t.Object({
  issueId: t.Number(),
  sequenceNumber: t.Number(),
  identifier: t.String(),
  title: t.String(),
  archived: t.Boolean(),
  createdAt: t.String(),
});

export const DocumentIssueLinkListResponse = t.Array(DocumentIssueLinkResponse);

export const IssueDocumentLinkResponse = t.Object({
  documentId: t.Number(),
  title: t.String(),
  icon: t.Nullable(t.String()),
  isPrivate: t.Boolean(),
  archived: t.Boolean(),
  createdAt: t.String(),
});

export const IssueDocumentLinkListResponse = t.Array(IssueDocumentLinkResponse);

const DocumentRevisionSummaryResponse = t.Object({
  id: t.Number(),
  documentId: t.Number(),
  version: t.Number(),
  title: t.String(),
  createdByUserId: t.Nullable(t.String()),
  createdAt: t.String(),
});

export const DocumentRevisionResponse = t.Composite([
  DocumentRevisionSummaryResponse,
  t.Object({
    parentId: t.Nullable(t.Number()),
    content: t.String(),
    contentJson: t.Nullable(t.Record(t.String(), t.Any())),
    icon: t.Nullable(t.String()),
    metadata: t.Record(t.String(), t.Any()),
    fullWidth: t.Boolean(),
    isPrivate: t.Boolean(),
    isLocked: t.Boolean(),
    archivedAt: t.Nullable(t.String()),
    position: t.Number(),
  }),
]);

export const DocumentRevisionListResponse = t.Array(DocumentRevisionSummaryResponse);

export const DocumentExportResponse = t.Object({
  filename: t.String(),
  mimeType: t.Literal('text/markdown'),
  content: t.String(),
  version: t.Number(),
  exportedAt: t.String(),
});

export const uploadDocumentAssetBody = t.Object({ file: t.File() });

export const DocumentAssetResponse = t.Object({
  id: t.String({ format: 'uuid' }),
  filename: t.String(),
  contentType: t.String(),
  sizeBytes: t.Number(),
  uploadedByUserId: t.Nullable(t.String()),
  createdAt: t.String(),
  url: t.String(),
});

export const DocumentAssetListResponse = t.Array(DocumentAssetResponse);

export const deleteDocumentQuery = t.Object({
  version: t.Integer({ minimum: 1 }),
});

export const collaborationOpenBody = t.Object({
  version: t.Integer({ minimum: 1 }),
  contentJson: t.Record(t.String(), t.Any()),
});
export const collaborationQuery = t.Object({
  epoch: t.String({ format: 'uuid' }),
  version: t.Numeric({ minimum: 0 }),
});
export const collaborationSaveBody = t.Object({
  epoch: t.String({ format: 'uuid' }),
  version: t.Integer({ minimum: 0 }),
  clientId: t.String({ minLength: 1, maxLength: 64 }),
  steps: t.Array(t.Record(t.String(), t.Any()), { minItems: 1, maxItems: 1000 }),
  content: t.String({ maxLength: 250_000 }),
});
export const collaborationSessionResponse = t.Object({
  documentId: t.Number(),
  epoch: t.String(),
  version: t.Number(),
  contentJson: t.Record(t.String(), t.Any()),
});
export const collaborationStepsResponse = t.Object({
  epoch: t.String(),
  version: t.Number(),
  documentVersion: t.Number(),
  hasMore: t.Boolean(),
  steps: t.Array(t.Object({ clientId: t.String(), step: t.Record(t.String(), t.Any()) })),
});
export const documentCommentParams = t.Object({
  projectKey: t.String(),
  documentId: t.Numeric(),
  commentId: t.String({ format: 'uuid' }),
});
export const documentCommentBody = t.Object({
  body: t.String({ minLength: 1, maxLength: 10_000 }),
  parentId: t.Optional(t.String({ format: 'uuid' })),
  quote: t.Optional(t.String({ maxLength: 2000 })),
  from: t.Optional(t.Integer({ minimum: 0 })),
  to: t.Optional(t.Integer({ minimum: 1 })),
  version: t.Integer({ minimum: 1 }),
});
export const documentCommentUpdateBody = t.Object({
  body: t.Optional(t.String({ minLength: 1, maxLength: 10_000 })),
  resolved: t.Optional(t.Boolean()),
});
export const documentCommentResponse = t.Object({
  documentVersion: t.Number(),
  id: t.String(),
  documentId: t.Number(),
  parentId: t.Nullable(t.String()),
  authorId: t.Nullable(t.String()),
  authorName: t.Nullable(t.String()),
  body: t.String(),
  quote: t.String(),
  from: t.Nullable(t.Number()),
  to: t.Nullable(t.Number()),
  orphaned: t.Boolean(),
  resolvedAt: t.Nullable(t.String()),
  createdAt: t.String(),
  updatedAt: t.String(),
});
