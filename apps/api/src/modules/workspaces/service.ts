import { forgetPersonalWorkspace, getAuthSettings } from '@repo/auth';
import {
  aiAgent,
  createWorkspace,
  db,
  instanceWorkspaceId,
  project,
  team,
  teamMember,
  user,
  workspace,
  workspaceManager,
  type DbExecutor,
} from '@repo/db';
import {
  and,
  asc,
  eq,
  exists,
  ilike,
  inArray,
  ne,
  notExists,
  or,
  sql,
  type SQL,
} from 'drizzle-orm';
import { requireUser, type AuthUser } from '#shared/access';
import { HttpError } from '#shared/lib';
import { getOwnedWorkspaceLimit } from '#shared/limits';

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

export const TEAM_CREATION = ['owner', 'managers', 'members'] as const;
export type TeamCreation = (typeof TEAM_CREATION)[number];

// Who may create a team in the workspace, by its setting: the owner always, its admins
// when it lets managers, and anyone in one of its teams when it lets members. A role of
// null is taken to be somebody in one of its teams.
function mayCreateTeam(role: WorkspaceRole | null, teamCreation: string | undefined): boolean {
  return (
    role === 'owner' ||
    (role === 'admin' && teamCreation === 'managers') ||
    teamCreation === 'members'
  );
}

export async function assertMayCreateTeam(workspaceId: number, userId: string): Promise<void> {
  const [row] = await db
    .select({ teamCreation: workspace.teamCreation })
    .from(workspace)
    .where(eq(workspace.id, workspaceId));
  const role = await getWorkspaceRole(workspaceId, userId);
  const allowed =
    mayCreateTeam(role, row?.teamCreation) &&
    (role !== null || (await inWorkspaceTeam(workspaceId, userId)));
  if (!allowed) throw new HttpError(403, 'You may not create a team in this workspace');
}

async function inWorkspaceTeam(workspaceId: number, userId: string): Promise<boolean> {
  const [row] = await db
    .select({ id: user.id })
    .from(user)
    .where(and(eq(user.id, userId), workspacePeople(workspaceId)));
  return row !== undefined;
}

// The workspaces a person sees: those they manage and those holding a team of theirs.
export async function listWorkspaces(userId: string) {
  const rows = await db
    .select({
      id: workspace.id,
      name: workspace.name,
      color: workspace.color,
      teamCreation: workspace.teamCreation,
      role: workspaceManager.role,
    })
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
  return rows.map(({ teamCreation, ...row }) => {
    const role = row.role as WorkspaceRole | null;
    return { ...row, role, canCreateTeam: mayCreateTeam(role, teamCreation) };
  });
}

export async function getWorkspace(workspaceId: number, role: WorkspaceRole) {
  const [row] = await db
    .select({
      id: workspace.id,
      name: workspace.name,
      managerCount: db.$count(workspaceManager, eq(workspaceManager.workspaceId, workspace.id)),
      color: workspace.color,
      teamCreation: workspace.teamCreation,
    })
    .from(workspace)
    .where(eq(workspace.id, workspaceId));
  if (!row) throw new HttpError(404, 'Workspace not found');
  return {
    ...row,
    teamCreation: row.teamCreation as TeamCreation,
    role,
    deletion: await workspaceDeletion(workspaceId),
  };
}

// Whether a team of the workspace has a project or an AI agent: people's work, which a
// deleted workspace would take with it.
export async function workspaceHoldsWork(workspaceId: number): Promise<boolean> {
  const [row] = await db
    .select({ id: team.id })
    .from(team)
    .where(
      and(
        eq(team.workspaceId, workspaceId),
        or(
          exists(
            db
              .select({ n: sql`1` })
              .from(project)
              .where(eq(project.teamId, team.id)),
          ),
          exists(
            db
              .select({ n: sql`1` })
              .from(aiAgent)
              .where(eq(aiAgent.teamId, team.id)),
          ),
        ),
      ),
    )
    .limit(1);
  return row !== undefined;
}

export type WorkspaceDeletion = 'allowed' | 'instance' | 'work';

// Whether the owner may delete the workspace, and if not, why. The instance workspace
// stays: teams created without a workspace and SCIM on a self-hosted instance land in
// it. One whose teams hold work keeps it until its projects and AI agents are gone.
export async function workspaceDeletion(workspaceId: number): Promise<WorkspaceDeletion> {
  if (workspaceId === (await instanceWorkspaceId(db))) return 'instance';
  return (await workspaceHoldsWork(workspaceId)) ? 'work' : 'allowed';
}

// Its teams go with it; their people keep their accounts and their other teams. An owner
// left with no workspace gets a fresh personal one while personal workspaces are on.
export async function deleteWorkspace(workspaceId: number, ownerId: string): Promise<void> {
  const deletion = await workspaceDeletion(workspaceId);
  if (deletion === 'instance') {
    throw new HttpError(409, 'The instance workspace cannot be deleted');
  }
  if (deletion === 'work') {
    throw new HttpError(409, 'Delete the projects and AI agents of its teams first');
  }
  await db.delete(workspace).where(eq(workspace.id, workspaceId));
  forgetPersonalWorkspace(ownerId);
}

export type WorkspaceCreationBlock = 'restricted' | 'limit';

// Whether a person may create a workspace, and if not, why: the instance keeps
// workspaces to its owner, or they already own as many as one person may. An agent's bot
// user is no person and creates none. No core route calls this or createOwnWorkspace;
// an edition that lets a person own more workspaces mounts its route on them.
export async function workspaceCreation(
  current: AuthUser,
  executor: DbExecutor = db,
): Promise<{ allowed: boolean; reason: WorkspaceCreationBlock | null }> {
  if (await executor.$count(aiAgent, eq(aiAgent.userId, current.id))) {
    return { allowed: false, reason: 'restricted' };
  }
  if (current.role !== 'god' && !(await getAuthSettings()).personalWorkspaces) {
    return { allowed: false, reason: 'restricted' };
  }
  const limit = getOwnedWorkspaceLimit();
  const owned = await executor.$count(
    workspaceManager,
    and(eq(workspaceManager.userId, current.id), eq(workspaceManager.role, 'owner')),
  );
  if (limit > 0 && owned >= limit) return { allowed: false, reason: 'limit' };
  return { allowed: true, reason: null };
}

export async function createOwnWorkspace(current: AuthUser, name: string): Promise<number> {
  return db.transaction(async (tx) => {
    // Two requests at once would otherwise both count the same owned workspaces.
    await tx.select({ id: user.id }).from(user).where(eq(user.id, current.id)).for('update');
    const { reason } = await workspaceCreation(current, tx);
    if (reason === 'restricted') {
      throw new HttpError(403, 'Only the instance owner can create workspaces');
    }
    if (reason === 'limit') throw new HttpError(409, 'You already own a workspace');
    return createWorkspace(tx, name, current.id);
  });
}

// A manager renames and recolours it; who creates teams is the owner's to decide, so an
// admin cannot let themselves create teams.
export async function updateWorkspace(
  workspaceId: number,
  role: WorkspaceRole,
  patch: { name?: string; color?: string | null; teamCreation?: TeamCreation },
): Promise<void> {
  if (patch.teamCreation !== undefined && role !== 'owner') {
    throw new HttpError(403, 'Only the workspace owner decides who creates teams');
  }
  if (Object.keys(patch).length === 0) return;
  await db.update(workspace).set(patch).where(eq(workspace.id, workspaceId));
}

// Hands the workspace to one of its admins; the owner stays on as an admin. No core route
// calls it: an edition that offers handing a workspace over mounts its route here. The instance
// workspace stays with the instance owner. Nobody takes on more workspaces than one person
// may own, so handing over is no way around the limit; the instance owner is the
// exception, as deleted accounts' workspaces pass to them anyway. An owner left with no
// workspace gets a fresh personal one while personal workspaces are on.
export async function transferWorkspace(
  workspaceId: number,
  ownerId: string,
  toUserId: string,
): Promise<void> {
  if (workspaceId === (await instanceWorkspaceId(db))) {
    throw new HttpError(409, 'The instance workspace stays with the instance owner');
  }
  if ((await getWorkspaceRole(workspaceId, toUserId)) !== 'admin') {
    throw new HttpError(404, 'This person is not an admin of the workspace');
  }
  const [target] = await db.select({ role: user.role }).from(user).where(eq(user.id, toUserId));
  const limit = getOwnedWorkspaceLimit();
  if (target?.role !== 'god' && limit > 0) {
    const owned = await db.$count(
      workspaceManager,
      and(eq(workspaceManager.userId, toUserId), eq(workspaceManager.role, 'owner')),
    );
    if (owned >= limit) {
      throw new HttpError(409, 'This person already owns as many workspaces as one person may');
    }
  }
  // One owner per workspace: the current one steps down before the admin steps up.
  await db.transaction(async (tx) => {
    await tx
      .update(workspaceManager)
      .set({ role: 'admin' })
      .where(
        and(eq(workspaceManager.workspaceId, workspaceId), eq(workspaceManager.userId, ownerId)),
      );
    await tx
      .update(workspaceManager)
      .set({ role: 'owner' })
      .where(
        and(eq(workspaceManager.workspaceId, workspaceId), eq(workspaceManager.userId, toUserId)),
      );
  });
  forgetPersonalWorkspace(ownerId);
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
