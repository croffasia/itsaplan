import {
  db,
  project,
  projectMember,
  scimGroup,
  scimGroupMapping,
  scimGroupMember,
  scimUser,
  teamMember,
  teamWorkspaceId,
} from '@repo/db';
import { and, eq, isNull, or } from 'drizzle-orm';
import { removeMember, setMembership, type MemberRole } from '#modules/members/service';
import { listSeatHolderIds } from '#modules/teams/service';
import { getLimits } from '#shared/limits';

// Turns provisioned group membership into project membership, and into the team
// membership it stands on. This is the only place either row is written from SCIM,
// and it only ever touches rows it owns (`source: 'scim'`) — a membership somebody
// set up through an invite is left exactly as it is, in either direction.
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
// A person the workspace's provider deactivated is granted nothing by its groups.
async function desiredMembers(projectId: number): Promise<Map<string, Desired>> {
  const rows = await db
    .select({
      userId: scimGroupMember.userId,
      role: scimGroupMapping.role,
      roleId: scimGroupMapping.roleId,
    })
    .from(scimGroupMapping)
    .innerJoin(scimGroupMember, eq(scimGroupMember.groupId, scimGroupMapping.groupId))
    .innerJoin(scimGroup, eq(scimGroup.id, scimGroupMapping.groupId))
    .leftJoin(
      scimUser,
      and(
        eq(scimUser.workspaceId, scimGroup.workspaceId),
        eq(scimUser.userId, scimGroupMember.userId),
      ),
    )
    .where(
      and(
        eq(scimGroupMapping.projectId, projectId),
        or(isNull(scimUser.active), eq(scimUser.active, true)),
      ),
    )
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
  const [owner] = await db
    .select({ teamId: project.teamId })
    .from(project)
    .where(eq(project.id, projectId));
  if (!owner) return;
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
  // A seat ceiling stops the provider from adding people the workspace has no room for.
  // Those already in it keep their membership and still join the project.
  const workspaceId = await teamWorkspaceId(owner.teamId, db);
  const { maxSeats } = await getLimits(workspaceId);
  const seats = maxSeats > 0 ? new Set(await listSeatHolderIds(workspaceId)) : new Set<string>();
  // Tracked as rows change so the last-owner guard below stays correct without
  // re-counting after every write.
  let owners = existing.filter((row) => row.role === 'owner').length;

  for (const [userId, want] of desired) {
    const have = byUser.get(userId);
    if (!have) {
      if (maxSeats > 0 && !seats.has(userId)) {
        if (seats.size >= maxSeats) continue;
        seats.add(userId);
      }
      // A project membership only exists on top of one in the team that owns the
      // project, so the group grants that first. It never raises an existing rank.
      await db
        .insert(teamMember)
        .values({ teamId: owner.teamId, userId, role: 'member', source: 'scim' })
        .onConflictDoNothing();
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
    await dropUnusedTeamMembership(owner.teamId, row.userId);
    if (row.role === 'owner') owners -= 1;
  }
}

// The team membership the group granted goes when the last project it granted in
// that team does. Only a row the reconciliation owns: one somebody set up by hand is
// left alone, as their project membership is, and so is a row whose rank was raised
// afterwards — a team is left with owners and managers it did not have to re-appoint.
export async function dropUnusedTeamMembership(teamId: number, userId: string): Promise<void> {
  const remaining = await db
    .select({ projectId: projectMember.projectId })
    .from(projectMember)
    .innerJoin(project, eq(project.id, projectMember.projectId))
    .where(and(eq(project.teamId, teamId), eq(projectMember.userId, userId)))
    .limit(1);
  if (remaining.length > 0) return;
  await db
    .delete(teamMember)
    .where(
      and(
        eq(teamMember.teamId, teamId),
        eq(teamMember.userId, userId),
        eq(teamMember.role, 'member'),
        eq(teamMember.source, 'scim'),
      ),
    );
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
