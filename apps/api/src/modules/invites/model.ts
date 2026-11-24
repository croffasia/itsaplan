import { t } from 'elysia';
import { pageQueryFields, pageResponse } from '#shared/pagination';

const projectRole = t.Union([t.Literal('owner'), t.Literal('member')]);

const teamRole = t.Union([t.Literal('owner'), t.Literal('manager'), t.Literal('member')]);

const inviteStatus = t.Union([t.Literal('pending'), t.Literal('accepted'), t.Literal('rejected')]);

export const inviteParams = t.Object({ projectKey: t.String(), inviteId: t.Numeric() });

export const teamInviteParams = t.Object({ teamId: t.Numeric(), inviteId: t.Numeric() });

// The token is a UUID column. Validating its format here turns a malformed token
// into a 400 instead of letting it reach Postgres and surface as a 500.
export const tokenParams = t.Object({ token: t.String({ format: 'uuid' }) });

export const createInviteBody = t.Object({
  email: t.String({ format: 'email' }),
  role: projectRole,
  roleId: t.Optional(t.Nullable(t.Integer())),
});

export const createTeamInviteBody = t.Object({
  email: t.String({ format: 'email' }),
  role: teamRole,
});

export const inviteCandidatesQuery = t.Object({
  search: t.String({
    minLength: 2,
    maxLength: 200,
    description: 'Part of the name or the address, at least 2 characters.',
  }),
});

export const InviteCandidateListResponse = t.Array(
  t.Object({
    userId: t.String(),
    name: t.String(),
    email: t.String(),
    image: t.Nullable(t.String()),
  }),
);

// The manager-facing invite row (ListedInvite from the service).
export const InviteRowResponse = t.Object({
  id: t.Number(),
  token: t.Nullable(t.String()),
  email: t.String(),
  teamRole,
  projectKey: t.Nullable(t.String()),
  projectName: t.Nullable(t.String()),
  role: t.Nullable(projectRole),
  roleId: t.Nullable(t.Number()),
  roleName: t.Nullable(t.String()),
  status: inviteStatus,
  createdAt: t.String(),
  expiresAt: t.Nullable(t.String()),
  respondedAt: t.Nullable(t.String()),
  invitedByName: t.Nullable(t.String()),
  invitedByEmail: t.Nullable(t.String()),
});

// emailFailed: a mail provider is set but the invite's email could not go out; the link
// still works. Without a provider both are false.
export const InviteCreateResponse = t.Composite([
  t.Omit(InviteRowResponse, ['token']),
  t.Object({ token: t.String(), emailQueued: t.Boolean(), emailFailed: t.Boolean() }),
]);

export const InviteEmailResponse = t.Object({ emailQueued: t.Boolean() });

export const InviteRowListResponse = t.Array(InviteRowResponse);

// The invitee-facing invite view (InviteView from the service).
export const InviteViewResponse = t.Object({
  token: t.String(),
  teamName: t.String(),
  teamRef: t.String(),
  projectKey: t.Nullable(t.String()),
  projectName: t.Nullable(t.String()),
  email: t.String(),
  teamRole,
  role: t.Nullable(projectRole),
  roleId: t.Nullable(t.Number()),
  roleName: t.Nullable(t.String()),
  status: inviteStatus,
  createdAt: t.String(),
  expired: t.Boolean(),
  hasAccount: t.Boolean(),
});

export const AcceptInviteResponse = t.Object({
  teamName: t.String(),
  teamRef: t.String(),
  projectKey: t.Nullable(t.String()),
  projectName: t.Nullable(t.String()),
  role: t.Nullable(projectRole),
});

export const receivedInvitesQuery = t.Object(pageQueryFields);
export const ReceivedInvitePageResponse = pageResponse(
  t.Object({
    token: t.String(),
    teamName: t.String(),
    projectName: t.Nullable(t.String()),
  }),
);
