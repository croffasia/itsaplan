import { Elysia, t } from 'elysia';
import { mcpTool } from '#mcp/generate';
import { noContent } from '#shared/http';
import { guards, entityGuard } from '#shared/guards';
import { authContext } from '#shared/auth-context';
import { requireUser } from '#shared/access';
import { HttpError } from '#shared/lib';
import { commonErrors, errors } from '#shared/responses';
import { paginate } from '#shared/pagination';
import { deleteObjects } from '@repo/storage';
import {
  AttachmentResponse,
  AttachmentListResponse,
  publicIdParams,
  rawAttachmentQuery,
  uploadAttachmentBody,
} from '#modules/attachments/model';
import {
  assertAttachmentUploadAllowed,
  attachmentObjectKey,
  attachmentObjectResponse,
  deleteAttachmentObject,
  safeAttachmentFilename,
  storeAttachmentObject,
} from '#modules/attachments/storage';
import {
  FeedPageResponse,
  InitiativeCountsResponse,
  InitiativeOptionListResponse,
  InitiativePageResponse,
  InitiativeResponse,
  createInitiativeBody,
  initiativeFeedQuery,
  initiativeOptionsQuery,
  initiativeParams,
  listInitiativesQuery,
  updateInitiativeBody,
} from './model';
import {
  listInitiatives,
  listInitiativeOptions,
  initiativeStatusCounts,
  getInitiative,
  getInitiativeProjectId,
  createInitiative,
  updateInitiative,
  deleteInitiative,
} from './service';
import {
  createInitiativeAttachment,
  deleteInitiativeAttachment,
  getInitiativeAttachment,
  getInitiativeAttachmentProjectId,
  initiativeAttachmentKeys,
  listInitiativeAttachments,
  removeInitiativeAttachmentEmbeds,
  type InitiativeAttachmentRow,
} from './attachments';
import { listFeed } from './activity';

// Public shape returned to the UI, identical to an issue attachment's: never the
// object key. `url` is the public, no-auth download route, so it can be embedded
// in the initiative description.
function attachmentDto(a: InitiativeAttachmentRow) {
  return {
    id: a.publicId,
    filename: a.filename,
    contentType: a.contentType,
    sizeBytes: a.sizeBytes,
    createdAt: a.createdAt,
    url: `/initiative-attachments/${a.publicId}/raw`,
  };
}

export const initiativeRoutes = new Elysia({
  name: 'initiatives',
  detail: { tags: ['Initiatives'] },
})
  .use(authContext)
  .use(guards)
  // Guard for routes that address an initiative by its own id (no :projectKey in
  // the path). Set `initiative: "<action>"` in the route options.
  .macro({
    initiative: entityGuard(
      'initiatives',
      'Initiative not found',
      (p) => getInitiativeProjectId(Number(p.initiativeId)),
      'initiatives',
    ),
    initiativeAttachment: entityGuard(
      'initiatives',
      'Attachment not found',
      (p) => getInitiativeAttachmentProjectId(p.publicId),
      'initiatives',
    ),
  })

  .get(
    '/projects/:projectKey/initiatives',
    ({ project, query }) => {
      const statuses = query.status
        ? query.status
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean)
        : undefined;
      return paginate(query, (window) =>
        listInitiatives(project.id, {
          statuses,
          search: query.search,
          sort: query.sort,
          dir: query.dir,
          ...window,
        }),
      );
    },
    {
      query: listInitiativesQuery,
      permission: ['initiatives', 'read'],
      feature: 'initiatives',
      response: { 200: InitiativePageResponse, ...commonErrors },
      detail: {
        summary: 'List initiatives',
        description: "List a project's initiatives, filtered, sorted and paged.",
        ...mcpTool('list_initiatives'),
      },
    },
  )

  // Fills the initiative picker on an issue. Read under work items: linking an issue
  // needs the titles, not the initiative pages the `initiatives` resource gates.
  .get(
    '/projects/:projectKey/initiatives/options',
    async ({ project, query }) => listInitiativeOptions(project.id, query),
    {
      query: initiativeOptionsQuery,
      permission: ['work_items', 'read'],
      feature: 'initiatives',
      response: { 200: InitiativeOptionListResponse, ...commonErrors },
      detail: {
        summary: 'List initiative options',
        description: 'The initiatives an issue can be linked to: id, title and status.',
      },
    },
  )

  .get(
    '/projects/:projectKey/initiatives/counts',
    async ({ project }) => initiativeStatusCounts(project.id),
    {
      permission: ['initiatives', 'read'],
      feature: 'initiatives',
      response: { 200: InitiativeCountsResponse, ...commonErrors },
      detail: {
        summary: 'Initiative status counts',
        description: "Per-status initiative counts for a project, for the list's tabs.",
      },
    },
  )

  .post(
    '/projects/:projectKey/initiatives',
    async ({ project, body, user, set }) => {
      set.status = 201;
      return createInitiative(project.id, body, requireUser(user).id);
    },
    {
      body: createInitiativeBody,
      permission: ['initiatives', 'create'],
      feature: 'initiatives',
      response: { 201: InitiativeResponse, ...commonErrors },
      detail: {
        summary: 'Create an initiative',
        description: 'Create an initiative in a project.',
        ...mcpTool('create_initiative'),
      },
    },
  )

  .get(
    '/initiatives/:initiativeId',
    async ({ params }) => {
      const found = await getInitiative(params.initiativeId);
      if (!found) throw new HttpError(404, 'Initiative not found');
      return found;
    },
    {
      params: initiativeParams,
      initiative: 'read',
      response: { 200: InitiativeResponse, ...commonErrors },
      detail: {
        summary: 'Get an initiative',
        description: 'Get an initiative by its numeric id.',
        ...mcpTool('get_initiative'),
      },
    },
  )

  .patch(
    '/initiatives/:initiativeId',
    async ({ params, body, user }) => {
      const actorUserId = requireUser(user).id;
      const updated = await updateInitiative(params.initiativeId, body, actorUserId);
      if (!updated) throw new HttpError(404, 'Initiative not found');
      return updated;
    },
    {
      params: initiativeParams,
      body: updateInitiativeBody,
      initiative: 'edit',
      response: { 200: InitiativeResponse, ...commonErrors },
      detail: {
        summary: 'Update an initiative',
        description:
          "Update an initiative by its numeric id. labelIds replaces the initiative's labels.",
        ...mcpTool('update_initiative'),
      },
    },
  )

  .delete(
    '/initiatives/:initiativeId',
    async ({ params }) => {
      // The rows cascade with the initiative; the stored bytes do not, so they are
      // read while they still exist and dropped afterwards.
      const keys = await initiativeAttachmentKeys(params.initiativeId);
      await deleteInitiative(params.initiativeId);
      await deleteObjects(keys);
      return noContent();
    },
    {
      params: initiativeParams,
      initiative: 'delete',
      response: { 204: t.Void(), ...commonErrors },
      detail: {
        summary: 'Delete an initiative',
        description: 'Delete an initiative by its numeric id. Irreversible.',
        ...mcpTool('delete_initiative'),
      },
    },
  )

  .get(
    '/initiatives/:initiativeId/feed',
    async ({ params, query }) => {
      const limit = query.limit != null ? Number(query.limit) : undefined;
      let before = null;
      if (query.cursor) {
        try {
          before = JSON.parse(query.cursor);
        } catch {
          // Ignore a malformed cursor and serve the first page.
        }
      }
      return listFeed(params.initiativeId, { before, limit });
    },
    {
      params: initiativeParams,
      query: initiativeFeedQuery,
      initiative: 'read',
      response: { 200: FeedPageResponse, ...commonErrors },
      detail: {
        summary: 'Get an initiative feed',
        description: "Get an initiative's activity feed by its numeric id.",
        ...mcpTool('list_initiative_activity'),
      },
    },
  )

  .get(
    '/initiatives/:initiativeId/attachments',
    async ({ params }) => (await listInitiativeAttachments(params.initiativeId)).map(attachmentDto),
    {
      params: initiativeParams,
      initiative: 'read',
      response: { 200: AttachmentListResponse, ...commonErrors },
      detail: {
        summary: 'List initiative attachments',
        description: "List an initiative's attachments by its numeric id.",
      },
    },
  )

  // Accepts a multipart form with a single "file" field, stores the bytes in the
  // object store, and records the metadata.
  .post(
    '/initiatives/:initiativeId/attachments',
    async ({ params, body, set, projectId }) => {
      const file = body.file;
      if (!(file instanceof File)) throw new HttpError(400, 'No file uploaded (form field "file")');
      if (file.size === 0) throw new HttpError(400, 'Uploaded file is empty');

      const filename = safeAttachmentFilename(file.name);
      const contentType = file.type || 'application/octet-stream';
      await assertAttachmentUploadAllowed(projectId, file.size, contentType);

      const key = attachmentObjectKey(projectId, 'initiatives', params.initiativeId, filename);
      await storeAttachmentObject(key, Buffer.from(await file.arrayBuffer()), contentType);

      let row;
      try {
        row = await createInitiativeAttachment({
          projectId,
          initiativeId: params.initiativeId,
          s3Key: key,
          filename,
          contentType,
          sizeBytes: file.size,
        });
      } catch (error) {
        await deleteAttachmentObject(key);
        throw error;
      }
      set.status = 201;
      return attachmentDto(row);
    },
    {
      params: initiativeParams,
      body: uploadAttachmentBody,
      initiative: 'edit',
      response: { 201: AttachmentResponse, ...commonErrors, ...errors(413, 502) },
      detail: { summary: 'Upload an initiative attachment' },
    },
  )

  .delete(
    '/initiative-attachments/:publicId',
    async ({ params }) => {
      const row = await deleteInitiativeAttachment(params.publicId);
      if (!row) throw new HttpError(404, 'Attachment not found');
      await removeInitiativeAttachmentEmbeds(row.initiativeId, row.publicId);
      // Row is already gone; a failed object delete only orphans bytes, so don't
      // fail the request over it.
      await deleteAttachmentObject(row.s3Key);
      return noContent();
    },
    {
      params: publicIdParams,
      initiativeAttachment: 'delete',
      response: { 204: t.Void(), ...commonErrors },
      detail: { summary: 'Delete an initiative attachment' },
    },
  )

  // Public download/preview URL, like the issue attachment one: unauthenticated so
  // it works in <img>/<video> tags, addressed by an unguessable uuid, and served
  // with the headers that keep attacker-controlled bytes inert.
  .get(
    '/initiative-attachments/:publicId/raw',
    async ({ params, query, request }) => {
      const row = await getInitiativeAttachment(params.publicId);
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
      // Public route: no 401/403, and a raw Response Elysia cannot type.
      response: { ...errors(400, 404) },
      detail: { summary: 'Download or preview an initiative attachment (public, no auth)' },
    },
  );
