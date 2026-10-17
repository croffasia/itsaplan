import { t } from 'elysia';
import { TEAM_CREATION } from './service';

export const workspaceParams = t.Object({ workspaceId: t.Numeric() });

export const workspaceManagerParams = t.Object({ workspaceId: t.Numeric(), userId: t.String() });

export const updateWorkspaceBody = t.Object({
  name: t.Optional(t.String({ minLength: 1, maxLength: 60 })),
  color: t.Optional(t.Nullable(t.String({ pattern: '^#[0-9a-fA-F]{6}$' }))),
  // t.UnionEnum defaults to its first value, which would fill in the setting for a
  // request that leaves it out; the update is partial.
  teamCreation: t.Optional(
    t.UnionEnum([...TEAM_CREATION], {
      default: undefined,
      description:
        'Who creates teams: the owner alone, the owner and admins, or anyone in its teams. ' +
        'Only the owner changes it.',
    }),
  ),
});

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
    color: t.Nullable(t.String()),
    canCreateTeam: t.Boolean(),
  }),
);

export const WorkspaceResponse = t.Object({
  id: t.Number(),
  name: t.String(),
  role: workspaceRole,
  managerCount: t.Number(),
  color: t.Nullable(t.String()),
  teamCreation: t.UnionEnum([...TEAM_CREATION]),
  deletion: t.UnionEnum(['allowed', 'work'], {
    description:
      'Whether the owner may delete it: work while a team of it holds a project or an AI agent.',
  }),
});

const person = {
  userId: t.String(),
  name: t.String(),
  email: t.String(),
  image: t.Nullable(t.String()),
};

export const WorkspaceManagerListResponse = t.Array(t.Object({ ...person, role: workspaceRole }));

export const WorkspaceCandidateListResponse = t.Array(t.Object(person));

export const scimGroupParams = t.Object({ workspaceId: t.Numeric(), groupId: t.String() });
