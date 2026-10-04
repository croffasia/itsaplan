import { db, team, teamMember, user, workspace, workspaceManager } from '@repo/db';
import { and, asc, eq, ilike, inArray, ne, notExists, or, sql, type SQL } from 'drizzle-orm';
import { requireUser, type AuthUser } from '#shared/access';
import { HttpError } from '#shared/lib';

export type WorkspaceRole = 'owner' | 'admin';

export async function getWorkspaceRole(
  workspaceId: number,
  userId: string,
): Promise<WorkspaceRole | null> {
  const [row] = await db
    .select({ role: workspaceManager.role })
    .from(workspaceManager)
    .where(and(eq(workspaceManager.workspaceId, workspaceId), eq(workspaceManager.userId, userId)));
  return (row?.role as WorkspaceRole | undefined) ?? null;
}

export interface WorkspaceStanding {
  workspaceId: number;
  role: WorkspaceRole;
  userId: string;
}

// Somebody who does not manage the workspace gets the same 404 as for an unknown one.
export async function requireWorkspaceManager(
  workspaceId: number,
  user: AuthUser | undefined | null,
): Promise<WorkspaceStanding> {
  const current = requireUser(user);
  const role = await getWorkspaceRole(workspaceId, current.id);
  if (!role) throw new HttpError(404, 'Workspace not found');
  return { workspaceId, role, userId: current.id };
}

export async function assertWorkspaceOwner(workspaceId: number, userId: string): Promise<void> {
  if ((await getWorkspaceRole(workspaceId, userId)) !== 'owner') {
    throw new HttpError(403, 'Only the workspace owner can do this');
  }
}

// The workspaces a person sees: those they manage and those holding a team of theirs.
export async function listWorkspaces(userId: string) {
  const rows = await db
    .select({ id: workspace.id, name: workspace.name, role: workspaceManager.role })
    .from(workspace)
    .leftJoin(
      workspaceManager,
      and(eq(workspaceManager.workspaceId, workspace.id), eq(workspaceManager.userId, userId)),
    )
    .where(
      or(
        eq(workspaceManager.userId, userId),
        inArray(
          workspace.id,
          db
            .select({ id: team.workspaceId })
            .from(team)
            .innerJoin(teamMember, eq(teamMember.teamId, team.id))
            .where(eq(teamMember.userId, userId)),
        ),
      ),
    )
    .orderBy(asc(workspace.name), asc(workspace.id));
  return rows.map((row) => ({ ...row, role: row.role as WorkspaceRole | null }));
}

export async function getWorkspace(workspaceId: number, role: WorkspaceRole) {
  const [row] = await db
    .select({
      id: workspace.id,
      name: workspace.name,
      managerCount: db.$count(workspaceManager, eq(workspaceManager.workspaceId, workspace.id)),
    })
    .from(workspace)
    .where(eq(workspace.id, workspaceId));
  if (!row) throw new HttpError(404, 'Workspace not found');
  return { ...row, role };
}

export async function renameWorkspace(workspaceId: number, name: string): Promise<void> {
  await db.update(workspace).set({ name }).where(eq(workspace.id, workspaceId));
}

export async function listManagers(workspaceId: number) {
  const rows = await db
    .select({
      userId: user.id,
      name: user.name,
      email: user.email,
      image: user.image,
      role: workspaceManager.role,
    })
    .from(workspaceManager)
    .innerJoin(user, eq(user.id, workspaceManager.userId))
    .where(eq(workspaceManager.workspaceId, workspaceId))
    .orderBy(sql`${workspaceManager.role} = 'owner' desc`, asc(user.name));
  return rows.map((row) => ({ ...row, role: row.role as WorkspaceRole }));
}

// People in a team of the workspace, the only ones who may be made its admin. An
// agent's bot user is in a team but is not a person.
function workspacePeople(workspaceId: number): SQL {
  return sql`${user.id} in (${db
    .select({ id: teamMember.userId })
    .from(teamMember)
    .innerJoin(team, eq(team.id, teamMember.teamId))
    .where(and(eq(team.workspaceId, workspaceId), ne(teamMember.role, 'agent')))})`;
}

const CANDIDATE_LIMIT = 20;

export async function listManagerCandidates(workspaceId: number, search?: string) {
  const term = search?.trim();
  return db
    .select({ userId: user.id, name: user.name, email: user.email, image: user.image })
    .from(user)
    .where(
      and(
        workspacePeople(workspaceId),
        notExists(
          db
            .select({ one: sql`1` })
            .from(workspaceManager)
            .where(
              and(
                eq(workspaceManager.workspaceId, workspaceId),
                eq(workspaceManager.userId, user.id),
              ),
            ),
        ),
        term ? or(ilike(user.name, `%${term}%`), ilike(user.email, `%${term}%`)) : undefined,
      ),
    )
    .orderBy(asc(user.name))
    .limit(CANDIDATE_LIMIT);
}

export async function addAdmin(workspaceId: number, userId: string): Promise<void> {
  const [person] = await db
    .select({ id: user.id })
    .from(user)
    .where(and(eq(user.id, userId), workspacePeople(workspaceId)));
  if (!person) throw new HttpError(404, 'This person is not in a team of the workspace');
  const inserted = await db
    .insert(workspaceManager)
    .values({ workspaceId, userId, role: 'admin' })
    .onConflictDoNothing()
    .returning({ userId: workspaceManager.userId });
  if (inserted.length === 0) throw new HttpError(409, 'This person already manages the workspace');
}

export async function removeAdmin(workspaceId: number, userId: string): Promise<void> {
  const role = await getWorkspaceRole(workspaceId, userId);
  if (!role) throw new HttpError(404, 'Manager not found');
  if (role === 'owner') throw new HttpError(409, 'The workspace owner cannot be removed');
  await db
    .delete(workspaceManager)
    .where(and(eq(workspaceManager.workspaceId, workspaceId), eq(workspaceManager.userId, userId)));
}
