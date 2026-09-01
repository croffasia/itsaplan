import { t } from 'elysia';

const inviteRole = t.Union([t.Literal('owner'), t.Literal('member')]);

const inviteStatus = t.Union([t.Literal('pending'), t.Literal('accepted'), t.Literal('rejected')]);

export const inviteParams = t.Object({ projectKey: t.String(), inviteId: t.Numeric() });

// The token is a UUID column. Validating its format here turns a malformed token
// into a 400 instead of letting it reach Postgres and surface as a 500.
export const tokenParams = t.Object({ token: t.String({ format: 'uuid' }) });

export const createInviteBody = t.Object({
  email: t.String({ format: 'email' }),
  role: inviteRole,
  roleId: t.Optional(t.Nullable(t.Integer())),
});

// The owner-facing invite row (InviteRow from the service).
export const InviteRowResponse = t.Object({
  id: t.Number(),
  token: t.String(),
  email: t.String(),
  role: inviteRole,
  roleId: t.Nullable(t.Number()),
  roleName: t.Nullable(t.String()),
  status: inviteStatus,
  createdAt: t.String(),
  respondedAt: t.Nullable(t.String()),
  invitedByName: t.Nullable(t.String()),
  invitedByEmail: t.Nullable(t.String()),
});

export const InviteCreateResponse = t.Composite([
  InviteRowResponse,
  t.Object({ emailQueued: t.Boolean() }),
]);

export const InviteEmailResponse = t.Object({ emailQueued: t.Boolean() });

export const InviteRowListResponse = t.Array(InviteRowResponse);

// The invitee-facing invite view (InviteView from the service).
export const InviteViewResponse = t.Object({
  token: t.String(),
  projectKey: t.String(),
  projectName: t.String(),
  email: t.String(),
  role: inviteRole,
  roleId: t.Nullable(t.Number()),
  roleName: t.Nullable(t.String()),
  status: inviteStatus,
  createdAt: t.String(),
  hasAccount: t.Boolean(),
});

export const AcceptInviteResponse = t.Object({
  projectKey: t.String(),
  projectName: t.String(),
  role: inviteRole,
});
