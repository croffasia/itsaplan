import { db, projectGroup, projectGroupMember, projectMember } from '@repo/db';
import { and, asc, eq, inArray, sql, type SQLWrapper } from 'drizzle-orm';
import { HttpError } from '#shared/lib';

// Data access for project groups: named sets of a project's members that an issue can
// be assigned to. Deleting a group clears it from the issues assigned to it (FK SET
// NULL); a user leaving the project leaves its groups (dropGroupMemberships).

export interface GroupRow {
  id: number;
  projectId: number;
  name: string;
  color: string;
  position: number;
  memberIds: string[];
}

type Executor = typeof db | Parameters<Parameters<typeof db.transaction>[0]>[0];

function mapGroup(row: typeof projectGroup.$inferSelect, memberIds: string[]): GroupRow {
  return {
    id: row.id,
    projectId: row.projectId,
    name: row.name,
    color: row.color,
    position: row.position,
    memberIds,
  };
}

async function membersOf(groupIds: number[]): Promise<Map<number, string[]>> {
  const out = new Map<number, string[]>();
  if (groupIds.length === 0) return out;
  const rows = await db
    .select({ groupId: projectGroupMember.groupId, userId: projectGroupMember.userId })
    .from(projectGroupMember)
    .where(inArray(projectGroupMember.groupId, groupIds))
    .orderBy(projectGroupMember.userId);
  for (const r of rows) out.set(r.groupId, [...(out.get(r.groupId) ?? []), r.userId]);
  return out;
}

export async function listGroups(projectId: number): Promise<GroupRow[]> {
  const rows = await db
    .select()
    .from(projectGroup)
    .where(eq(projectGroup.projectId, projectId))
    .orderBy(asc(projectGroup.position), asc(projectGroup.id));
  const members = await membersOf(rows.map((r) => r.id));
  return rows.map((r) => mapGroup(r, members.get(r.id) ?? []));
}

async function getGroup(id: number, projectId: number): Promise<GroupRow | null> {
  const [row] = await db
    .select()
    .from(projectGroup)
    .where(and(eq(projectGroup.id, id), eq(projectGroup.projectId, projectId)));
  if (!row) return null;
  const members = await membersOf([row.id]);
  return mapGroup(row, members.get(row.id) ?? []);
}

export async function groupMemberIds(groupId: number): Promise<string[]> {
  return (await membersOf([groupId])).get(groupId) ?? [];
}

// A group id from another project fails the same way a missing one does.
export async function assertGroupInProject(
  projectId: number,
  groupId: number | null | undefined,
): Promise<void> {
  if (groupId == null) return;
  const rows = await db
    .select({ id: projectGroup.id })
    .from(projectGroup)
    .where(and(eq(projectGroup.id, groupId), eq(projectGroup.projectId, projectId)));
  if (rows.length === 0) throw new HttpError(400, 'Assignee group must belong to this project');
}

// The id of the project's group with this name (case-insensitive), for callers that name
// a group rather than pass its id, such as an agent reading get_project.
export async function groupIdByName(projectId: number, name: string): Promise<number> {
  const rows = await db
    .select({ id: projectGroup.id })
    .from(projectGroup)
    .where(
      and(eq(projectGroup.projectId, projectId), sql`lower(${projectGroup.name}) = lower(${name})`),
    );
  if (rows.length === 0) throw new HttpError(400, `Unknown assignee group "${name}"`);
  return rows[0].id;
}

async function assertProjectMembers(projectId: number, userIds: string[]): Promise<void> {
  if (userIds.length === 0) return;
  const rows = await db
    .select({ userId: projectMember.userId })
    .from(projectMember)
    .where(and(eq(projectMember.projectId, projectId), inArray(projectMember.userId, userIds)));
  if (rows.length !== userIds.length)
    throw new HttpError(400, 'Group members must be members of this project');
}

export async function createGroup(input: {
  projectId: number;
  name: string;
  color?: string;
  position?: number;
  memberIds?: string[];
}): Promise<GroupRow> {
  const memberIds = [...new Set(input.memberIds ?? [])];
  await assertProjectMembers(input.projectId, memberIds);
  const id = await db.transaction(async (tx) => {
    const [posRow] = await tx
      .select({ pos: sql<number>`COALESCE(MAX(${projectGroup.position}), 0) + 1000` })
      .from(projectGroup)
      .where(eq(projectGroup.projectId, input.projectId));
    const [row] = await tx
      .insert(projectGroup)
      .values({
        projectId: input.projectId,
        name: input.name,
        color: input.color ?? '#6b7280',
        position: input.position ?? Number(posRow.pos),
      })
      .returning({ id: projectGroup.id });
    if (memberIds.length > 0)
      await tx
        .insert(projectGroupMember)
        .values(memberIds.map((userId) => ({ groupId: row.id, userId })));
    return row.id;
  });
  return (await getGroup(id, input.projectId))!;
}

// Scoped to projectId so an id from another project resolves to null (a 404 at the
// route), never a cross-project edit.
export async function updateGroup(
  id: number,
  projectId: number,
  patch: { name?: string; color?: string; position?: number },
): Promise<GroupRow | null> {
  const set: Partial<typeof projectGroup.$inferInsert> = {};
  if (patch.name !== undefined) set.name = patch.name;
  if (patch.color !== undefined) set.color = patch.color;
  if (patch.position !== undefined) set.position = patch.position;
  if (Object.keys(set).length > 0)
    await db
      .update(projectGroup)
      .set(set)
      .where(and(eq(projectGroup.id, id), eq(projectGroup.projectId, projectId)));
  return getGroup(id, projectId);
}

export async function deleteGroup(id: number, projectId: number): Promise<void> {
  await db
    .delete(projectGroup)
    .where(and(eq(projectGroup.id, id), eq(projectGroup.projectId, projectId)));
}

export async function addGroupMembers(
  id: number,
  projectId: number,
  userIds: string[],
): Promise<GroupRow | null> {
  const group = await getGroup(id, projectId);
  if (!group) return null;
  const ids = [...new Set(userIds)];
  await assertProjectMembers(projectId, ids);
  if (ids.length > 0)
    await db
      .insert(projectGroupMember)
      .values(ids.map((userId) => ({ groupId: id, userId })))
      .onConflictDoNothing();
  return getGroup(id, projectId);
}

export async function removeGroupMember(
  id: number,
  projectId: number,
  userId: string,
): Promise<GroupRow | null> {
  const group = await getGroup(id, projectId);
  if (!group) return null;
  await db
    .delete(projectGroupMember)
    .where(and(eq(projectGroupMember.groupId, id), eq(projectGroupMember.userId, userId)));
  return getGroup(id, projectId);
}

export async function setGroupMembers(
  id: number,
  projectId: number,
  userIds: string[],
): Promise<GroupRow | null> {
  const group = await getGroup(id, projectId);
  if (!group) return null;
  const ids = [...new Set(userIds)];
  await assertProjectMembers(projectId, ids);
  await db.transaction(async (tx) => {
    await tx.delete(projectGroupMember).where(eq(projectGroupMember.groupId, id));
    if (ids.length > 0)
      await tx.insert(projectGroupMember).values(ids.map((userId) => ({ groupId: id, userId })));
  });
  return getGroup(id, projectId);
}

// Takes a user out of the groups of the given projects, for the paths that end a
// project membership. `projectIds` is a list or a subquery of project ids.
export async function dropGroupMemberships(
  on: Executor,
  userId: string,
  projectIds: number[] | SQLWrapper,
): Promise<void> {
  const groups = on
    .select({ id: projectGroup.id })
    .from(projectGroup)
    .where(inArray(projectGroup.projectId, projectIds));
  await on
    .delete(projectGroupMember)
    .where(and(eq(projectGroupMember.userId, userId), inArray(projectGroupMember.groupId, groups)));
}
