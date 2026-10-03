import { t } from 'elysia';

export const workspaceParams = t.Object({ workspaceId: t.Numeric() });

export const workspaceManagerParams = t.Object({ workspaceId: t.Numeric(), userId: t.String() });

export const updateWorkspaceBody = t.Object({ name: t.String({ minLength: 1, maxLength: 60 }) });

export const addManagerBody = t.Object({ userId: t.String() });

export const searchQuery = t.Object({
  search: t.Optional(t.String({ description: 'Matches the name or the address.' })),
});

const workspaceRole = t.Union([t.Literal('owner'), t.Literal('admin')]);

export const WorkspaceListResponse = t.Array(
  t.Object({
    id: t.Number(),
    name: t.String(),
    role: t.Nullable(workspaceRole, {
      description: 'Your standing in the workspace; null when you are only in a team of it.',
    }),
  }),
);

export const WorkspaceResponse = t.Object({
  id: t.Number(),
  name: t.String(),
  role: workspaceRole,
  managerCount: t.Number(),
});

const person = {
  userId: t.String(),
  name: t.String(),
  email: t.String(),
  image: t.Nullable(t.String()),
};

export const WorkspaceManagerListResponse = t.Array(t.Object({ ...person, role: workspaceRole }));

export const WorkspaceCandidateListResponse = t.Array(t.Object(person));

export const ScimSettingsResponse = t.Object({
  enabled: t.Boolean(),
  hasToken: t.Boolean(),
  tokenPrefix: t.String(),
  // Where to point the identity provider. Derived from the API origin, so the UI
  // shows it rather than asking the owner to assemble it.
  baseUrl: t.String(),
});

export const ScimSettingsBody = t.Object({
  enabled: t.Optional(t.Boolean()),
});

// The generated token, returned once. It is not stored anywhere it can be read
// back, so a lost token is replaced rather than recovered.
export const ScimTokenResponse = t.Object({
  token: t.String(),
});

const scimGroupMapping = t.Object({
  projectId: t.Integer(),
  role: t.UnionEnum(['owner', 'member']),
  // Which team_role a member joins on. Null for an owner (owners bypass the
  // permission matrix) or to fall back to the team's default role.
  roleId: t.Nullable(t.Integer()),
});

export const ScimGroupResponse = t.Object({
  id: t.String(),
  displayName: t.String(),
  externalId: t.Nullable(t.String()),
  memberCount: t.Integer(),
  mappings: t.Array(
    t.Intersect([scimGroupMapping, t.Object({ projectKey: t.String(), projectName: t.String() })]),
  ),
});

export const ScimGroupMappingsBody = t.Object({
  mappings: t.Array(scimGroupMapping, { maxItems: 100 }),
});

export const scimGroupParams = t.Object({ workspaceId: t.Numeric(), groupId: t.String() });

export const WorkspaceProjectOptionListResponse = t.Array(
  t.Object({
    id: t.Number(),
    key: t.String(),
    name: t.String(),
    roles: t.Array(t.Object({ id: t.Number(), name: t.String() })),
  }),
);
