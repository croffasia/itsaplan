import { Elysia, t } from 'elysia';
import { noContent } from '../shared/http';
import { guards, entityGuard } from '../shared/guards';
import { authContext } from '../shared/auth-context';
import { HttpError } from '../shared/lib';
import { ErrorResponse } from '../shared/responses';
import { getIssueProjectId } from '../issues/store';
import { getView } from '../views/store';
import {
  enableIssueShare,
  disableIssueShare,
  enableViewShare,
  disableViewShare,
  getSharedIssue,
  getSharedView,
  getSharedViewIssue,
} from './store';

// The token is a UUID column; validating its format here turns a malformed token
// into a 400 rather than letting it reach Postgres as a 500.
const tokenParams = t.Object({ token: t.String({ format: 'uuid' }) });

// The share link's token, returned when sharing is enabled.
const ShareTokenResponse = t.Object({ token: t.String() });

// The public read-only bundles mirror the store DTOs (project scaffold + entity),
// which the read-only web pages type themselves. They are self-contained reads,
// so the response is passed through rather than re-declaring the five feature DTOs
// they compose.
const BundleResponse = t.Any();

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
    async ({ params }) => {
      const token = await enableIssueShare(params.issueId);
      if (!token) throw new HttpError(404, 'Issue not found');
      return { token };
    },
    {
      params: t.Object({ issueId: t.Numeric() }),
      workItem: 'edit',
      response: {
        200: ShareTokenResponse,
        400: ErrorResponse,
        401: ErrorResponse,
        403: ErrorResponse,
        404: ErrorResponse,
      },
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
      params: t.Object({ issueId: t.Numeric() }),
      workItem: 'edit',
      response: {
        204: t.Void(),
        400: ErrorResponse,
        401: ErrorResponse,
        403: ErrorResponse,
        404: ErrorResponse,
      },
      detail: { summary: 'Revoke issue sharing' },
    },
  )

  .post(
    '/views/:viewId/share',
    async ({ params }) => {
      const token = await enableViewShare(params.viewId);
      if (!token) throw new HttpError(404, 'View not found');
      return { token };
    },
    {
      params: t.Object({ viewId: t.Numeric() }),
      savedView: 'edit',
      response: {
        200: ShareTokenResponse,
        400: ErrorResponse,
        401: ErrorResponse,
        403: ErrorResponse,
        404: ErrorResponse,
      },
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
      params: t.Object({ viewId: t.Numeric() }),
      savedView: 'edit',
      response: {
        204: t.Void(),
        400: ErrorResponse,
        401: ErrorResponse,
        403: ErrorResponse,
        404: ErrorResponse,
      },
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
      params: tokenParams,
      response: { 200: BundleResponse, 400: ErrorResponse, 404: ErrorResponse },
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
      params: tokenParams,
      response: { 200: BundleResponse, 400: ErrorResponse, 404: ErrorResponse },
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
      params: t.Object({ token: t.String({ format: 'uuid' }), issueId: t.Numeric() }),
      response: { 200: BundleResponse, 400: ErrorResponse, 404: ErrorResponse },
      detail: { summary: 'Get an issue from a shared view' },
    },
  );
