import { t } from 'elysia';
import type { TeamStanding } from '#modules/teams/service';
import {
  emptyPermissions,
  fullPermissions,
  PERMISSION_ACTIONS,
  PERMISSION_RESOURCES,
  resourceActions,
  type Permissions,
} from './permissions';

// What a role in a workspace grants in every team and project of the workspace: the
// standing of their owner, or a permission matrix. It reaches the projects of the
// workspace that the person is not a member of, and raises the ones they are. A role
// with no entry grants nothing.
export type WorkspaceGrant = 'owner' | Permissions;

// Where a person's access to a project comes from: their membership, or only their rank
// in the team that owns it or their role in the workspace that holds it.
export type AccessVia = 'member' | 'team' | 'workspace';

export const AccessViaSchema = t.Union([
  t.Literal('member'),
  t.Literal('team'),
  t.Literal('workspace'),
]);

export function readOnlyPermissions(): Permissions {
  const matrix = emptyPermissions();
  for (const resource of PERMISSION_RESOURCES) {
    matrix[resource].read = resourceActions(resource).includes('read');
  }
  return matrix;
}

// The admin's matrix is built when it is read, so it holds the resources a build adds.
const grants = new Map<string, WorkspaceGrant | (() => Permissions)>([
  ['owner', 'owner'],
  ['admin', readOnlyPermissions],
]);

// Sets what a workspace role grants, or with null that it grants nothing. A build that
// adds roles of its own, or grants the core's differently, calls it at startup.
export function setWorkspaceRoleGrant(role: string, grant: WorkspaceGrant | null): void {
  if (grant) grants.set(role, grant);
  else grants.delete(role);
}

export function workspaceRoleGrant(role: string): WorkspaceGrant | null {
  const grant = grants.get(role) ?? null;
  return typeof grant === 'function' ? grant() : grant;
}

export function mergePermissions(...matrices: (Permissions | null | undefined)[]): Permissions {
  const merged = emptyPermissions();
  for (const matrix of matrices) {
    if (!matrix) continue;
    for (const resource of PERMISSION_RESOURCES) {
      for (const action of PERMISSION_ACTIONS) {
        merged[resource][action] ||= matrix[resource][action];
      }
    }
  }
  return merged;
}

// What a person holds in a project without a membership of it.
export interface ProjectGrant {
  grant: WorkspaceGrant;
  via: 'team' | 'workspace';
}

// What a rank in a team grants in its projects: an owner owns them, a manager reads them.
function teamRankGrant(rank: TeamStanding | null): WorkspaceGrant | null {
  if (rank === 'owner') return 'owner';
  return rank === 'manager' ? readOnlyPermissions() : null;
}

// The grant of a rank in the project's team and of a role in its workspace, together.
export function projectGrantOf(
  rank: TeamStanding | null,
  workspace: WorkspaceGrant | null,
): ProjectGrant | null {
  const team = teamRankGrant(rank);
  if (!team && !workspace) return null;
  const via = team ? 'team' : 'workspace';
  if (team === 'owner' || workspace === 'owner') return { grant: 'owner', via };
  return { grant: mergePermissions(team, workspace), via };
}

export interface ProjectAccess {
  role: 'owner' | 'member';
  permissions: Permissions;
  via: AccessVia;
}

// A project membership raised to the grant. Null when there is neither.
export function projectAccess(
  member: { role: 'owner' | 'member'; permissions: Permissions } | null,
  granted: ProjectGrant | null,
): ProjectAccess | null {
  const via = member ? 'member' : granted?.via;
  if (!via) return null;
  const grant = granted?.grant ?? null;
  if (member?.role === 'owner' || grant === 'owner') {
    return { role: 'owner', permissions: fullPermissions(), via };
  }
  return { role: 'member', permissions: mergePermissions(member?.permissions, grant), via };
}

// A team is reached by a membership, or only by a role in the workspace that holds it.
export type TeamAccessVia = 'member' | 'workspace';

export interface TeamAccess {
  role: TeamStanding;
  via: TeamAccessVia;
  // The matrix the workspace grants, merged into the team permissions of someone who
  // does not run the team. Null when it grants none, and when it makes them its owner.
  grant: Permissions | null;
}

// A team standing raised to the workspace grant: an owner grant runs the team, any
// other makes a non-member a member. Null when there is neither.
export function teamAccess(
  standing: TeamStanding | null,
  grant: WorkspaceGrant | null,
): TeamAccess | null {
  const via = standing ? 'member' : 'workspace';
  if (grant === 'owner') return { role: 'owner', via, grant: null };
  if (!standing && !grant) return null;
  return { role: standing ?? 'member', via, grant };
}
