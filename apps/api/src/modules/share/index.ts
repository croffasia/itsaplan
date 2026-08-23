import { Elysia, t } from 'elysia';
import { noContent } from '#shared/http';
import { guards, entityGuard } from '#shared/guards';
import { authContext } from '#shared/auth-context';
import { HttpError } from '#shared/lib';
import { commonErrors, errors } from '#shared/responses';
import { getIssueProjectId } from '#modules/issues/service';
import { getView } from '#modules/views/service';
import {
  BundleResponse,
  ShareTokenResponse,
  shareExtendedBody,
  shareIssueParams,
  shareTokenParams,
  shareViewParams,
  sharedViewIssueParams,
} from './model';
import {
  enableIssueShare,
  disableIssueShare,
  enableViewShare,
  disableViewShare,
  getSharedIssue,
  getSharedView,
  getSharedViewIssue,
} from './service';

export const shareRoutes = new Elysia({ name: 'share', detail: { tags: ['Share'] } })
  .use(authContext)
  .use(guards)
  // Guards for the enable/revoke routes, which address an issue or a view by its
  // own id. Sharing an issue is a work_items edit; sharing a view is a views edit.
  .macro({
    workItem: entityGuard('work_items', 'Issue not found', (p) =>
      getIssueProjectId(Number(p.issueId)),
    ),
    savedView: entityGuard(
      'views',
      'View not found',
      async (p) => (await getView(Number(p.viewId)))?.projectId ?? null,
    ),
  })

  // --- Enable / revoke (session-gated) -------------------------------------------

  .post(
    '/issues/:issueId/share',
    async ({ params, body }) => {
      const token = await enableIssueShare(params.issueId, body?.extended);
      if (!token) throw new HttpError(404, 'Issue not found');
      return { token };
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
      const token = await enableViewShare(params.viewId, body?.extended);
      if (!token) throw new HttpError(404, 'View not found');
      return { token };
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
  );
