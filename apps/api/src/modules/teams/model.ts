import { t } from 'elysia';
import { pageQueryFields, pageResponse } from '#shared/pagination';
import { PermissionMatrixSchema } from '#shared/permissions';
import { StatsDto } from '#modules/analytics/model';

// Both member lists here take the filters and the window the project member list
// defines, so a reader learns one query and it holds everywhere.
export { memberListQuery } from '#modules/members/model';

export const teamParams = t.Object({ teamId: t.Numeric() });

export const teamProjectParams = t.Object({ teamId: t.Numeric(), projectId: t.Numeric() });

export const teamMemberParams = t.Object({ teamId: t.Numeric(), userId: t.String() });

export const setTeamMemberRoleBody = t.Object({
  role: t.Union([t.Literal('owner'), t.Literal('manager'), t.Literal('member')]),
});

export const createTeamBody = t.Object({
  name: t.String({ minLength: 1, maxLength: 60 }),
});

export const updateTeamBody = t.Partial(createTeamBody);

// A team DTO (TeamRow from the service).
export const TeamResponse = t.Object({
  id: t.Number(),
  name: t.String(),
  mcpEnabled: t.Boolean({
    description:
      'Whether the team is reachable over MCP. Off closes its own resources and every ' +
      'project it owns.',
  }),
  role: t.Union(
    [t.Literal('owner'), t.Literal('manager'), t.Literal('member'), t.Literal('agent')],
    { description: 'Your standing in this team.' },
  ),
  source: t.Union([t.Literal('invite'), t.Literal('scim')], {
    description:
      "How your membership came about. A provisioned one is the identity provider's: you " +
      'cannot leave the team while it stands.',
  }),
  joinedAt: t.String(),
  projectCount: t.Number(),
  memberCount: t.Number(),
  ownerCount: t.Number({ description: 'How many members are owners; the last one cannot leave.' }),
  roleCount: t.Number({ description: "How many roles the team's projects assign from." }),
  integrationCount: t.Number({ description: 'How many integration credentials the team holds.' }),
  agentCount: t.Number({ description: 'How many AI agents the team owns.' }),
  skillCount: t.Number({ description: 'How many agent skills the team library holds.' }),
  toolCount: t.Number({ description: 'How many configured tools the team holds.' }),
  createdAt: t.String(),
});

export const TeamListResponse = t.Array(TeamResponse);

export const TeamDetailResponse = t.Composite([
  TeamResponse,
  t.Object({
    permissions: PermissionMatrixSchema,
    leads: t.Array(
      t.Object({
        userId: t.String(),
        name: t.String(),
        email: t.String(),
        image: t.Nullable(t.String()),
        role: t.Union([t.Literal('owner'), t.Literal('manager')]),
      }),
      { description: 'The people who run the team, owners first.' },
    ),
  }),
]);

export const TeamMemberPageResponse = pageResponse(
  t.Object({
    userId: t.String(),
    name: t.String(),
    email: t.String(),
    image: t.Nullable(t.String()),
    role: t.Union([
      t.Literal('owner'),
      t.Literal('manager'),
      t.Literal('member'),
      t.Literal('agent'),
    ]),
    source: t.Union([t.Literal('invite'), t.Literal('scim')], {
      description: "A provisioned membership is the identity provider's and is not removed here.",
    }),
    agentId: t.Nullable(t.Number({ description: 'The AI agent this bot user backs.' })),
    username: t.Nullable(t.String({ description: "An agent's mention handle." })),
    joinedAt: t.String(),
  }),
);

export const teamProjectListQuery = t.Object({
  search: t.Optional(t.String({ description: 'Matches the key or the name.' })),
  ...pageQueryFields,
});

export const TeamProjectPageResponse = pageResponse(
  t.Object({
    id: t.Number(),
    key: t.String(),
    name: t.String(),
    description: t.String(),
    mcpEnabled: t.Boolean({ description: "Whether the team's MCP reach covers this project." }),
    memberCount: t.Number(),
    owners: t.Array(
      t.Object({
        userId: t.String(),
        name: t.String(),
        image: t.Nullable(t.String()),
      }),
      { description: 'The project members who own it.' },
    ),
    isMember: t.Boolean(),
    createdAt: t.String(),
  }),
);

// Every project the reader has, for the pickers that need them all: the projects an
// agent is attached to, and the MCP switch each project carries.
export const TeamProjectOptionListResponse = t.Array(
  t.Object({
    id: t.Number(),
    key: t.String(),
    name: t.String(),
    mcpEnabled: t.Boolean(),
  }),
);

// One project the team owns: how its issues stand, and where the reader stands in it.
export const TeamProjectDetailResponse = t.Object({
  lastActivityAt: t.Nullable(t.String()),
  stats: StatsDto,
  viewer: t.Nullable(
    t.Object({
      role: t.Union([t.Literal('owner'), t.Literal('member')]),
      source: t.Union([t.Literal('invite'), t.Literal('scim')], {
        description: "A provisioned membership is the identity provider's: it cannot be left.",
      }),
      permissions: PermissionMatrixSchema,
    }),
    {
      description: "The reader's own membership in the project, null when they only run the team.",
    },
  ),
});

// One page of the project's members. The access a membership resolves to is the
// matrix of the role it names, which the caller reads from the team's roles.
export const TeamProjectMemberPageResponse = pageResponse(
  t.Object({
    userId: t.String(),
    name: t.String(),
    email: t.String(),
    username: t.Nullable(t.String()),
    image: t.Nullable(t.String()),
    isAgent: t.Boolean(),
    role: t.Union([t.Literal('owner'), t.Literal('member')]),
    roleId: t.Nullable(t.Number()),
    roleName: t.Nullable(t.String()),
    description: t.String(),
    source: t.Union([t.Literal('invite'), t.Literal('scim')]),
    timezone: t.String(),
    joinedAt: t.String(),
  }),
);

// The team's MCP settings: the switch, and the projects its reach covers.
export const TeamMcpResponse = t.Object({
  enabled: t.Boolean(),
  projects: t.Array(t.Object({ projectId: t.Number(), enabled: t.Boolean() })),
});

export const updateTeamMcpBody = t.Object({
  enabled: t.Optional(t.Boolean()),
  projects: t.Optional(t.Array(t.Object({ projectId: t.Number(), enabled: t.Boolean() }))),
});
