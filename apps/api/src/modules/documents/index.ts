import { documentCollaborationRoutes } from './collaboration-routes';
import { Elysia, t } from 'elysia';
import { authContext } from '#shared/auth-context';
import { assertPermission, getProjectAccess, requireUser } from '#shared/access';
import { guards } from '#shared/guards';
import { noContent } from '#shared/http';
import { HttpError } from '#shared/lib';
import { mcpImageTool, mcpTool } from '#mcp/generate';
import { commonErrors, errors } from '#shared/responses';
import { importAttachmentBody, rawAttachmentQuery } from '#modules/attachments/model';
import {
  attachmentObjectResponse,
  deleteAttachmentObject,
  readImportedFile,
  safeAttachmentFilename,
  VIEWABLE_IMAGES,
} from '#modules/attachments/storage';
import {
  getChatAttachmentByPublicId,
  readAttachmentBytes,
  viewFile,
} from '#modules/chat-attachments/service';
import {
  createDocumentBody,
  deleteDocumentQuery,
  documentAssetFromChatBody,
  documentAssetParams,
  documentAccessBody,
  documentOwnershipBody,
  documentParams,
  documentRevisionParams,
  DocumentExportResponse,
  DocumentAssetListResponse,
  DocumentAssetResponse,
  DocumentPreferenceResponse,
  DocumentInitiativeLinkListResponse,
  DocumentIssueLinkListResponse,
  DocumentIssueLinkResponse,
  IssueDocumentLinkListResponse,
  IssueDocumentLinkResponse,
  DocumentResponse,
  DocumentRevisionListResponse,
  DocumentRevisionResponse,
  DocumentSummaryListResponse,
  documentVersionBody,
  documentIssueParams,
  duplicateDocumentBody,
  issueDocumentsParams,
  linkDocumentIssueBody,
  documentInitiativeParams,
  initiativeDocumentsParams,
  linkDocumentInitiativeBody,
  listDocumentsQuery,
  updateDocumentBody,
  updateDocumentPreferenceBody,
  uploadDocumentAssetBody,
  ViewDocumentAssetResponse,
} from './model';
import {
  archiveDocument,
  assertDocumentAssetUploadTarget,
  createDocument,
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
  storeDocumentAsset,
  transferDocumentOwnership,
  updateDocument,
  type DocumentAssetRow,
  documentAssetPath,
} from './service';
import {
  addDocumentInitiativeLink,
  addDocumentIssueLink,
  listDocumentInitiativeLinks,
  listDocumentIssueLinks,
  listInitiativeDocumentLinks,
  listIssueDocumentLinks,
  removeDocumentInitiativeLink,
  removeDocumentIssueLink,
} from './links';

function documentAssetDto(
  project: { teamId: number; key: string },
  documentId: number,
  asset: DocumentAssetRow,
) {
  const url = documentAssetPath(project, documentId, asset.publicId);
  return {
    id: asset.publicId,
    filename: asset.filename,
    contentType: asset.contentType,
    sizeBytes: asset.sizeBytes,
    uploadedByUserId: asset.uploadedByUserId,
    createdAt: asset.createdAt,
    url,
    // The web serves a page's files through its own route.
    embedUrl: `/protected-media${url}`,
  };
}

const OWNER_ONLY = 'Only its owner, or a project owner on a public document, can do this.';
const EMBED_HINT =
  'The file shows in the document only after you add `embedUrl` from the result to its ' +
  'text: ![name](embedUrl) for an image, [name](embedUrl) for other files.';

async function isProjectOwner(projectId: number, userId: string): Promise<boolean> {
  return (await getProjectAccess(projectId, userId))?.role === 'owner';
}

export const documentRoutes = new Elysia({
  name: 'documents',
  detail: { tags: ['Documents'] },
})
  .use(authContext)
  .use(guards)
  .use(documentCollaborationRoutes)
  .get(
    '/projects/:projectKey/documents',
    async ({ project, query, user }) =>
      listDocuments(project.id, requireUser(user).id, {
        q: query.q,
        archived: query.archived === 'true',
      }),
    {
      permission: ['documents', 'read'],
      feature: 'documents',
      query: listDocumentsQuery,
      response: { 200: DocumentSummaryListResponse, ...commonErrors },
      detail: {
        summary: "List a project's documents",
        description:
          'List the document tree you can see, without content. q searches the Markdown.',
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
      feature: 'documents',
      params: documentParams,
      response: { 200: DocumentResponse, ...commonErrors },
      detail: {
        summary: 'Get a document',
        description: 'Get a document you can see, with its Markdown content.',
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
      feature: 'documents',
      params: documentParams,
      response: { 200: DocumentIssueLinkListResponse, ...commonErrors },
      detail: {
        summary: 'List work items linked to a document',
        description: 'List the issues linked to a document.',
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
      feature: 'documents',
      params: documentParams,
      body: linkDocumentIssueBody,
      response: { 201: DocumentIssueLinkResponse, ...commonErrors, ...errors(409) },
      detail: {
        summary: 'Link a document to a work item',
        description:
          'Link an active document to an issue in the same project. You need edit access to both.',
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
      feature: 'documents',
      params: documentIssueParams,
      response: { 204: t.Void(), ...commonErrors },
      detail: {
        summary: 'Unlink a document from a work item',
        description: 'Remove a link between a document and an issue.',
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
      feature: 'documents',
      params: issueDocumentsParams,
      response: { 200: IssueDocumentLinkListResponse, ...commonErrors },
      detail: {
        summary: 'List Docs linked to a work item',
        description: 'List the documents linked to an issue that you can see.',
        ...mcpTool('list_issue_documents'),
      },
    },
  )
  .get(
    '/projects/:projectKey/documents/for-initiative/:initiativeId',
    async ({ project, params, user }) => {
      const current = requireUser(user);
      await assertPermission(project.id, current, 'documents', 'read');
      const links = await listInitiativeDocumentLinks(project.id, params.initiativeId, current.id);
      if (!links) throw new HttpError(404, 'Initiative not found');
      return links;
    },
    {
      permission: ['initiatives', 'read'],
      feature: ['initiatives', 'documents'],
      params: initiativeDocumentsParams,
      response: { 200: IssueDocumentLinkListResponse, ...commonErrors },
      detail: {
        summary: 'List Docs linked to an initiative',
        description: 'List the documents linked to an initiative that you can see.',
        ...mcpTool('list_initiative_documents'),
      },
    },
  )
  .get(
    '/projects/:projectKey/documents/:documentId/initiatives',
    async ({ project, params, user }) => {
      const current = requireUser(user);
      await assertPermission(project.id, current, 'initiatives', 'read');
      const links = await listDocumentInitiativeLinks(project.id, params.documentId, current.id);
      if (!links) throw new HttpError(404, 'Document not found');
      return links;
    },
    {
      permission: ['documents', 'read'],
      feature: ['initiatives', 'documents'],
      params: documentParams,
      response: { 200: DocumentInitiativeLinkListResponse, ...commonErrors },
      detail: {
        summary: 'List initiatives linked to a document',
        description: 'List the initiatives linked to a document.',
        ...mcpTool('list_document_initiatives'),
      },
    },
  )
  .post(
    '/projects/:projectKey/documents/:documentId/initiatives',
    async ({ project, params, body, user, set }) => {
      const current = requireUser(user);
      await assertPermission(project.id, current, 'initiatives', 'edit');
      const link = await addDocumentInitiativeLink({
        projectId: project.id,
        documentId: params.documentId,
        initiativeId: body.initiativeId,
        userId: current.id,
      });
      set.status = 201;
      return link;
    },
    {
      permission: ['documents', 'edit'],
      feature: ['initiatives', 'documents'],
      params: documentParams,
      body: linkDocumentInitiativeBody,
      response: { 201: IssueDocumentLinkResponse, ...commonErrors, ...errors(409) },
      detail: {
        summary: 'Link a document to an initiative',
        description:
          'Link an active document to an initiative in ' +
          'the same project. You need edit access to both.',
        ...mcpTool('link_document_initiative'),
      },
    },
  )
  .delete(
    '/projects/:projectKey/documents/:documentId/initiatives/:initiativeId',
    async ({ project, params, user }) => {
      const current = requireUser(user);
      await assertPermission(project.id, current, 'initiatives', 'edit');
      const removed = await removeDocumentInitiativeLink({
        projectId: project.id,
        documentId: params.documentId,
        initiativeId: params.initiativeId,
        userId: current.id,
      });
      if (!removed) throw new HttpError(404, 'Document link not found');
      return noContent();
    },
    {
      permission: ['documents', 'edit'],
      feature: ['initiatives', 'documents'],
      params: documentInitiativeParams,
      response: { 204: t.Void(), ...commonErrors },
      detail: {
        summary: 'Unlink a document from an initiative',
        description: 'Remove a link between a document and an initiative.',
        ...mcpTool('unlink_document_initiative'),
      },
    },
  )
  .get(
    '/projects/:projectKey/documents/:documentId/assets',
    async ({ project, params, user }) => {
      const assets = await listDocumentAssets(project.id, params.documentId, requireUser(user).id);
      if (!assets) throw new HttpError(404, 'Document not found');
      return assets.map((asset) => documentAssetDto(project, params.documentId, asset));
    },
    {
      permission: ['documents', 'read'],
      feature: 'documents',
      params: documentParams,
      response: { 200: DocumentAssetListResponse, ...commonErrors },
      detail: {
        summary: 'List document assets',
        description:
          "List a document's files. Open a file with " +
          'view_document_asset, because `url` needs a browser session.',
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
      const asset = await storeDocumentAsset({
        projectId: project.id,
        documentId: params.documentId,
        userId,
        filename: safeAttachmentFilename(file.name),
        contentType: file.type || 'application/octet-stream',
        bytes: Buffer.from(await file.arrayBuffer()),
      });
      set.status = 201;
      return documentAssetDto(project, params.documentId, asset);
    },
    {
      permission: ['documents', 'edit'],
      feature: 'documents',
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
  .post(
    '/projects/:projectKey/documents/:documentId/assets/import',
    async ({ project, params, user, body, set }) => {
      const userId = requireUser(user).id;
      if (!(await assertDocumentAssetUploadTarget(project.id, params.documentId, userId))) {
        throw new HttpError(404, 'Document not found');
      }
      const { bytes, contentType } = await readImportedFile(body);
      const asset = await storeDocumentAsset({
        projectId: project.id,
        documentId: params.documentId,
        userId,
        filename: safeAttachmentFilename(body.filename),
        contentType,
        bytes,
      });
      set.status = 201;
      return documentAssetDto(project, params.documentId, asset);
    },
    {
      permission: ['documents', 'edit'],
      feature: 'documents',
      params: documentParams,
      body: importAttachmentBody,
      response: { 201: DocumentAssetResponse, ...commonErrors, ...errors(409, 413, 502) },
      detail: {
        summary: 'Add a document asset from a URL or base64',
        description: `Store a file for an active, unlocked document, from \`url\` or \`contentBase64\`. ${EMBED_HINT}`,
        ...mcpTool('add_document_asset'),
      },
    },
  )
  .post(
    '/projects/:projectKey/documents/:documentId/assets/from-chat',
    async ({ project, params, user, body, set }) => {
      const current = requireUser(user);
      await assertPermission(project.id, current, 'ai_agents', 'read');
      if (!(await assertDocumentAssetUploadTarget(project.id, params.documentId, current.id))) {
        throw new HttpError(404, 'Document not found');
      }
      const source = await getChatAttachmentByPublicId(body.chatAttachmentId);
      if (source?.projectId !== project.id) throw new HttpError(404, 'Attachment not found');
      const asset = await storeDocumentAsset({
        projectId: project.id,
        documentId: params.documentId,
        userId: current.id,
        filename: source.filename,
        contentType: source.contentType,
        bytes: await readAttachmentBytes(source.s3Key),
      });
      set.status = 201;
      return documentAssetDto(project, params.documentId, asset);
    },
    {
      permission: ['documents', 'edit'],
      feature: 'documents',
      params: documentParams,
      body: documentAssetFromChatBody,
      response: { 201: DocumentAssetResponse, ...commonErrors, ...errors(409, 413, 502) },
      detail: {
        summary: 'Copy a chat attachment into a document',
        description: `Copy a file attached in this project's chat into an active, unlocked document. Get the id from the [file: "name" (attachment id: …)] marker. The chat keeps its copy. ${EMBED_HINT}`,
        ...mcpTool('add_document_asset_from_chat'),
      },
    },
  )
  .get(
    '/projects/:projectKey/documents/:documentId/assets/:publicId/view',
    async ({ project, params, user }) => {
      const asset = await getDocumentAsset(
        project.id,
        params.documentId,
        params.publicId,
        requireUser(user).id,
      );
      if (!asset) throw new HttpError(404, 'Asset not found');
      return viewFile(asset, documentAssetDto(project, params.documentId, asset));
    },
    {
      permission: ['documents', 'read'],
      feature: 'documents',
      params: documentAssetParams,
      response: { 200: ViewDocumentAssetResponse, ...commonErrors, ...errors(502) },
      detail: {
        summary: 'View a document asset',
        description:
          `Open one file of a document. An image comes back as the image (${VIEWABLE_IMAGES}). ` +
          'Other files come back in `others`, plus the full text of a PDF or text file, or the ' +
          'column headers and first rows of a .xlsx, .csv or .docx file.',
        ...mcpImageTool('view_document_asset'),
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
      return attachmentObjectResponse({
        s3Key: asset.s3Key,
        contentType: asset.contentType,
        filename: asset.filename,
        request,
        download: query.download != null,
      });
    },
    {
      permission: ['documents', 'read'],
      feature: 'documents',
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
      feature: 'documents',
      params: documentAssetParams,
      response: { 204: t.Void(), ...commonErrors, ...errors(409) },
      detail: {
        summary: 'Delete a document asset',
        description: `Permanently delete a file from an active, unlocked document. The document text keeps its reference: remove it with update_document. ${OWNER_ONLY}`,
        ...mcpTool('delete_document_asset'),
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
      feature: 'documents',
      params: documentParams,
      response: { 200: DocumentExportResponse, ...commonErrors },
      detail: {
        summary: 'Export a document',
        description:
          'Export a document: a stable filename, the Markdown body and version metadata.',
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
      feature: 'documents',
      params: documentParams,
      response: { 200: DocumentRevisionListResponse, ...commonErrors },
      detail: {
        summary: 'List document revisions',
        description: "List a document's past versions, newest first.",
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
      feature: 'documents',
      params: documentRevisionParams,
      response: { 200: DocumentRevisionResponse, ...commonErrors },
      detail: {
        summary: 'Get a document revision',
        description: 'Get the Markdown of one past version of a document.',
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
      feature: 'documents',
      body: createDocumentBody,
      response: { 201: DocumentResponse, ...commonErrors },
      detail: {
        summary: 'Create a document',
        description:
          'Create a public or private Markdown document, optionally under a parent document.',
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
      feature: 'documents',
      params: documentParams,
      body: updateDocumentBody,
      response: { 200: DocumentResponse, ...commonErrors, ...errors(409) },
      detail: {
        summary: 'Update a document',
        description:
          "Update a document's Markdown, appearance, parent or position. Send the last version " +
          'you read. A stale version or a locked document returns 409.',
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
      feature: 'documents',
      params: documentParams,
      body: documentAccessBody,
      response: { 200: DocumentResponse, ...commonErrors, ...errors(409) },
      detail: {
        summary: 'Change document access',
        description:
          'Make a document public to the project or private to you. Only its owner can do this. ' +
          'A project owner must first claim an orphaned ' +
          'public document with transfer_document_ownership.',
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
      feature: 'documents',
      params: documentParams,
      body: documentOwnershipBody,
      response: { 200: DocumentResponse, ...commonErrors, ...errors(409) },
      detail: {
        summary: 'Transfer document ownership',
        description:
          'Give a document to another project member. A project owner can claim or transfer a ' +
          'public document whose owner left the project.',
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
      feature: 'documents',
      params: documentParams,
      body: documentVersionBody,
      response: { 200: DocumentResponse, ...commonErrors, ...errors(409) },
      detail: {
        summary: 'Lock a document',
        description: `Lock a document against changes. ${OWNER_ONLY}`,
        ...mcpTool('lock_document'),
      },
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
      feature: 'documents',
      params: documentParams,
      body: documentVersionBody,
      response: { 200: DocumentResponse, ...commonErrors, ...errors(409) },
      detail: {
        summary: 'Unlock a document',
        description: `Unlock a document so it can be changed. ${OWNER_ONLY}`,
        ...mcpTool('unlock_document'),
      },
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
      feature: 'documents',
      params: documentParams,
      body: documentVersionBody,
      response: { 200: DocumentResponse, ...commonErrors, ...errors(409) },
      detail: {
        summary: 'Archive a document tree',
        description: `Archive a document and its descendants. Content and history are kept. ${OWNER_ONLY}`,
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
      feature: 'documents',
      params: documentParams,
      body: documentVersionBody,
      response: { 200: DocumentResponse, ...commonErrors, ...errors(409) },
      detail: {
        summary: 'Restore a document tree',
        description: `Restore an archived document and its descendants. If its parent is still archived, it moves to the root. ${OWNER_ONLY}`,
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
      feature: 'documents',
      params: documentParams,
      body: duplicateDocumentBody,
      response: { 201: DocumentResponse, ...commonErrors, ...errors(409, 413, 502) },
      detail: {
        summary: 'Duplicate a document',
        description: 'Copy a document and its appearance into a new document that you own.',
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
      feature: 'documents',
      params: documentParams,
      body: updateDocumentPreferenceBody,
      response: { 200: DocumentPreferenceResponse, ...commonErrors },
      detail: {
        summary: 'Update document preferences',
        description: 'Add a document to your favorites or remove it.',
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
      feature: 'documents',
      params: documentRevisionParams,
      body: documentVersionBody,
      response: { 200: DocumentResponse, ...commonErrors, ...errors(409) },
      detail: {
        summary: 'Restore a document revision',
        description: 'Restore a past version as a new current version. History does not change.',
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
      feature: 'documents',
      params: documentParams,
      query: deleteDocumentQuery,
      response: { 204: t.Void(), ...commonErrors, ...errors(409) },
      detail: {
        summary: 'Delete a document',
        description: `Permanently delete an archived document and its history. Its child documents move to the project root. ${OWNER_ONLY}`,
        ...mcpTool('delete_document'),
      },
    },
  );
