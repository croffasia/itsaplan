import { db, project, projectMember, teamRole, revision } from '@repo/db';
import { and, eq, inArray, isNotNull, or, sql } from 'drizzle-orm';
import { toMemberContext, type MemberRole } from '#modules/members/service';
import { reachedProjectIds } from '#shared/access';
import { hasPermission, type PermissionResource } from '#shared/permissions';
import { projectAccess, type WorkspaceGrant } from '#shared/workspace-roles';

// The revision engine's read side. The counters themselves are written by the
// triggers in migration 0070 — no application code bumps them, so a write moves
// the marker whichever process it came from.

// A scope kind a client may ask for: the key it maps to in the revision table and
// the resource the caller must be allowed to read to watch it. Project-wide and
// entity scopes use the supplied id. The inbox is per user, so the session user is
// added to its key here; clients never send or see it, and it needs no permission.
export interface ScopeKind {
  key: (id: number, userId: string) => string;
  resource: PermissionResource | null;
}

export const scopeKind: Record<string, ScopeKind> = {
  board: { key: (projectId) => `board:${projectId}`, resource: 'work_items' },
  documents: { key: (projectId) => `documents:${projectId}`, resource: 'documents' },
  issue: { key: (issueId) => `issue:${issueId}`, resource: 'work_items' },
  initiative: {
    key: (initiativeId) => `initiative:${initiativeId}`,
    resource: 'initiatives',
  },
  inbox: { key: (projectId, userId) => `inbox:${projectId}:${userId}`, resource: null },
};

// A scope with no row has never changed; a client treats it the same as any other
// unchanged value, so it reads as "0".
export const NO_REV = '0';

// One scope to read: its key in the revision table and the resource it belongs to.
export interface ScopeRead {
  key: string;
  resource: PermissionResource | null;
}

function memberOrGranted(grantedTeams: number[]) {
  return or(
    isNotNull(projectMember.userId),
    grantedTeams.length > 0 ? inArray(project.teamId, grantedTeams) : undefined,
  );
}

// The markers a client is watching, in one query. A scope of a project the user neither
// belongs to nor reaches through their workspace role returns no row and reads as
// unchanged. A scope whose resource their access may not read is dropped the same way,
// so it also reads as unchanged.
export async function readRevs(
  wanted: ScopeRead[],
  userId: string,
  grants: Map<number, WorkspaceGrant>,
): Promise<Record<string, string>> {
  if (wanted.length === 0) return {};
  const grantedTeams = [...grants.keys()];
  const rows = await db
    .select({
      scope: revision.scope,
      rev: revision.rev,
      teamId: project.teamId,
      role: projectMember.role,
      permissions: teamRole.permissions,
    })
    .from(revision)
    .innerJoin(project, eq(project.id, revision.projectId))
    .leftJoin(
      projectMember,
      and(eq(projectMember.projectId, revision.projectId), eq(projectMember.userId, userId)),
    )
    .leftJoin(teamRole, eq(teamRole.id, projectMember.roleId))
    .where(
      and(
        inArray(
          revision.scope,
          wanted.map((w) => w.key),
        ),
        memberOrGranted(grantedTeams),
      ),
    );

  const resources = new Map(wanted.map((w) => [w.key, w.resource]));
  const out: Record<string, string> = {};
  for (const row of rows) {
    const resource = resources.get(row.scope);
    if (resource) {
      const member = row.role ? toMemberContext(row.role as MemberRole, row.permissions) : null;
      const access = projectAccess(member, grants.get(row.teamId) ?? null);
      if (!access || !hasPermission(access.permissions, resource, 'read')) continue;
    }
    out[row.scope] = String(row.rev);
  }
  return out;
}

// One marker for the session user's inbox in every project they can read, so the app
// badge watches a single scope however many projects there are. It lists each
// project's marker, so it moves when any inbox moves and when a project is gained or lost.
export async function inboxAllRevision(
  userId: string,
  grants: Map<number, WorkspaceGrant>,
): Promise<string> {
  const rows = await db
    .select({ projectId: project.id, rev: revision.rev })
    .from(project)
    .innerJoin(revision, eq(revision.scope, sql`'inbox:' || ${project.id} || ':' || ${userId}`))
    .where(inArray(project.id, reachedProjectIds(userId, [...grants.keys()])))
    .orderBy(project.id);
  if (rows.length === 0) return NO_REV;
  return rows.map((row) => `${row.projectId}=${row.rev}`).join(',');
}
