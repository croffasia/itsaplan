import { db, teamRole, projectMember, aiAgent, teamInvite, scimGroupMapping } from '@repo/db';
import { and, asc, count, eq, ilike, isNull, or, sql } from 'drizzle-orm';
import { iso } from '#shared/lib';
import { normalizePermissions, type Permissions } from '#shared/permissions';

// Data access for roles: the permission matrices projects assign to their members.
// Owners bypass roles. A role belongs to a team, or to no team: a system role, which
// every team assigns and only god mode writes. A teamId of null addresses the system
// roles. The system role marked default is what a member joins on without a chosen one.

export interface RoleRow {
  id: number;
  name: string;
  isDefault: boolean;
  system: boolean;
  permissions: Permissions;
  createdAt: string;
}

function mapRole(row: typeof teamRole.$inferSelect): RoleRow {
  return {
    id: row.id,
    name: row.name,
    isDefault: row.isDefault,
    system: row.teamId === null,
    permissions: normalizePermissions(row.permissions),
    createdAt: iso(row.createdAt),
  };
}

// The roles a team writes: its own, or with null the system roles.
function ownedBy(teamId: number | null) {
  return teamId === null ? isNull(teamRole.teamId) : eq(teamRole.teamId, teamId);
}

// The roles a team assigns: the system roles and its own.
function assignableBy(teamId: number | null) {
  return teamId === null
    ? isNull(teamRole.teamId)
    : or(isNull(teamRole.teamId), eq(teamRole.teamId, teamId));
}

// System roles first, then the team's, each oldest first.
const roleOrder = [asc(sql`${teamRole.teamId} IS NOT NULL`), asc(teamRole.id)];

export interface RolePage {
  items: RoleRow[];
  total: number;
}

// One page of the roles a team assigns, with how many match in all. The search
// matches the name.
export async function listRolesPage(
  teamId: number,
  options: { search?: string; limit: number; offset: number },
): Promise<RolePage> {
  const term = options.search?.trim();
  const where = and(assignableBy(teamId), term ? ilike(teamRole.name, `%${term}%`) : undefined);
  const [rows, counted] = await Promise.all([
    db
      .select()
      .from(teamRole)
      .where(where)
      .orderBy(...roleOrder)
      .limit(options.limit)
      .offset(options.offset),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(teamRole)
      .where(where),
  ]);
  return { items: rows.map(mapRole), total: counted[0]?.count ?? 0 };
}

// Every role a team assigns, or with null every system role. Read by the pickers that
// assign one, and by the clipboard export, which carries the matrices of all of them.
export async function listRoles(teamId: number | null): Promise<RoleRow[]> {
  const rows = await db
    .select()
    .from(teamRole)
    .where(assignableBy(teamId))
    .orderBy(...roleOrder);
  return rows.map(mapRole);
}

// A role the team writes. A system role is not one of them unless teamId is null.
export async function getRole(teamId: number | null, roleId: number): Promise<RoleRow | null> {
  const rows = await db
    .select()
    .from(teamRole)
    .where(and(ownedBy(teamId), eq(teamRole.id, roleId)));
  return rows[0] ? mapRole(rows[0]) : null;
}

// A role a member of the team's projects may be put on: the team's own or a system role.
export async function getAssignableRole(teamId: number, roleId: number): Promise<RoleRow | null> {
  const rows = await db
    .select()
    .from(teamRole)
    .where(and(assignableBy(teamId), eq(teamRole.id, roleId)));
  return rows[0] ? mapRole(rows[0]) : null;
}

// The role a member joins on when the caller picks none: the default system role.
export async function getDefaultRoleId(): Promise<number | null> {
  const rows = await db
    .select({ id: teamRole.id })
    .from(teamRole)
    .where(and(isNull(teamRole.teamId), eq(teamRole.isDefault, true)));
  return rows[0]?.id ?? null;
}

export async function createRole(
  teamId: number | null,
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
  teamId: number | null,
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
    .where(and(ownedBy(teamId), eq(teamRole.id, roleId)))
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
// members it provisions onto the default role. The caller guards against deleting
// the default role and supplies the target whenever the role is in use.
export async function deleteRole(
  teamId: number | null,
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
    await tx.delete(teamRole).where(and(ownedBy(teamId), eq(teamRole.id, roleId)));
  });
}
