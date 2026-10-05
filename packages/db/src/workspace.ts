import { asc, eq } from 'drizzle-orm';
import type { DbExecutor } from './client';
import { team, workspace, workspaceManager } from './schema';

// The instance owner's workspace, the first one. Migration 0135 creates it.
export async function instanceWorkspaceId(executor: DbExecutor): Promise<number> {
  const [row] = await executor
    .select({ id: workspace.id })
    .from(workspace)
    .orderBy(asc(workspace.id))
    .limit(1);
  if (!row) throw new Error('The instance has no workspace');
  return row.id;
}

export async function teamWorkspaceId(teamId: number, executor: DbExecutor): Promise<number> {
  const [row] = await executor
    .select({ workspaceId: team.workspaceId })
    .from(team)
    .where(eq(team.id, teamId));
  if (!row) throw new Error(`Team ${teamId} does not exist`);
  return row.workspaceId;
}

// A workspace with `ownerId` as its owner. Run it in a transaction so neither row is
// written without the other.
export async function createWorkspace(
  executor: DbExecutor,
  name: string,
  ownerId: string,
): Promise<number> {
  const [row] = await executor.insert(workspace).values({ name }).returning({ id: workspace.id });
  await executor
    .insert(workspaceManager)
    .values({ workspaceId: row!.id, userId: ownerId, role: 'owner' });
  return row!.id;
}
