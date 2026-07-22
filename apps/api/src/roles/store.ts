import { db, projectRole, projectMember } from '@repo/db';
import { and, asc, eq } from 'drizzle-orm';
import { iso } from '../shared/lib';
import { normalizePermissions, type Permissions } from '../shared/permissions';

// Data access for project roles: the per-project permission matrices assigned to
// members. Owners bypass roles. Exactly one role per project is the default
// (isDefault), assigned to members that join through an invite and used as the
// fallback for a member with no explicit role.

export interface RoleRow {
  id: number;
  name: string;
  isDefault: boolean;
  permissions: Permissions;
  createdAt: string;
}

function mapRole(row: typeof projectRole.$inferSelect): RoleRow {
  return {
    id: row.id,
    name: row.name,
    isDefault: row.isDefault,
    permissions: normalizePermissions(row.permissions),
    createdAt: iso(row.createdAt),
  };
}

export async function listRoles(projectId: number): Promise<RoleRow[]> {
  const rows = await db
    .select()
    .from(projectRole)
    .where(eq(projectRole.projectId, projectId))
    .orderBy(asc(projectRole.id));
  return rows.map(mapRole);
}

export async function getRole(projectId: number, roleId: number): Promise<RoleRow | null> {
  const rows = await db
    .select()
    .from(projectRole)
    .where(and(eq(projectRole.projectId, projectId), eq(projectRole.id, roleId)));
  return rows[0] ? mapRole(rows[0]) : null;
}

export async function createRole(
  projectId: number,
  input: { name: string; permissions: unknown },
): Promise<RoleRow> {
  const [row] = await db
    .insert(projectRole)
    .values({
      projectId,
      name: input.name,
      isDefault: false,
      permissions: normalizePermissions(input.permissions),
    })
    .returning();
  return mapRole(row);
}

export async function updateRole(
  projectId: number,
  roleId: number,
  input: { name?: string; permissions?: unknown },
): Promise<RoleRow | null> {
  const set: { name?: string; permissions?: Permissions } = {};
  if (input.name !== undefined) set.name = input.name;
  if (input.permissions !== undefined) set.permissions = normalizePermissions(input.permissions);
  if (Object.keys(set).length === 0) return getRole(projectId, roleId);
  const [row] = await db
    .update(projectRole)
    .set(set)
    .where(and(eq(projectRole.projectId, projectId), eq(projectRole.id, roleId)))
    .returning();
  return row ? mapRole(row) : null;
}

// Deletes a role after reassigning every member on it to the project's default
// role, so no member is left with a dangling role. Runs in one transaction. The
// caller guards against deleting the default role itself.
export async function deleteRole(projectId: number, roleId: number): Promise<void> {
  await db.transaction(async (tx) => {
    const [def] = await tx
      .select({ id: projectRole.id })
      .from(projectRole)
      .where(and(eq(projectRole.projectId, projectId), eq(projectRole.isDefault, true)));
    await tx
      .update(projectMember)
      .set({ roleId: def?.id ?? null })
      .where(and(eq(projectMember.projectId, projectId), eq(projectMember.roleId, roleId)));
    await tx
      .delete(projectRole)
      .where(and(eq(projectRole.projectId, projectId), eq(projectRole.id, roleId)));
  });
}
