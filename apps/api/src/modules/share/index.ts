import { Elysia, t } from 'elysia';
import { noContent } from '#shared/http';
import { guards, entityGuard } from '#shared/guards';
import { authContext } from '#shared/auth-context';
import { HttpError } from '#shared/lib';
import { commonErrors, errors } from '#shared/responses';
import { getIssueProjectId } from '#modules/issues/service';
import { getView } from '#modules/views/service';
import { rawAttachmentQuery } from '#modules/attachments/model';
import { attachmentObjectResponse } from '#modules/attachments/storage';
import {
  BundleResponse,
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

export const shareRoutes = new Elysia({ name: 'share', detail: { tags: ['Share'] } })
  .use(authContext)
  .use(guards)
  // Guards for the enable/revoke routes, which address an issue, a view or a document
  // by its own id. Sharing one is an edit of it. Only a project's view and a page that
  // is not private have a share link: a private one is not found here.
  .macro({
    workItem: entityGuard('work_items', 'Issue not found', (p) =>
      getIssueProjectId(Number(p.issueId)),
    ),
    savedView: entityGuard('views', 'View not found', async (p, user) => {
      const view = await getView(Number(p.viewId), user?.id ?? null);
      return view && !view.isPrivate ? view.projectId : null;
    }),
    sharedDocument: entityGuard('documents', 'Document not found', (p) =>
      shareableDocumentProjectId(Number(p.documentId)),
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
      workItem: 'edit',
      response: { 200: ShareTokenResponse, ...commonErrors },
      detail: { summary: 'Enable issue sharing' },
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
      savedView: 'edit',
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
    async ({ params, body }) => {
      const share = await enableDocumentShare(
        params.documentId,
        body?.includeChildren,
        parseExpiry(body?.expiresAt),
      );
      if (!share) throw new HttpError(404, 'Document not found');
      return share;
    },
    {
      params: shareDocumentParams,
      body: shareDocumentBody,
      sharedDocument: 'edit',
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
