import { db, teamRole, projectMember, aiAgent, teamInvite, scimGroupMapping } from '@repo/db';
import { and, asc, count, eq, ilike, isNull, sql } from 'drizzle-orm';
import { iso } from '#shared/lib';
import { normalizePermissions, type Permissions } from '#shared/permissions';

// Data access for team roles: the permission matrices a team's projects assign to
// their members. Owners bypass roles. Exactly one role per team is the default
// (isDefault), assigned to members that join through an invite and used as the
// fallback for a member with no explicit role.

export interface RoleRow {
  id: number;
  name: string;
  isDefault: boolean;
  permissions: Permissions;
  createdAt: string;
}

function mapRole(row: typeof teamRole.$inferSelect): RoleRow {
  return {
    id: row.id,
    name: row.name,
    isDefault: row.isDefault,
    permissions: normalizePermissions(row.permissions),
    createdAt: iso(row.createdAt),
  };
}

export interface RolePage {
  items: RoleRow[];
  total: number;
}

// One page of the team's roles, oldest first, with how many match in all. The search
// matches the name.
export async function listRolesPage(
  teamId: number,
  options: { search?: string; limit: number; offset: number },
): Promise<RolePage> {
  const term = options.search?.trim();
  const where = and(
    eq(teamRole.teamId, teamId),
    term ? ilike(teamRole.name, `%${term}%`) : undefined,
  );
  const [rows, counted] = await Promise.all([
    db
      .select()
      .from(teamRole)
      .where(where)
      .orderBy(asc(teamRole.id))
      .limit(options.limit)
      .offset(options.offset),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(teamRole)
      .where(where),
  ]);
  return { items: rows.map(mapRole), total: counted[0]?.count ?? 0 };
}

// Every role of the team. Read by the pickers that assign one, and by the clipboard
// export, which carries the matrices of all of them.
export async function listRoles(teamId: number): Promise<RoleRow[]> {
  const rows = await db
    .select()
    .from(teamRole)
    .where(eq(teamRole.teamId, teamId))
    .orderBy(asc(teamRole.id));
  return rows.map(mapRole);
}

export async function getRole(teamId: number, roleId: number): Promise<RoleRow | null> {
  const rows = await db
    .select()
    .from(teamRole)
    .where(and(eq(teamRole.teamId, teamId), eq(teamRole.id, roleId)));
  return rows[0] ? mapRole(rows[0]) : null;
}

// The role a member joins on when the caller picks none. Null when the team has no
// default role, which leaves the member on the built-in member matrix.
export async function getDefaultRoleId(teamId: number): Promise<number | null> {
  const rows = await db
    .select({ id: teamRole.id })
    .from(teamRole)
    .where(and(eq(teamRole.teamId, teamId), eq(teamRole.isDefault, true)));
  return rows[0]?.id ?? null;
}

export async function createRole(
  teamId: number,
  input: { name: string; permissions: unknown },
): Promise<RoleRow> {
  const [row] = await db
    .insert(teamRole)
    .values({
      teamId,
      name: input.name,
      isDefault: false,
      permissions: normalizePermissions(input.permissions),
    })
    .returning();
  return mapRole(row);
}

export async function updateRole(
  teamId: number,
  roleId: number,
  input: { name?: string; permissions?: unknown },
): Promise<RoleRow | null> {
  const set: { name?: string; permissions?: Permissions } = {};
  if (input.name !== undefined) set.name = input.name;
  if (input.permissions !== undefined) set.permissions = normalizePermissions(input.permissions);
  if (Object.keys(set).length === 0) return getRole(teamId, roleId);
  const [row] = await db
    .update(teamRole)
    .set(set)
    .where(and(eq(teamRole.teamId, teamId), eq(teamRole.id, roleId)))
    .returning();
  return row ? mapRole(row) : null;
}

// Who currently works under a role: project members, AI agents, pending invites that
// would put their invitee on it, and the provisioned group mappings that grant it. A
// role with any of them cannot be deleted until the caller names the role to move
// them to.
export interface RoleUsage {
  members: number;
  agents: number;
  invites: number;
  groups: number;
}

export async function getRoleUsage(roleId: number): Promise<RoleUsage> {
  const [members, agents, invites, groups] = await Promise.all([
    db
      .select({ n: count() })
      .from(projectMember)
      // An agent's bot user holds a project_member row like a person does; it is
      // counted as an agent instead. Same agent test as listMembers.
      .leftJoin(aiAgent, eq(aiAgent.userId, projectMember.userId))
      .where(and(eq(projectMember.roleId, roleId), isNull(aiAgent.id))),
    db
      .select({ n: count() })
      .from(projectMember)
      .innerJoin(aiAgent, eq(aiAgent.userId, projectMember.userId))
      .where(eq(projectMember.roleId, roleId)),
    db
      .select({ n: count() })
      .from(teamInvite)
      .where(and(eq(teamInvite.roleId, roleId), eq(teamInvite.status, 'pending'))),
    db.select({ n: count() }).from(scimGroupMapping).where(eq(scimGroupMapping.roleId, roleId)),
  ]);
  return {
    members: members[0].n,
    agents: agents[0].n,
    invites: invites[0].n,
    groups: groups[0].n,
  };
}

export function isRoleInUse(usage: RoleUsage): boolean {
  return usage.members + usage.agents + usage.invites + usage.groups > 0;
}

// Deletes a role after moving everything on it — memberships, people's and agents'
// alike, pending invites, and the group mappings that grant it — to targetRoleId, in
// one transaction, so nothing is left with a dangling role. A mapping left behind
// would be nulled by its foreign key, and the next SCIM sync would silently move the
// members it provisions onto the default matrix. The caller guards against deleting
// the default role and supplies the target whenever the role is in use.
export async function deleteRole(
  teamId: number,
  roleId: number,
  targetRoleId: number | null,
): Promise<void> {
  await db.transaction(async (tx) => {
    await tx
      .update(projectMember)
      .set({ roleId: targetRoleId })
      .where(eq(projectMember.roleId, roleId));
    await tx
      .update(teamInvite)
      .set({ roleId: targetRoleId })
      .where(and(eq(teamInvite.roleId, roleId), eq(teamInvite.status, 'pending')));
    await tx
      .update(scimGroupMapping)
      .set({ roleId: targetRoleId })
      .where(eq(scimGroupMapping.roleId, roleId));
    await tx.delete(teamRole).where(and(eq(teamRole.teamId, teamId), eq(teamRole.id, roleId)));
  });
}
