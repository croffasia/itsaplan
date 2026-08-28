import { db, projectMember, scimGroupMapping, scimGroupMember } from '@repo/db';
import { eq } from 'drizzle-orm';
import { removeMember, setMembership, type MemberRole } from '#modules/members/service';

// Turns provisioned group membership into project membership. This is the only
// place a project_member row is written from SCIM, and it only ever touches rows
// it owns (`source: 'scim'`) — a membership somebody set up through an invite is
// left exactly as it is, in either direction.
//
// Called after a group's members or its mappings change.

interface Desired {
  role: MemberRole;
  roleId: number | null;
}

export async function reconcileProjects(projectIds: number[]): Promise<void> {
  for (const projectId of new Set(projectIds)) {
    await reconcileProject(projectId);
  }
}

// Who the mappings say should be a member of this project. A user reachable
// through two mappings resolves to the strongest: 'owner' beats 'member', and among
// equals the lowest mapping id wins, so the result does not depend on row order.
async function desiredMembers(projectId: number): Promise<Map<string, Desired>> {
  const rows = await db
    .select({
      userId: scimGroupMember.userId,
      role: scimGroupMapping.role,
      roleId: scimGroupMapping.roleId,
    })
    .from(scimGroupMapping)
    .innerJoin(scimGroupMember, eq(scimGroupMember.groupId, scimGroupMapping.groupId))
    .where(eq(scimGroupMapping.projectId, projectId))
    .orderBy(scimGroupMapping.id);

  const desired = new Map<string, Desired>();
  for (const row of rows) {
    const role = row.role as MemberRole;
    const current = desired.get(row.userId);
    if (current && (current.role === 'owner' || role !== 'owner')) continue;
    // Owners bypass the permission matrix, so they carry no custom role.
    desired.set(row.userId, { role, roleId: role === 'owner' ? null : row.roleId });
  }
  return desired;
}

async function reconcileProject(projectId: number): Promise<void> {
  const desired = await desiredMembers(projectId);
  const existing = await db
    .select({
      userId: projectMember.userId,
      role: projectMember.role,
      roleId: projectMember.roleId,
      source: projectMember.source,
    })
    .from(projectMember)
    .where(eq(projectMember.projectId, projectId));

  const byUser = new Map(existing.map((row) => [row.userId, row]));
  // Tracked as rows change so the last-owner guard below stays correct without
  // re-counting after every write.
  let owners = existing.filter((row) => row.role === 'owner').length;

  for (const [userId, want] of desired) {
    const have = byUser.get(userId);
    if (!have) {
      await db.insert(projectMember).values({
        projectId,
        userId,
        role: want.role,
        roleId: want.roleId,
        source: 'scim',
      });
      if (want.role === 'owner') owners += 1;
      continue;
    }
    // A membership a person set up outranks the identity provider: the group adds
    // nothing on top of it and never takes it away.
    if (have.source !== 'scim') continue;
    if (have.role === want.role && have.roleId === want.roleId) continue;
    if (have.role === 'owner' && want.role !== 'owner' && owners <= 1) continue;
    await setMembership(projectId, userId, want.role, want.roleId);
    if (have.role === 'owner' && want.role !== 'owner') owners -= 1;
    if (have.role !== 'owner' && want.role === 'owner') owners += 1;
  }

  for (const row of existing) {
    if (row.source !== 'scim' || desired.has(row.userId)) continue;
    // A project without an owner has nobody who can manage its members, so the
    // last one stays even when the group no longer grants it.
    if (row.role === 'owner' && owners <= 1) continue;
    await removeMember(projectId, row.userId);
    if (row.role === 'owner') owners -= 1;
  }
}

// The projects a group currently grants membership in. Read before and after a
// change so reconciliation covers the projects it was removed from as well.
export async function mappedProjectIds(groupId: string): Promise<number[]> {
  const rows = await db
    .select({ projectId: scimGroupMapping.projectId })
    .from(scimGroupMapping)
    .where(eq(scimGroupMapping.groupId, groupId));
  return rows.map((row) => row.projectId);
}
