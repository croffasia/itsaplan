import { Elysia, t } from 'elysia';
import { noContent } from '#shared/http';
import { authContext } from '#shared/auth-context';
import { entityGuard, guards } from '#shared/guards';
import { requireUser } from '#shared/access';
import { HttpError } from '#shared/lib';
import { paginate } from '#shared/pagination';
import { mcpTool } from '#mcp/generate';
import { accessErrors, commonErrors, errors } from '#shared/responses';
import {
  assertAttachmentUploadAllowed,
  attachmentObjectKey,
  attachmentObjectResponse,
  deleteAttachmentObject,
  safeAttachmentFilename,
  storeAttachmentObject,
} from '#modules/attachments/storage';
import { rawAttachmentQuery } from '#modules/attachments/model';
import {
  AcceptIntakeResponse,
  IntakeAttachmentListResponse,
  IntakeAttachmentResponse,
  IntakeCommentListResponse,
  IntakeCommentResponse,
  IntakeRequestDetailResponse,
  IntakeRequestPageResponse,
  IntakeRequestResponse,
  IntakeSummaryResponse,
  acceptIntakeBody,
  createIntakeBody,
  createIntakeCommentBody,
  declineIntakeBody,
  duplicateIntakeBody,
  intakeAttachmentPublicIdParams,
  intakeCommentParams,
  intakeRequestParams,
  listIntakeQuery,
  projectParams,
  snoozeIntakeBody,
  updateIntakeBody,
  uploadIntakeAttachmentBody,
} from './model';
import {
  acceptIntakeRequest,
  createIntakeAttachment,
  createIntakeComment,
  createIntakeRequest,
  declineIntakeRequest,
  deleteIntakeAttachmentByPublicId,
  deleteIntakeComment,
  deleteIntakeRequest,
  getIntakeAttachmentByPublicId,
  getIntakeAttachmentProjectId,
  getIntakeCommentProjectId,
  getIntakeRequestDetail,
  getIntakeRequestProjectId,
  getIntakeSummary,
  listIntakeAttachments,
  listIntakeComments,
  listIntakeRequests,
  markIntakeDuplicate,
  snoozeIntakeRequest,
  updateIntakeRequest,
} from './service';

export const intakeRoutes = new Elysia({
  name: 'intake',
  detail: { tags: ['Intake'] },
})
  .use(authContext)
  .use(guards)
  .macro({
    intakeRequest: entityGuard(
      'intake',
      'Intake request not found',
      (p) => getIntakeRequestProjectId(Number(p.requestId)),
      'intake',
    ),
    intakeComment: entityGuard(
      'intake',
      'Comment not found',
      (p) => getIntakeCommentProjectId(Number(p.commentId)),
      'intake',
    ),
    intakeAttachment: entityGuard(
      'intake',
      'Attachment not found',
      (p) => getIntakeAttachmentProjectId(p.publicId),
      'intake',
    ),
  })
  .get(
    '/projects/:projectKey/intake',
    ({ project, query }) =>
      paginate(query, (slice) =>
        listIntakeRequests(
          project.id,
          {
            status: query.status,
            source: query.source,
            externalId: query.externalId,
            q: query.q,
          },
          slice,
        ),
      ),
    {
      params: projectParams,
      query: listIntakeQuery,
      permission: ['intake', 'read'],
      feature: 'intake',
      response: { 200: IntakeRequestPageResponse, ...commonErrors },
      detail: {
        summary: 'List intake requests',
        description:
          "List a project's intake requests, filtered by status (default 'pending'), source, externalId, or search text.",
        ...mcpTool('list_intake_requests'),
      },
    },
  )
  .get('/projects/:projectKey/intake/summary', ({ project }) => getIntakeSummary(project.id), {
    params: projectParams,
    permission: ['intake', 'read'],
    feature: 'intake',
    response: { 200: IntakeSummaryResponse, ...accessErrors },
    detail: {
      summary: 'Get intake queue summary',
      description:
        'Counts of intake requests by status plus the timestamp and age of the oldest waiting request.',
      ...mcpTool('get_intake_summary'),
    },
  })
  .post(
    '/projects/:projectKey/intake',
    async ({ project, body, user, set }) => {
      const created = await createIntakeRequest(project.id, body, requireUser(user).id);
      set.status = 201;
      return created;
    },
    {
      params: projectParams,
      body: createIntakeBody,
      permission: ['intake', 'create'],
      feature: 'intake',
      response: { 201: IntakeRequestResponse, ...commonErrors, ...errors(409) },
      detail: {
        summary: 'File an intake request',
        description:
          'File a request into the project intake queue. Requests wait here until reviewed and do not appear on the board or trigger agents.',
        ...mcpTool('create_intake_request'),
      },
    },
  )
  .get(
    '/intake/:requestId',
    async ({ params }) => {
      const detail = await getIntakeRequestDetail(params.requestId);
      if (!detail) throw new HttpError(404, 'Intake request not found');
      return detail;
    },
    {
      params: intakeRequestParams,
      intakeRequest: 'read',
      response: { 200: IntakeRequestDetailResponse, ...commonErrors },
      detail: {
        summary: 'Get an intake request',
        description: 'Return an intake request with its comments and attachments.',
        ...mcpTool('get_intake_request'),
      },
    },
  )
  .patch(
    '/intake/:requestId',
    async ({ params, body }) => {
      const updated = await updateIntakeRequest(params.requestId, body);
      if (!updated) throw new HttpError(404, 'Intake request not found');
      return updated;
    },
    {
      params: intakeRequestParams,
      body: updateIntakeBody,
      intakeRequest: 'edit',
      response: { 200: IntakeRequestResponse, ...commonErrors },
      detail: {
        summary: 'Update an intake request',
        description: 'Edit the title, description, or priority of an intake request.',
        ...mcpTool('update_intake_request'),
      },
    },
  )
  .delete(
    '/intake/:requestId',
    async ({ params }) => {
      const removed = await deleteIntakeRequest(params.requestId);
      if (!removed) throw new HttpError(404, 'Intake request not found');
      return noContent();
    },
    {
      params: intakeRequestParams,
      intakeRequest: 'delete',
      response: { 204: t.Void(), ...commonErrors },
      detail: {
        summary: 'Delete an intake request',
        description: 'Permanently delete an intake request and its attachments.',
        ...mcpTool('delete_intake_request'),
      },
    },
  )
  .post(
    '/intake/:requestId/accept',
    ({ params, body, user }) =>
      acceptIntakeRequest(params.requestId, body ?? {}, requireUser(user).id),
    {
      params: intakeRequestParams,
      body: acceptIntakeBody,
      intakeRequest: 'edit',
      response: { 200: AcceptIntakeResponse, ...commonErrors, ...errors(409) },
      detail: {
        summary: 'Accept an intake request',
        description:
          "Turn a waiting or snoozed intake request into an ordinary issue in the project's default column, keeping its text, comments, and attachments. Optionally set assignee and due date.",
        ...mcpTool('accept_intake_request'),
      },
    },
  )
  .post(
    '/intake/:requestId/decline',
    ({ params, body, user }) =>
      declineIntakeRequest(params.requestId, body?.reason, requireUser(user).id),
    {
      params: intakeRequestParams,
      body: declineIntakeBody,
      intakeRequest: 'edit',
      response: { 200: IntakeRequestResponse, ...commonErrors, ...errors(409) },
      detail: {
        summary: 'Decline an intake request',
        description:
          'Decline a waiting or snoozed intake request with an optional one-line reason.',
        ...mcpTool('decline_intake_request'),
      },
    },
  )
  .post(
    '/intake/:requestId/snooze',
    ({ params, body, user }) =>
      snoozeIntakeRequest(params.requestId, body.until, requireUser(user).id),
    {
      params: intakeRequestParams,
      body: snoozeIntakeBody,
      intakeRequest: 'edit',
      response: { 200: IntakeRequestResponse, ...commonErrors, ...errors(409) },
      detail: {
        summary: 'Snooze an intake request',
        description: 'Snooze a waiting or snoozed intake request until a future date or timestamp.',
        ...mcpTool('snooze_intake_request'),
      },
    },
  )
  .post(
    '/intake/:requestId/duplicate',
    ({ params, body, user }) =>
      markIntakeDuplicate(params.requestId, body.issueId, requireUser(user).id),
    {
      params: intakeRequestParams,
      body: duplicateIntakeBody,
      intakeRequest: 'edit',
      response: { 200: IntakeRequestResponse, ...commonErrors, ...errors(409) },
      detail: {
        summary: 'Mark an intake request as duplicate',
        description:
          'Mark a waiting or snoozed intake request as a duplicate of an existing issue.',
        ...mcpTool('mark_intake_duplicate'),
      },
    },
  )
  .get('/intake/:requestId/comments', ({ params }) => listIntakeComments(params.requestId), {
    params: intakeRequestParams,
    intakeRequest: 'read',
    response: { 200: IntakeCommentListResponse, ...commonErrors },
    detail: {
      summary: 'List intake request comments',
      description: 'List comments on an intake request.',
      ...mcpTool('list_intake_comments'),
    },
  })
  .post(
    '/intake/:requestId/comments',
    async ({ params, body, user, set }) => {
      const created = await createIntakeComment(params.requestId, body.body, requireUser(user).id);
      set.status = 201;
      return created;
    },
    {
      params: intakeRequestParams,
      body: createIntakeCommentBody,
      intakeRequest: 'create',
      response: { 201: IntakeCommentResponse, ...commonErrors },
      detail: {
        summary: 'Add a comment to an intake request',
        description:
          'Post a comment on an intake request. Carried over if the request is accepted.',
        ...mcpTool('add_intake_comment'),
      },
    },
  )
  .delete(
    '/intake/comments/:commentId',
    async ({ params }) => {
      const removed = await deleteIntakeComment(params.commentId);
      if (!removed) throw new HttpError(404, 'Comment not found');
      return noContent();
    },
    {
      params: intakeCommentParams,
      intakeComment: 'delete',
      response: { 204: t.Void(), ...commonErrors },
      detail: {
        summary: 'Delete an intake comment',
        description: 'Delete a comment from an intake request.',
        ...mcpTool('delete_intake_comment'),
      },
    },
  )
  .get('/intake/:requestId/attachments', ({ params }) => listIntakeAttachments(params.requestId), {
    params: intakeRequestParams,
    intakeRequest: 'read',
    response: { 200: IntakeAttachmentListResponse, ...commonErrors },
    detail: {
      summary: 'List intake attachments',
      description: 'List file attachments on an intake request.',
      ...mcpTool('list_intake_attachments'),
    },
  })
  .post(
    '/intake/:requestId/attachments',
    async ({ params, body, projectId, set }) => {
      const file = body.file;
      const bytes = Buffer.from(await file.arrayBuffer());
      const contentType = file.type || 'application/octet-stream';
      const filename = safeAttachmentFilename(file.name);
      await assertAttachmentUploadAllowed(projectId, bytes.byteLength, contentType);
      const s3Key = attachmentObjectKey(projectId, 'intake', params.requestId, filename);
      await storeAttachmentObject(s3Key, bytes, contentType);
      try {
        const created = await createIntakeAttachment({
          projectId,
          intakeRequestId: params.requestId,
          s3Key,
          filename,
          contentType,
          sizeBytes: bytes.byteLength,
        });
        set.status = 201;
        return created;
      } catch (err) {
        await deleteAttachmentObject(s3Key);
        throw err;
      }
    },
    {
      params: intakeRequestParams,
      body: uploadIntakeAttachmentBody,
      intakeRequest: 'create',
      response: { 201: IntakeAttachmentResponse, ...commonErrors, ...errors(413) },
      detail: {
        summary: 'Upload an intake attachment',
        description: 'Upload a file attachment to an intake request. Carried over if accepted.',
      },
    },
  )
  .delete(
    '/intake-attachments/:publicId',
    async ({ params }) => {
      const deleted = await deleteIntakeAttachmentByPublicId(params.publicId);
      if (!deleted) throw new HttpError(404, 'Attachment not found');
      await deleteAttachmentObject(deleted.s3Key);
      return noContent();
    },
    {
      params: intakeAttachmentPublicIdParams,
      intakeAttachment: 'delete',
      response: { 204: t.Void(), ...commonErrors },
      detail: {
        summary: 'Delete an intake attachment',
        description: 'Delete a file attachment from an intake request.',
      },
    },
  )
  .get(
    '/intake-attachments/:publicId/raw',
    async ({ params, query, request }) => {
      const att = await getIntakeAttachmentByPublicId(params.publicId);
      if (!att) throw new HttpError(404, 'Attachment not found');
      return attachmentObjectResponse({
        s3Key: att.s3Key,
        contentType: att.contentType,
        filename: att.filename,
        request,
        download: query.download === '1',
      });
    },
    {
      params: intakeAttachmentPublicIdParams,
      query: rawAttachmentQuery,
      detail: {
        summary: 'Download raw intake attachment',
        description: 'Serve raw bytes of an intake attachment by its unguessable public id.',
      },
    },
  );
