import { t } from 'elysia';

const memberRole = t.Union([t.Literal('owner'), t.Literal('member')]);

export const memberParams = t.Object({ projectKey: t.String(), userId: t.String() });

// A member DTO (MemberRow from the service).
const MemberResponse = t.Object({
  userId: t.String(),
  name: t.String(),
  email: t.String(),
  username: t.Nullable(t.String()),
  image: t.Nullable(t.String()),
  timezone: t.String(),
  role: memberRole,
  roleId: t.Nullable(t.Number()),
  roleName: t.Nullable(t.String()),
  description: t.String(),
  isAgent: t.Boolean(),
  // 'scim' when an identity provider's group granted this membership. Such a row is
  // rewritten on every sync, so the role and remove actions are refused.
  source: t.UnionEnum(['invite', 'scim']),
  createdAt: t.String(),
});

export const MemberListResponse = t.Array(MemberResponse);

export const setMemberRoleBody = t.Object({
  role: memberRole,
  roleId: t.Optional(t.Nullable(t.Integer())),
});

export const setMemberDescriptionBody = t.Object({
  description: t.String({ maxLength: 500 }),
});
