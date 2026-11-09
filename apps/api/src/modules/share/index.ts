import { Elysia, t } from 'elysia';
import { noContent } from '#shared/http';
import { guards, entityGuard } from '#shared/guards';
import { authContext } from '#shared/auth-context';
import { HttpError } from '#shared/lib';
import { assertPermission } from '#shared/access';
import type { PermissionResource, PermissionAction } from '#shared/permissions';
import { commonErrors, errors } from '#shared/responses';
import { getIssueProjectId } from '#modules/issues/service';
import { getView } from '#modules/views/service';
import { projectSharingEnabled } from '#modules/workspaces/service';
import { rawAttachmentQuery } from '#modules/attachments/model';
import { attachmentObjectResponse } from '#modules/attachments/storage';
import {
  BundleResponse,
  IssueDocumentSharesResponse,
  ProjectSharesResponse,
  RevokedSharesResponse,
  projectSharesParams,
  ShareTokenResponse,
  shareDocumentBody,
  shareDocumentParams,
  shareExtendedBody,
  shareIssueParams,
  shareTokenParams,
  shareViewParams,
  sharedDocumentAssetParams,
  sharedDocumentPageParams,
  sharedViewIssueParams,
} from './model';
import { getSharedViewCalendar } from './calendar';
import {
  enableIssueShare,
  disableIssueShare,
  enableViewShare,
  disableViewShare,
  getSharedIssue,
  getSharedView,
  getSharedViewIssue,
  enableDocumentShare,
  disableDocumentShare,
  getSharedDocument,
  getSharedDocumentAsset,
  getSharedDocumentIssue,
  listIssueDocumentShares,
  listProjectShares,
  revokeProjectShares,
  shareableDocumentProjectId,
  type ShareExpiry,
} from './service';

// The expiry an enable call asks for: undefined leaves it, null clears it, and a
// timestamp must lie in the future, since a link that is already dead on creation
// is a mistake rather than a choice.
function parseExpiry(value: string | null | undefined): ShareExpiry {
  if (value === undefined || value === null) return value;
  const at = new Date(value);
  if (Number.isNaN(at.getTime())) throw new HttpError(400, 'expiresAt is not a valid timestamp');
  if (at.getTime() <= Date.now()) throw new HttpError(400, 'expiresAt must be in the future');
  return at;
}

async function assertSharingEnabled(projectId: number): Promise<void> {
  if (!(await projectSharingEnabled(projectId))) {
    throw new HttpError(403, 'Sharing is turned off for this project');
  }
}

const issueProjectId = (params: Record<string, string>) =>
  getIssueProjectId(Number(params.issueId));

const viewProjectId = async (params: Record<string, string>, user: GuardUser) => {
  const view = await getView(Number(params.viewId), user?.id ?? null);
  return view && !view.isPrivate ? view.projectId : null;
};

const documentProjectId = (params: Record<string, string>) =>
  shareableDocumentProjectId(Number(params.documentId));

export const shareRoutes = new Elysia({ name: 'share', detail: { tags: ['Share'] } })
  .use(authContext)
  .use(guards)
  // Guards for the enable/revoke routes, which address an issue, a view or a document
  // by its own id. Sharing one is an edit of it. Only a project's view and a page that
  // is not private have a share link: a private one is not found here.
  .macro({
    workItem: entityGuard('work_items', 'Issue not found', issueProjectId),
    savedView: entityGuard('views', 'View not found', viewProjectId),
    sharedDocument: entityGuard('documents', 'Document not found', documentProjectId),
    // A new link takes sharing on for the project and, for a document, the Docs section.
    // Revoking takes neither, so a closed link can still be removed.
    newIssueShare: entityGuard(
      'work_items',
      'Issue not found',
      issueProjectId,
      undefined,
      assertSharingEnabled,
    ),
    newViewShare: entityGuard(
      'views',
      'View not found',
      viewProjectId,
      undefined,
      assertSharingEnabled,
    ),
    newDocumentShare: entityGuard(
      'documents',
      'Document not found',
      documentProjectId,
      'documents',
      assertSharingEnabled,
    ),
  })

  // --- Enable / revoke (session-gated) -------------------------------------------

  .post(
    '/issues/:issueId/share',
    async ({ params, body }) => {
      const share = await enableIssueShare(
        params.issueId,
        body?.extended,
        parseExpiry(body?.expiresAt),
      );
      if (!share) throw new HttpError(404, 'Issue not found');
      return share;
    },
    {
      params: shareIssueParams,
      body: shareExtendedBody,
      newIssueShare: 'edit',
      response: { 200: ShareTokenResponse, ...commonErrors },
      detail: { summary: 'Enable issue sharing' },
    },
  )

  .get(
    '/issues/:issueId/share/documents',
    async ({ params }) => listIssueDocumentShares(params.issueId),
    {
      params: shareIssueParams,
      workItem: 'read',
      response: { 200: IssueDocumentSharesResponse, ...commonErrors },
      detail: { summary: 'List the shared documents that show an issue' },
    },
  )

  .delete(
    '/issues/:issueId/share',
    async ({ params }) => {
      const ok = await disableIssueShare(params.issueId);
      if (!ok) throw new HttpError(404, 'Issue not found');
      return noContent();
    },
    {
      params: shareIssueParams,
      workItem: 'edit',
      response: { 204: t.Void(), ...commonErrors },
      detail: { summary: 'Revoke issue sharing' },
    },
  )

  .post(
    '/views/:viewId/share',
    async ({ params, body }) => {
      const share = await enableViewShare(
        params.viewId,
        body?.extended,
        parseExpiry(body?.expiresAt),
      );
      if (!share) throw new HttpError(404, 'View not found');
      return share;
    },
    {
      params: shareViewParams,
      body: shareExtendedBody,
      newViewShare: 'edit',
      response: { 200: ShareTokenResponse, ...commonErrors },
      detail: { summary: 'Enable view sharing' },
    },
  )

  .delete(
    '/views/:viewId/share',
    async ({ params }) => {
      const ok = await disableViewShare(params.viewId);
      if (!ok) throw new HttpError(404, 'View not found');
      return noContent();
    },
    {
      params: shareViewParams,
      savedView: 'edit',
      response: { 204: t.Void(), ...commonErrors },
      detail: { summary: 'Revoke view sharing' },
    },
  )

  .post(
    '/documents/:documentId/share',
    async ({ params, body, projectId, user }) => {
      // Linked issues open through the link, so turning them on takes the right to share
      // an issue.
      if (body?.includeIssues) await assertPermission(projectId, user, 'work_items', 'edit');
      const share = await enableDocumentShare(
        params.documentId,
        body?.includeChildren,
        body?.includeIssues,
        parseExpiry(body?.expiresAt),
      );
      if (!share) throw new HttpError(404, 'Document not found');
      return share;
    },
    {
      params: shareDocumentParams,
      body: shareDocumentBody,
      newDocumentShare: 'edit',
      response: { 200: ShareTokenResponse, ...commonErrors, ...errors(409) },
      detail: { summary: 'Enable document sharing' },
    },
  )

  .delete(
    '/documents/:documentId/share',
    async ({ params }) => {
      const ok = await disableDocumentShare(params.documentId);
      if (!ok) throw new HttpError(404, 'Document not found');
      return noContent();
    },
    {
      params: shareDocumentParams,
      sharedDocument: 'edit',
      response: { 204: t.Void(), ...commonErrors },
      detail: { summary: 'Revoke document sharing' },
    },
  )

  // --- Project overview (session-gated) -----------------------------------------

  .get(
    '/projects/:projectKey/shares',
    async ({ project, user }) => {
      const [issues, views, documents] = await Promise.all([
        allows(project.id, user, 'work_items', 'read'),
        allows(project.id, user, 'views', 'read'),
        allows(project.id, user, 'documents', 'read'),
      ]);
      const [canRevoke, shares] = await Promise.all([
        revocableKinds(project.id, user),
        listProjectShares(project.id, { issues, views, documents }),
      ]);
      return { ...shares, canRevoke };
    },
    {
      params: projectSharesParams,
      projectMember: true,
      response: { 200: ProjectSharesResponse, ...commonErrors },
      detail: { summary: 'List the public links of a project' },
    },
  )

  .delete(
    '/projects/:projectKey/shares',
    async ({ project, user }) => ({
      revoked: await revokeProjectShares(project.id, await revocableKinds(project.id, user)),
    }),
    {
      params: projectSharesParams,
      projectMember: true,
      response: { 200: RevokedSharesResponse, ...commonErrors },
      detail: { summary: 'Revoke every public link of a project the caller may revoke' },
    },
  )

  // --- Public reads (no session; matched by PUBLIC_GET in auth-context) ----------

  .get(
    '/share/issue/:token',
    async ({ params }) => {
      const bundle = await getSharedIssue(params.token);
      if (!bundle) throw new HttpError(404, 'Not found');
      return bundle;
    },
    {
      params: shareTokenParams,
      response: { 200: BundleResponse, ...errors(400, 404) },
      detail: { summary: 'Get a shared issue' },
    },
  )

  .get(
    '/share/view/:token',
    async ({ params }) => {
      const bundle = await getSharedView(params.token);
      if (!bundle) throw new HttpError(404, 'Not found');
      return bundle;
    },
    {
      params: shareTokenParams,
      response: { 200: BundleResponse, ...errors(400, 404) },
      detail: { summary: 'Get a shared view' },
    },
  )

  .get(
    '/share/view/:token/calendar.ics',
    async ({ params, set }) => {
      const feed = await getSharedViewCalendar(params.token);
      if (!feed) throw new HttpError(404, 'Not found');
      set.headers['content-type'] = 'text/calendar; charset=utf-8';
      set.headers['cache-control'] = 'no-store';
      return feed;
    },
    {
      params: shareTokenParams,
      response: { 200: t.String(), ...errors(400, 404) },
      detail: { summary: 'Get a shared view calendar feed' },
    },
  )

  .get(
    '/share/view/:token/issues/:issueId',
    async ({ params }) => {
      const bundle = await getSharedViewIssue(params.token, params.issueId);
      if (!bundle) throw new HttpError(404, 'Not found');
      return bundle;
    },
    {
      params: sharedViewIssueParams,
      response: { 200: BundleResponse, ...errors(400, 404) },
      detail: { summary: 'Get an issue from a shared view' },
    },
  )
  .get(
    '/share/document/:token',
    async ({ params }) => {
      const bundle = await getSharedDocument(params.token);
      if (!bundle) throw new HttpError(404, 'Not found');
      return bundle;
    },
    {
      params: shareTokenParams,
      response: { 200: BundleResponse, ...errors(400, 404) },
      detail: { summary: 'Get a shared document' },
    },
  )

  .get(
    '/share/document/:token/issues/:issueId',
    async ({ params }) => {
      const bundle = await getSharedDocumentIssue(params.token, params.issueId);
      if (!bundle) throw new HttpError(404, 'Not found');
      return bundle;
    },
    {
      params: sharedViewIssueParams,
      response: { 200: BundleResponse, ...errors(400, 404) },
      detail: { summary: 'Get an issue a shared document names' },
    },
  )

  .get(
    '/share/document/:token/documents/:documentId',
    async ({ params }) => {
      const bundle = await getSharedDocument(params.token, params.documentId);
      if (!bundle) throw new HttpError(404, 'Not found');
      return bundle;
    },
    {
      params: sharedDocumentPageParams,
      response: { 200: BundleResponse, ...errors(400, 404) },
      detail: { summary: 'Get a subpage of a shared document' },
    },
  )

  .get(
    '/share/document/:token/assets/:publicId/raw',
    async ({ params, query, request }) => {
      const asset = await getSharedDocumentAsset(params.token, params.publicId);
      if (!asset) throw new HttpError(404, 'Not found');
      return attachmentObjectResponse({ ...asset, request, download: query.download != null });
    },
    {
      params: sharedDocumentAssetParams,
      query: rawAttachmentQuery,
      // Returns a raw Response (bytes), so no typed 200 body.
      response: { ...errors(400, 404) },
      detail: { summary: 'Download an asset of a shared document' },
    },
  );

type GuardUser = Parameters<typeof assertPermission>[1];

const allows = (
  projectId: number,
  user: GuardUser,
  resource: PermissionResource,
  action: PermissionAction,
) =>
  assertPermission(projectId, user, resource, action).then(
    () => true,
    () => false,
  );

// Revoking a link is an edit of what it shares, as on the per-entity routes.
async function revocableKinds(projectId: number, user: GuardUser) {
  const [issues, views, documents] = await Promise.all([
    allows(projectId, user, 'work_items', 'edit'),
    allows(projectId, user, 'views', 'edit'),
    allows(projectId, user, 'documents', 'edit'),
  ]);
  return { issues, views, documents };
}
