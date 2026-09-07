import { Elysia, t } from 'elysia';
import { authContext } from '#shared/auth-context';
import { assertPermission, requireUser } from '#shared/access';
import { guards } from '#shared/guards';
import { noContent } from '#shared/http';
import { HttpError } from '#shared/lib';
import { getObject } from '#shared/s3';
import { mcpTool } from '#mcp/generate';
import { commonErrors, errors } from '#shared/responses';
import { getMembership } from '#modules/members/service';
import { rawAttachmentQuery } from '#modules/attachments/model';
import {
  assertAttachmentUploadAllowed,
  attachmentEtag,
  attachmentObjectKey,
  attachmentResponseHeaders,
  deleteAttachmentObject,
  safeAttachmentFilename,
  storeAttachmentObject,
} from '#modules/attachments/storage';
import {
  createDocumentBody,
  deleteDocumentQuery,
  documentAssetParams,
  documentAccessBody,
  documentOwnershipBody,
  documentParams,
  documentRevisionParams,
  DocumentExportResponse,
  DocumentAssetListResponse,
  DocumentAssetResponse,
  DocumentPreferenceResponse,
  DocumentIssueLinkListResponse,
  DocumentIssueLinkResponse,
  IssueDocumentLinkListResponse,
  DocumentResponse,
  DocumentRevisionListResponse,
  DocumentRevisionResponse,
  DocumentSummaryListResponse,
  documentVersionBody,
  documentIssueParams,
  duplicateDocumentBody,
  issueDocumentsParams,
  linkDocumentIssueBody,
  listDocumentsQuery,
  updateDocumentBody,
  updateDocumentPreferenceBody,
  uploadDocumentAssetBody,
} from './model';
import {
  archiveDocument,
  assertDocumentAssetUploadTarget,
  createDocument,
  createDocumentAsset,
  deleteDocument,
  deleteDocumentAsset,
  duplicateDocument,
  exportDocument,
  getDocument,
  getDocumentAsset,
  getDocumentRevision,
  listDocumentRevisions,
  listDocumentAssets,
  listDocuments,
  restoreDocument,
  restoreDocumentRevision,
  setDocumentAccess,
  setDocumentLocked,
  setDocumentPreference,
  transferDocumentOwnership,
  updateDocument,
  type DocumentAssetRow,
} from './service';
import {
  addDocumentIssueLink,
  listDocumentIssueLinks,
  listIssueDocumentLinks,
  removeDocumentIssueLink,
} from './issue-links';

function documentAssetDto(projectKey: string, documentId: number, asset: DocumentAssetRow) {
  return {
    id: asset.publicId,
    filename: asset.filename,
    contentType: asset.contentType,
    sizeBytes: asset.sizeBytes,
    uploadedByUserId: asset.uploadedByUserId,
    createdAt: asset.createdAt,
    url: `/projects/${encodeURIComponent(projectKey)}/documents/${documentId}/assets/${asset.publicId}/raw`,
  };
}

async function isProjectOwner(projectId: number, userId: string): Promise<boolean> {
  return (await getMembership(projectId, userId)) === 'owner';
}

export const documentRoutes = new Elysia({
  name: 'documents',
  detail: { tags: ['Documents'] },
})
  .use(authContext)
  .use(guards)
  .get(
    '/projects/:projectKey/documents',
    async ({ project, query, user }) =>
      listDocuments(project.id, requireUser(user).id, {
        q: query.q,
        archived: query.archived === 'true',
      }),
    {
      permission: ['documents', 'read'],
      query: listDocumentsQuery,
      response: { 200: DocumentSummaryListResponse, ...commonErrors },
      detail: {
        summary: "List a project's documents",
        description:
          'Return the visible Docs tree without document bodies. Use q to search Markdown and archived=true for the archive.',
        ...mcpTool('list_documents'),
      },
    },
  )
  .get(
    '/projects/:projectKey/documents/:documentId',
    async ({ project, params, user }) => {
      const document = await getDocument(project.id, params.documentId, requireUser(user).id);
      if (!document) throw new HttpError(404, 'Document not found');
      return document;
    },
    {
      permission: ['documents', 'read'],
      params: documentParams,
      response: { 200: DocumentResponse, ...commonErrors },
      detail: {
        summary: 'Get a document',
        description: 'Return one visible project document with its Markdown content.',
        ...mcpTool('get_document'),
      },
    },
  )
  .get(
    '/projects/:projectKey/documents/:documentId/issues',
    async ({ project, params, user }) => {
      const current = requireUser(user);
      await assertPermission(project.id, current, 'work_items', 'read');
      const links = await listDocumentIssueLinks(
        project.id,
        project.key,
        params.documentId,
        current.id,
      );
      if (!links) throw new HttpError(404, 'Document not found');
      return links;
    },
    {
      permission: ['documents', 'read'],
      params: documentParams,
      response: { 200: DocumentIssueLinkListResponse, ...commonErrors },
      detail: {
        summary: 'List work items linked to a document',
        description: 'Return work items explicitly linked to one visible Docs page.',
        ...mcpTool('list_document_issues'),
      },
    },
  )
  .post(
    '/projects/:projectKey/documents/:documentId/issues',
    async ({ project, params, body, user, set }) => {
      const current = requireUser(user);
      await assertPermission(project.id, current, 'work_items', 'edit');
      const link = await addDocumentIssueLink({
        projectId: project.id,
        projectKey: project.key,
        documentId: params.documentId,
        issueId: body.issueId,
        userId: current.id,
      });
      set.status = 201;
      return link;
    },
    {
      permission: ['documents', 'edit'],
      params: documentParams,
      body: linkDocumentIssueBody,
      response: { 201: DocumentIssueLinkResponse, ...commonErrors, ...errors(409) },
      detail: {
        summary: 'Link a document to a work item',
        description:
          'Link one active Docs page to a work item in the same project. Editing both resources is required.',
        ...mcpTool('link_document_issue'),
      },
    },
  )
  .delete(
    '/projects/:projectKey/documents/:documentId/issues/:issueId',
    async ({ project, params, user }) => {
      const current = requireUser(user);
      await assertPermission(project.id, current, 'work_items', 'edit');
      const removed = await removeDocumentIssueLink({
        projectId: project.id,
        documentId: params.documentId,
        issueId: params.issueId,
        userId: current.id,
      });
      if (!removed) throw new HttpError(404, 'Document link not found');
      return noContent();
    },
    {
      permission: ['documents', 'edit'],
      params: documentIssueParams,
      response: { 204: t.Void(), ...commonErrors },
      detail: {
        summary: 'Unlink a document from a work item',
        description: 'Remove an explicit Docs-to-work-item link.',
        ...mcpTool('unlink_document_issue'),
      },
    },
  )
  .get(
    '/projects/:projectKey/documents/for-issue/:issueId',
    async ({ project, params, user }) => {
      const current = requireUser(user);
      await assertPermission(project.id, current, 'documents', 'read');
      const links = await listIssueDocumentLinks(project.id, params.issueId, current.id);
      if (!links) throw new HttpError(404, 'Issue not found');
      return links;
    },
    {
      permission: ['work_items', 'read'],
      params: issueDocumentsParams,
      response: { 200: IssueDocumentLinkListResponse, ...commonErrors },
      detail: {
        summary: 'List Docs linked to a work item',
        description: 'Return visible Docs pages explicitly linked to one work item.',
        ...mcpTool('list_issue_documents'),
      },
    },
  )
  .get(
    '/projects/:projectKey/documents/:documentId/assets',
    async ({ project, params, user }) => {
      const assets = await listDocumentAssets(project.id, params.documentId, requireUser(user).id);
      if (!assets) throw new HttpError(404, 'Document not found');
      return assets.map((asset) => documentAssetDto(project.key, params.documentId, asset));
    },
    {
      permission: ['documents', 'read'],
      params: documentParams,
      response: { 200: DocumentAssetListResponse, ...commonErrors },
      detail: {
        summary: 'List document assets',
        description: 'List files embedded in a visible Docs page.',
        ...mcpTool('list_document_assets'),
      },
    },
  )
  .post(
    '/projects/:projectKey/documents/:documentId/assets',
    async ({ project, params, user, body, set }) => {
      const userId = requireUser(user).id;
      if (!(await assertDocumentAssetUploadTarget(project.id, params.documentId, userId))) {
        throw new HttpError(404, 'Document not found');
      }
      const file = body.file;
      if (!(file instanceof File) || file.size === 0) throw new HttpError(400, 'File is empty');
      const filename = safeAttachmentFilename(file.name);
      const contentType = file.type || 'application/octet-stream';
      await assertAttachmentUploadAllowed(project.id, file.size, contentType);
      const key = attachmentObjectKey(project.id, 'documents', params.documentId, filename);
      const bytes = Buffer.from(await file.arrayBuffer());
      await storeAttachmentObject(key, bytes, contentType);
      try {
        const asset = await createDocumentAsset({
          projectId: project.id,
          documentId: params.documentId,
          userId,
          s3Key: key,
          filename,
          contentType,
          sizeBytes: bytes.length,
        });
        if (!asset) throw new HttpError(404, 'Document not found');
        set.status = 201;
        return documentAssetDto(project.key, params.documentId, asset);
      } catch (error) {
        await deleteAttachmentObject(key);
        throw error;
      }
    },
    {
      permission: ['documents', 'edit'],
      params: documentParams,
      body: uploadDocumentAssetBody,
      response: { 201: DocumentAssetResponse, ...commonErrors, ...errors(409, 413, 502) },
      detail: {
        summary: 'Upload a document asset',
        description:
          'Store a file for an active, unlocked Docs page. Instance MIME, file-size and project-quota limits apply.',
      },
    },
  )
  .get(
    '/projects/:projectKey/documents/:documentId/assets/:publicId/raw',
    async ({ project, params, query, request, user }) => {
      const asset = await getDocumentAsset(
        project.id,
        params.documentId,
        params.publicId,
        requireUser(user).id,
      );
      if (!asset) throw new HttpError(404, 'Asset not found');
      const etag = attachmentEtag(asset.s3Key);
      if (request.headers.get('if-none-match') === etag) {
        return new Response(null, { status: 304, headers: { ETag: etag } });
      }
      let object;
      try {
        object = await getObject(asset.s3Key);
      } catch (error) {
        throw new HttpError(404, error instanceof Error ? error.message : 'Asset not found');
      }
      return new Response(object.body, {
        headers: attachmentResponseHeaders({
          contentType: asset.contentType || object.contentType,
          filename: asset.filename,
          contentLength: object.contentLength,
          etag,
          download: query.download != null,
        }),
      });
    },
    {
      permission: ['documents', 'read'],
      params: documentAssetParams,
      query: rawAttachmentQuery,
      response: { ...commonErrors },
      detail: {
        summary: 'Download a document asset',
        description: 'Download an asset after re-checking current project and private-page access.',
      },
    },
  )
  .delete(
    '/projects/:projectKey/documents/:documentId/assets/:publicId',
    async ({ project, params, user }) => {
      const userId = requireUser(user).id;
      const asset = await deleteDocumentAsset(
        project.id,
        params.documentId,
        params.publicId,
        userId,
        await isProjectOwner(project.id, userId),
      );
      if (!asset) throw new HttpError(404, 'Asset not found');
      await deleteAttachmentObject(asset.s3Key);
      return noContent();
    },
    {
      permission: ['documents', 'delete'],
      params: documentAssetParams,
      response: { 204: t.Void(), ...commonErrors, ...errors(409) },
      detail: {
        summary: 'Delete a document asset',
        description: 'Delete one asset from an active, unlocked Docs page.',
      },
    },
  )
  .get(
    '/projects/:projectKey/documents/:documentId/export',
    async ({ project, params, user }) => {
      const exported = await exportDocument(project.id, params.documentId, requireUser(user).id);
      if (!exported) throw new HttpError(404, 'Document not found');
      return exported;
    },
    {
      permission: ['documents', 'read'],
      params: documentParams,
      response: { 200: DocumentExportResponse, ...commonErrors },
      detail: {
        summary: 'Export a document',
        description: 'Return stable filename, Markdown body and version metadata for export tools.',
        ...mcpTool('export_document'),
      },
    },
  )
  .get(
    '/projects/:projectKey/documents/:documentId/revisions',
    async ({ project, params, user }) => {
      const revisions = await listDocumentRevisions(
        project.id,
        params.documentId,
        requireUser(user).id,
      );
      if (!revisions) throw new HttpError(404, 'Document not found');
      return revisions;
    },
    {
      permission: ['documents', 'read'],
      params: documentParams,
      response: { 200: DocumentRevisionListResponse, ...commonErrors },
      detail: {
        summary: 'List document revisions',
        description: 'Return immutable document versions, newest first.',
        ...mcpTool('list_document_revisions'),
      },
    },
  )
  .get(
    '/projects/:projectKey/documents/:documentId/revisions/:revisionId',
    async ({ project, params, user }) => {
      const revision = await getDocumentRevision(
        project.id,
        params.documentId,
        params.revisionId,
        requireUser(user).id,
      );
      if (!revision) throw new HttpError(404, 'Document revision not found');
      return revision;
    },
    {
      permission: ['documents', 'read'],
      params: documentRevisionParams,
      response: { 200: DocumentRevisionResponse, ...commonErrors },
      detail: {
        summary: 'Get a document revision',
        description: 'Return one historical Markdown snapshot.',
        ...mcpTool('get_document_revision'),
      },
    },
  )
  .post(
    '/projects/:projectKey/documents',
    async ({ project, user, body, set }) => {
      set.status = 201;
      return createDocument({
        projectId: project.id,
        userId: requireUser(user).id,
        title: body.title,
        content: body.content,
        contentJson: body.contentJson,
        icon: body.icon,
        metadata: body.metadata,
        fullWidth: body.fullWidth,
        isPrivate: body.isPrivate,
        parentId: body.parentId,
      });
    },
    {
      permission: ['documents', 'create'],
      body: createDocumentBody,
      response: { 201: DocumentResponse, ...commonErrors },
      detail: {
        summary: 'Create a document',
        description:
          'Create a public or private Markdown page, optionally nested under another page.',
        ...mcpTool('create_document'),
      },
    },
  )
  .patch(
    '/projects/:projectKey/documents/:documentId',
    async ({ project, user, params, body }) => {
      const document = await updateDocument(
        project.id,
        params.documentId,
        requireUser(user).id,
        body,
      );
      if (!document) throw new HttpError(404, 'Document not found');
      return document;
    },
    {
      permission: ['documents', 'edit'],
      params: documentParams,
      body: updateDocumentBody,
      response: { 200: DocumentResponse, ...commonErrors, ...errors(409) },
      detail: {
        summary: 'Update a document',
        description:
          'Update Markdown, appearance, nesting or position. Send the version last read; a stale or locked page returns 409.',
        ...mcpTool('update_document'),
      },
    },
  )
  .post(
    '/projects/:projectKey/documents/:documentId/access',
    async ({ project, user, params, body }) => {
      const userId = requireUser(user).id;
      const document = await setDocumentAccess(
        project.id,
        params.documentId,
        userId,
        body.version,
        body.isPrivate,
      );
      if (!document) throw new HttpError(404, 'Document not found');
      return document;
    },
    {
      permission: ['documents', 'edit'],
      params: documentParams,
      body: documentAccessBody,
      response: { 200: DocumentResponse, ...commonErrors, ...errors(409) },
      detail: {
        summary: 'Change document access',
        description:
          'The document owner can make a page public to the project or private to themselves. A project owner must explicitly claim an orphaned public page first.',
        ...mcpTool('set_document_access'),
      },
    },
  )
  .post(
    '/projects/:projectKey/documents/:documentId/ownership',
    async ({ project, user, params, body }) => {
      const userId = requireUser(user).id;
      const document = await transferDocumentOwnership(
        project.id,
        params.documentId,
        userId,
        body.version,
        body.ownerUserId,
        await isProjectOwner(project.id, userId),
      );
      if (!document) throw new HttpError(404, 'Document not found');
      return document;
    },
    {
      permission: ['documents', 'edit'],
      params: documentParams,
      body: documentOwnershipBody,
      response: { 200: DocumentResponse, ...commonErrors, ...errors(409) },
      detail: {
        summary: 'Transfer document ownership',
        description:
          'Transfer a page to another project member. A project owner can claim or transfer a public page whose previous owner left the project.',
        ...mcpTool('transfer_document_ownership'),
      },
    },
  )
  .post(
    '/projects/:projectKey/documents/:documentId/lock',
    async ({ project, user, params, body }) => {
      const userId = requireUser(user).id;
      const document = await setDocumentLocked(
        project.id,
        params.documentId,
        userId,
        body.version,
        true,
        await isProjectOwner(project.id, userId),
      );
      if (!document) throw new HttpError(404, 'Document not found');
      return document;
    },
    {
      permission: ['documents', 'edit'],
      params: documentParams,
      body: documentVersionBody,
      response: { 200: DocumentResponse, ...commonErrors, ...errors(409) },
      detail: { summary: 'Lock a document', ...mcpTool('lock_document') },
    },
  )
  .post(
    '/projects/:projectKey/documents/:documentId/unlock',
    async ({ project, user, params, body }) => {
      const userId = requireUser(user).id;
      const document = await setDocumentLocked(
        project.id,
        params.documentId,
        userId,
        body.version,
        false,
        await isProjectOwner(project.id, userId),
      );
      if (!document) throw new HttpError(404, 'Document not found');
      return document;
    },
    {
      permission: ['documents', 'edit'],
      params: documentParams,
      body: documentVersionBody,
      response: { 200: DocumentResponse, ...commonErrors, ...errors(409) },
      detail: { summary: 'Unlock a document', ...mcpTool('unlock_document') },
    },
  )
  .post(
    '/projects/:projectKey/documents/:documentId/archive',
    async ({ project, user, params, body }) => {
      const userId = requireUser(user).id;
      const document = await archiveDocument(
        project.id,
        params.documentId,
        userId,
        body.version,
        await isProjectOwner(project.id, userId),
      );
      if (!document) throw new HttpError(404, 'Document not found');
      return document;
    },
    {
      permission: ['documents', 'delete'],
      params: documentParams,
      body: documentVersionBody,
      response: { 200: DocumentResponse, ...commonErrors, ...errors(409) },
      detail: {
        summary: 'Archive a document tree',
        description:
          'Archive a page and all descendants without deleting their content or history.',
        ...mcpTool('archive_document'),
      },
    },
  )
  .post(
    '/projects/:projectKey/documents/:documentId/restore',
    async ({ project, user, params, body }) => {
      const userId = requireUser(user).id;
      const document = await restoreDocument(
        project.id,
        params.documentId,
        userId,
        body.version,
        await isProjectOwner(project.id, userId),
      );
      if (!document) throw new HttpError(404, 'Document not found');
      return document;
    },
    {
      permission: ['documents', 'delete'],
      params: documentParams,
      body: documentVersionBody,
      response: { 200: DocumentResponse, ...commonErrors, ...errors(409) },
      detail: {
        summary: 'Restore a document tree',
        description:
          'Restore an archived page and its descendants. It returns to the root if its parent remains archived.',
        ...mcpTool('restore_document'),
      },
    },
  )
  .post(
    '/projects/:projectKey/documents/:documentId/duplicate',
    async ({ project, user, params, body, set }) => {
      const document = await duplicateDocument({
        projectId: project.id,
        documentId: params.documentId,
        userId: requireUser(user).id,
        version: body.version,
        title: body.title,
        parentId: body.parentId,
      });
      if (!document) throw new HttpError(404, 'Document not found');
      set.status = 201;
      return document;
    },
    {
      permission: ['documents', 'create'],
      params: documentParams,
      body: duplicateDocumentBody,
      response: { 201: DocumentResponse, ...commonErrors, ...errors(409, 413, 502) },
      detail: {
        summary: 'Duplicate a document',
        description:
          'Copy one visible page and its appearance into a new page owned by the caller.',
        ...mcpTool('duplicate_document'),
      },
    },
  )
  .patch(
    '/projects/:projectKey/documents/:documentId/preferences',
    async ({ project, user, params, body }) => {
      const preference = await setDocumentPreference(
        project.id,
        params.documentId,
        requireUser(user).id,
        body.isFavorite,
      );
      if (!preference) throw new HttpError(404, 'Document not found');
      return preference;
    },
    {
      permission: ['documents', 'read'],
      params: documentParams,
      body: updateDocumentPreferenceBody,
      response: { 200: DocumentPreferenceResponse, ...commonErrors },
      detail: {
        summary: 'Update document preferences',
        description: 'Favorite or unfavorite a page for the current user.',
        ...mcpTool('set_document_preference'),
      },
    },
  )
  .post(
    '/projects/:projectKey/documents/:documentId/revisions/:revisionId/restore',
    async ({ project, user, params, body }) => {
      const document = await restoreDocumentRevision(
        project.id,
        params.documentId,
        params.revisionId,
        requireUser(user).id,
        body.version,
      );
      if (!document) throw new HttpError(404, 'Document not found');
      return document;
    },
    {
      permission: ['documents', 'edit'],
      params: documentRevisionParams,
      body: documentVersionBody,
      response: { 200: DocumentResponse, ...commonErrors, ...errors(409) },
      detail: {
        summary: 'Restore a document revision',
        description:
          'Copy a historical snapshot into a new current version without rewriting history.',
        ...mcpTool('restore_document_revision'),
      },
    },
  )
  .delete(
    '/projects/:projectKey/documents/:documentId',
    async ({ project, params, query, user }) => {
      const userId = requireUser(user).id;
      const assetKeys = await deleteDocument(
        project.id,
        params.documentId,
        userId,
        query.version,
        await isProjectOwner(project.id, userId),
      );
      if (!assetKeys) {
        throw new HttpError(404, 'Document not found');
      }
      await Promise.all(assetKeys.map(deleteAttachmentObject));
      return noContent();
    },
    {
      permission: ['documents', 'delete'],
      params: documentParams,
      query: deleteDocumentQuery,
      response: { 204: t.Void(), ...commonErrors, ...errors(409) },
      detail: {
        summary: 'Delete a document',
        description:
          'Permanently delete an archived document and its history. Its child pages move to the project root.',
        ...mcpTool('delete_document'),
      },
    },
  );
