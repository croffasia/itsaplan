import { Elysia, t } from 'elysia';
import { authContext } from '#shared/auth-context';
import { guards } from '#shared/guards';
import { requireUser } from '#shared/access';
import { accessErrors, commonErrors, errors } from '#shared/responses';
import { mcpTool } from '#mcp/generate';
import { openDocumentSession, getDocumentSteps, saveDocumentSteps } from './collaboration';
import {
  addDocumentComment,
  listDocumentComments,
  listDocumentThreadsForUser,
  updateDocumentComment,
} from './comments';
import {
  collaborationQuery,
  collaborationSaveBody,
  collaborationSessionResponse,
  collaborationStepsResponse,
  documentParams,
  DocumentResponse,
  documentCommentParams,
  documentCommentBody,
  documentCommentUpdateBody,
  documentCommentResponse,
  documentThreadForYouResponse,
} from './model';

export const documentCollaborationRoutes = new Elysia({
  name: 'document-collaboration',
  detail: { tags: ['Documents'] },
})
  .use(authContext)
  .use(guards)
  .get(
    '/projects/:projectKey/documents/for-you',
    ({ project, user }) => listDocumentThreadsForUser(project.id, requireUser(user).id),
    {
      permission: ['documents', 'read'],
      feature: 'documents',
      response: { 200: t.Array(documentThreadForYouResponse), ...accessErrors },
      detail: {
        summary: 'List comment threads that wait for you',
        description:
          'Open threads on live pages you can open where the last message is someone ' +
          "else's and the thread mentions you or you wrote in it. Newest first.",
      },
    },
  )
  .post(
    '/projects/:projectKey/documents/:documentId/session',
    ({ project, params, user }) =>
      openDocumentSession(project.id, params.documentId, requireUser(user).id),
    {
      permission: ['documents', 'edit'],
      feature: 'documents',
      params: documentParams,
      response: { 200: collaborationSessionResponse, ...commonErrors, ...errors(409) },
      detail: { summary: 'Join a collaborative document session' },
    },
  )
  .get(
    '/projects/:projectKey/documents/:documentId/steps',
    ({ project, params, user, query }) =>
      getDocumentSteps(
        project.id,
        params.documentId,
        requireUser(user).id,
        query.epoch,
        query.version,
      ),
    {
      permission: ['documents', 'read'],
      feature: 'documents',
      params: documentParams,
      query: collaborationQuery,
      response: { 200: collaborationStepsResponse, ...commonErrors, ...errors(409) },
      detail: { summary: 'Receive collaborative document changes' },
    },
  )
  .post(
    '/projects/:projectKey/documents/:documentId/steps',
    ({ project, params, user, body }) =>
      saveDocumentSteps(project.id, params.documentId, requireUser(user).id, body),
    {
      permission: ['documents', 'edit'],
      feature: 'documents',
      params: documentParams,
      body: collaborationSaveBody,
      response: { 200: t.Nullable(DocumentResponse), ...commonErrors, ...errors(409) },
      detail: { summary: 'Save and rebase collaborative document changes' },
    },
  )
  .get(
    '/projects/:projectKey/documents/:documentId/comments',
    ({ project, params, user }) =>
      listDocumentComments(project.id, params.documentId, requireUser(user).id),
    {
      permission: ['documents', 'read'],
      feature: 'documents',
      params: documentParams,
      response: { 200: t.Array(documentCommentResponse), ...commonErrors },
      detail: {
        summary: 'Read document comment threads',
        description:
          "List a document's comments, oldest first. A reply has the id of its thread's first " +
          'comment in `parentId`. `quote` is the text the ' +
          'thread is about. `resolvedAt` is set on a resolved thread.',
        ...mcpTool('list_document_comments'),
      },
    },
  )
  .post(
    '/projects/:projectKey/documents/:documentId/comments',
    ({ project, params, user, body, set }) => {
      set.status = 201;
      return addDocumentComment(project.id, params.documentId, requireUser(user).id, body);
    },
    {
      permission: ['documents', 'edit'],
      feature: 'documents',
      params: documentParams,
      body: documentCommentBody,
      response: { 201: t.Object({ id: t.String() }), ...commonErrors, ...errors(409) },
      detail: {
        summary: 'Comment on selected document text or reply',
        description:
          'Add a comment to a document. A new thread needs ' +
          'the selected text: quote, from, to and version.',
        ...mcpTool('add_document_comment'),
      },
    },
  )
  .patch(
    '/projects/:projectKey/documents/:documentId/comments/:commentId',
    ({ project, params, user, body }) =>
      updateDocumentComment(
        project.id,
        params.documentId,
        requireUser(user).id,
        params.commentId,
        body,
      ),
    {
      permission: ['documents', 'edit'],
      feature: 'documents',
      params: documentCommentParams,
      body: documentCommentUpdateBody,
      response: { 200: t.Object({ ok: t.Boolean() }), ...commonErrors },
      detail: {
        summary: 'Edit a document comment or resolve a thread',
        description:
          "Change the `body` of your own comment, or set `resolved` on a thread's first comment " +
          'to resolve or reopen the thread.',
        ...mcpTool('update_document_comment'),
      },
    },
  );
