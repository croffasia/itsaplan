import { db, projectMember, projectRole, revision } from '@repo/db';
import { and, eq, inArray } from 'drizzle-orm';
import { toMemberContext, type MemberRole } from '#modules/members/service';
import { hasPermission, type PermissionResource } from '#shared/permissions';

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

// The markers a client is watching, in one query. The join against the membership
// is the access check: a scope of a project the user is not a member of returns no
// row and reads as unchanged. The role decides the rest — a scope whose resource
// the member may not read is dropped the same way, so it also reads as unchanged.
export async function readRevs(
  wanted: ScopeRead[],
  userId: string,
): Promise<Record<string, string>> {
  if (wanted.length === 0) return {};
  const rows = await db
    .select({
      scope: revision.scope,
      rev: revision.rev,
      role: projectMember.role,
      permissions: projectRole.permissions,
    })
    .from(revision)
    .innerJoin(projectMember, eq(projectMember.projectId, revision.projectId))
    .leftJoin(projectRole, eq(projectRole.id, projectMember.roleId))
    .where(
      and(
        inArray(
          revision.scope,
          wanted.map((w) => w.key),
        ),
        eq(projectMember.userId, userId),
      ),
    );

  const resources = new Map(wanted.map((w) => [w.key, w.resource]));
  const out: Record<string, string> = {};
  for (const row of rows) {
    const resource = resources.get(row.scope);
    if (resource) {
      const { permissions } = toMemberContext(row.role as MemberRole, row.permissions);
      if (!hasPermission(permissions, resource, 'read')) continue;
    }
    out[row.scope] = String(row.rev);
  }
  return out;
}
